import React from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/store/Header';
import { Footer, WhatsAppButton } from './components/store/Footer';
import { HomePage } from './components/store/HomePage';
import { ShopPage } from './components/store/ShopPage';
import { ProductDetailPage } from './components/store/ProductDetailPage';
import { CartDrawer } from './components/store/CartDrawer';
import { CheckoutPage } from './components/store/CheckoutPage';
import { WishlistPage } from './components/store/WishlistPage';
import { AccountPage } from './components/store/AccountPage';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminLoginPage } from './components/admin/AdminLoginPage';
import { ToastContainer } from './components/ui/ToastContainer';
import { ConfirmDialog } from './components/ui/ConfirmDialog';

function AppRouter() {
  const { route } = useStore();

  if (route.name === 'admin-login') {
    return (
      <>
        <AdminLoginPage />
        <ToastContainer />
        <ConfirmDialog />
      </>
    );
  }

  if (route.name === 'admin') {
    return (
      <>
        <AdminLayout section={route.section || 'overview'} />
        <ToastContainer />
        <ConfirmDialog />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-[#0A0A0A]">
      <Header />
      <div className="flex-1">
        {route.name === 'home' && <HomePage />}
        {route.name === 'shop' && <ShopPage />}
        {route.name === 'product' && <ProductDetailPage productId={route.id} />}
        {route.name === 'checkout' && <CheckoutPage />}
        {route.name === 'wishlist' && <WishlistPage />}
        {route.name === 'account' && <AccountPage />}
      </div>
      <Footer />
      <CartDrawer />
      <WhatsAppButton />
      <ToastContainer />
      <ConfirmDialog />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <AppRouter />
      </StoreProvider>
    </ErrorBoundary>
  );
}
