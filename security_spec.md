# Security Specification — KOVA ATELIER Firestore Rules

## 1. Data Invariants
1. **Product Price Authority**: Only verified administrators (`isAdmin()`) may create, update, or delete documents in `/products/{productId}`. Customers can never alter product prices or stock directly.
2. **Server-Side Order Total Validation**: When creating `/orders/{orderId}`, Firestore rules look up each product in `items` (1..8 line items), verify every line item's `price` matches the live product's effective price (`discountPrice > 0 ? discountPrice : price`), recompute `subtotal` server-side, verify any `promoCode` against `/promotions/{promoCode}`, verify `shippingCost`, and enforce `total == subtotal - discountAmount + shippingCost`.
3. **RBAC Isolation**: Admin privileges are never stored on `/users/{userId}` and never read from client claims. Admin status is verified via `request.auth.token.email == 'ayushprajapti1610@gmail.com' && request.auth.token.email_verified == true` or `exists(/databases/$(database)/documents/admins/$(request.auth.uid))`.
4. **PII Isolation**: `/users/{userId}` and `/orders/{orderId}` restrict `get` and `list` strictly to `resource.data.userId == request.auth.uid` (or `userId == request.auth.uid`) or `isAdmin()`.
5. **Terminal State Locking**: Once an order reaches `Delivered` or `Cancelled`, customers can no longer modify it. Customers may only transition `Pending -> Cancelled` via `affectedKeys().hasOnly(['status', 'updatedAt'])`.
6. **Atomicity Guarantee**: Customer-emitted `new_order` notifications in `/notifications/{notificationId}` require `existsAfter(/databases/$(database)/documents/orders/$(incoming().relatedId))` in the same atomic batch.
7. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps on write must strictly equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Price Tampering on Order Create**: Customer submits an order with `items[0].price = 1` when product costs `480` -> `PERMISSION_DENIED`.
2. **Total Manipulation on Order Create**: Customer submits accurate item prices totaling `480` but sets `total = 10` -> `PERMISSION_DENIED`.
3. **Fake Promo Code Injection**: Customer sets `promoCode = "FAKE99"` and `discountAmount = 400` -> `PERMISSION_DENIED`.
4. **Privilege Escalation via User Profile**: Customer attempts to add shadow field `role: "admin"` or `isAdmin: true` to `/users/{uid}` -> `PERMISSION_DENIED`.
5. **Admin Roster Self-Enrollment**: Non-admin attempts to create `/admins/{uid}` -> `PERMISSION_DENIED`.
6. **Unverified Email Admin Spoof**: Attacker signs in with `email_verified: false` matching admin email -> `PERMISSION_DENIED`.
7. **Cross-Customer PII Read**: Authenticated Customer A calls `get` on `/users/customerB` or `/orders/orderB` -> `PERMISSION_DENIED`.
8. **Blanket Order Scraping**: Authenticated Customer A runs `list` on `/orders` without filtering `userId == auth.uid` -> `PERMISSION_DENIED`.
9. **Unauthorized Product Price Mutation**: Authenticated customer calls `update` on `/products/prod-1` setting `price: 1` -> `PERMISSION_DENIED`.
10. **Order State Shortcutting**: Customer attempts to update their own order from `Pending` directly to `Delivered` or `paymentStatus: 'verified'` -> `PERMISSION_DENIED`.
11. **Terminal Order Reopening**: Customer attempts to update a `Cancelled` or `Delivered` order back to `Pending` -> `PERMISSION_DENIED`.
12. **Resource Poisoning / ID Injection**: Attacker passes a 1.5KB junk string as document ID or 20KB string in `customerName` -> `PERMISSION_DENIED`.
