import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = firebaseConfig.storageBucket
  ? getStorage(app, `gs://${firebaseConfig.storageBucket}`)
  : getStorage(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const ALLOWED_PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ALLOWED_PRODUCT_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;
export const MAX_PRODUCT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_PRODUCT_IMAGES = 8;

export interface UploadedStorageImage {
  url: string;
  path: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

// Startup connectivity verification
testConnection();

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
  rememberMe: boolean
) {
  await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function sendPasswordReset(email: string) {
  return sendPasswordResetEmail(auth, email.trim());
}

export async function signOutUser() {
  return signOut(auth);
}

export function validateProductImageFile(file: File): {
  valid: boolean;
  normalizedContentType?: 'image/jpeg' | 'image/png' | 'image/webp';
  extension?: 'jpg' | 'png' | 'webp';
  error?: string;
} {
  if (!file || file.size <= 0) {
    return { valid: false, error: 'Selected file is empty.' };
  }

  if (file.size > MAX_PRODUCT_IMAGE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `"${file.name}" is ${sizeMb} MB. Maximum allowed image size is 5 MB.`,
    };
  }

  const lowerName = file.name.toLowerCase();
  const mime = (file.type || '').toLowerCase();

  let normalizedContentType: 'image/jpeg' | 'image/png' | 'image/webp' | undefined;
  let extension: 'jpg' | 'png' | 'webp' | undefined;

  if (mime === 'image/jpeg' || mime === 'image/jpg' || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
    normalizedContentType = 'image/jpeg';
    extension = 'jpg';
  } else if (mime === 'image/png' || lowerName.endsWith('.png')) {
    normalizedContentType = 'image/png';
    extension = 'png';
  } else if (mime === 'image/webp' || lowerName.endsWith('.webp')) {
    normalizedContentType = 'image/webp';
    extension = 'webp';
  }

  if (!normalizedContentType || !extension) {
    return {
      valid: false,
      error: `"${file.name}" is not a supported format. Please upload JPG, JPEG, PNG, or WEBP images.`,
    };
  }

  return { valid: true, normalizedContentType, extension };
}

export function formatStorageError(error: unknown): string {
  const errObj = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : null;
  const code = errObj && 'code' in errObj ? String(errObj.code || '') : '';
  const serverResponse =
    errObj && 'serverResponse' in errObj && errObj.serverResponse
      ? String(errObj.serverResponse)
      : '';
  const message = error instanceof Error ? error.message : String(error || '');
  const combined = `${message} ${serverResponse}`.toLowerCase();

  switch (code) {
    case 'storage/unauthorized':
      return 'Upload blocked by Firebase Storage security rules. Sign in with your authorized admin account and publish storage.rules in Firebase Console -> Storage -> Rules.';
    case 'storage/unauthenticated':
      return 'Admin authentication required. Please sign in to your admin account and try again.';
    case 'storage/bucket-not-found':
    case 'storage/project-not-found':
      return `Firebase Cloud Storage bucket (${firebaseConfig.storageBucket}) is not initialized yet. Open Firebase Console -> Storage -> Get Started to activate it.`;
    case 'storage/quota-exceeded':
      return 'Firebase Storage quota has been exceeded.';
    case 'storage/canceled':
      return 'Image upload was canceled.';
    case 'storage/retry-limit-exceeded':
      return 'Upload timed out. Check your internet connection and retry.';
    case 'storage/unknown':
      if (combined.includes('404') || combined.includes('not found')) {
        return `Firebase Cloud Storage bucket (${firebaseConfig.storageBucket}) was not found (HTTP 404). Open Firebase Console -> Storage -> Get Started to activate Storage, then publish storage.rules.`;
      }
      break;
    default:
      break;
  }

  if (combined.includes('404') || combined.includes('bucket') && combined.includes('not found')) {
    return `Firebase Cloud Storage bucket (${firebaseConfig.storageBucket}) is not activated yet. Enable Storage in Firebase Console -> Storage -> Get Started and publish storage.rules.`;
  }
  if (combined.includes('cors') || combined.includes('network')) {
    return `Network/CORS error connecting to Firebase Cloud Storage (${firebaseConfig.storageBucket}). Confirm Storage is activated in Firebase Console -> Storage -> Get Started and storage.rules are published.`;
  }
  return message || 'Unable to upload image to Firebase Cloud Storage.';
}

function buildUniqueFileName(originalName: string, extension: 'jpg' | 'png' | 'webp'): string {
  const base = originalName
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'image';
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${Date.now()}_${rand}_${base}.${extension}`;
}

export function uploadProductImageToStorage(params: {
  file: File;
  productId: string;
  onProgress?: (percent: number) => void;
}): Promise<UploadedStorageImage> {
  const { file, productId, onProgress } = params;
  if (!auth.currentUser) {
    return Promise.reject(
      new Error('Admin authentication required before uploading images to Firebase Cloud Storage.')
    );
  }
  const validation = validateProductImageFile(file);
  if (!validation.valid || !validation.normalizedContentType || !validation.extension) {
    return Promise.reject(new Error(validation.error || 'Invalid image file.'));
  }

  const safeProductId =
    productId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100) || `prod-${Date.now()}`;
  const uniqueFileName = buildUniqueFileName(file.name, validation.extension);
  const fullPath = `products/${safeProductId}/${uniqueFileName}`;
  const storageRef = ref(storage, fullPath);

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: validation.normalizedContentType,
      cacheControl: 'public, max-age=31536000',
    });

    task.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0) {
          const pct = Math.min(99, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
          onProgress?.(pct);
        }
      },
      (error) => {
        reject(new Error(formatStorageError(error)));
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          onProgress?.(100);
          resolve({ url, path: fullPath });
        } catch (err) {
          reject(new Error(formatStorageError(err)));
        }
      }
    );
  });
}

export function extractStoragePathFromUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname === 'firebasestorage.googleapis.com' ||
      parsed.hostname.endsWith('.firebasestorage.app')
    ) {
      const marker = '/o/';
      const idx = parsed.pathname.indexOf(marker);
      if (idx === -1) return null;
      const encodedPath = parsed.pathname.slice(idx + marker.length);
      const decoded = decodeURIComponent(encodedPath);
      if (decoded.startsWith('products/') || decoded.startsWith('banners/')) {
        return decoded;
      }
      return null;
    }
    if (parsed.hostname === 'storage.googleapis.com' && firebaseConfig.storageBucket) {
      const bucketPrefix = `/${firebaseConfig.storageBucket}/`;
      if (parsed.pathname.startsWith(bucketPrefix)) {
        const decoded = decodeURIComponent(parsed.pathname.slice(bucketPrefix.length));
        if (decoded.startsWith('products/') || decoded.startsWith('banners/')) {
          return decoded;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function deleteStorageFileIfExists(storagePath: string): Promise<boolean> {
  if (!auth.currentUser) {
    return false;
  }
  const cleanPath = (storagePath || '').trim();
  if (!cleanPath || (!cleanPath.startsWith('products/') && !cleanPath.startsWith('banners/'))) {
    return false;
  }
  try {
    await deleteObject(ref(storage, cleanPath));
    return true;
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';
    if (code === 'storage/object-not-found') {
      return false;
    }
    console.warn(`Could not delete Firebase Storage object "${cleanPath}":`, error);
    return false;
  }
}

export function uploadImageToStorage(file: File, folder = 'banners'): Promise<string> {
  if (!auth.currentUser) {
    return Promise.reject(
      new Error('Admin authentication required before uploading images to Firebase Cloud Storage.')
    );
  }
  const validation = validateProductImageFile(file);
  if (!validation.valid || !validation.normalizedContentType || !validation.extension) {
    return Promise.reject(new Error(validation.error || 'Invalid image file.'));
  }
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '') || 'banners';
  const uniqueFileName = buildUniqueFileName(file.name, validation.extension);
  const storageRef = ref(storage, `${safeFolder}/${uniqueFileName}`);

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: validation.normalizedContentType,
      cacheControl: 'public, max-age=31536000',
    });

    task.on(
      'state_changed',
      undefined,
      (error) => reject(new Error(formatStorageError(error))),
      async () => {
        try {
          resolve(await getDownloadURL(task.snapshot.ref));
        } catch (err) {
          reject(new Error(formatStorageError(err)));
        }
      }
    );
  });
}
