import { Router } from 'express';
import { asyncHandler, ApiError, ok } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { getCart, clearCart } from '../services/cart.js';
import { validateCoupon } from '../services/coupons.js';
import { createOrder, findByIdempotencyKey, getOrder, rememberIdempotency, setCheckoutUrl as createOrderCheckoutUrl } from '../services/orders.js';
import { createCheckoutSession } from '../services/payments.js';

const router = Router();
router.use(requireAuth);

const required = ['fullName', 'phone', 'email', 'addressLine1', 'city', 'postalCode'];

router.post('/', asyncHandler(async (req, res) => {
  const { shipping = {}, couponCode, paymentMethod = 'maya' } = req.body || {};
  const missing = required.filter((field) => !String(shipping[field] || '').trim());
  if (missing.length) throw new ApiError(422, 'VALIDATION_ERROR', 'Please complete your delivery details.', { fields: Object.fromEntries(missing.map((f) => [f, 'Required'])) });
  if (!['maya', 'paymongo'].includes(paymentMethod)) throw new ApiError(422, 'INVALID_PAYMENT_METHOD', 'Choose Maya or PayMongo.');

  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) throw new ApiError(422, 'MISSING_IDEMPOTENCY_KEY', 'A checkout key is required.');
  const existingId = await findByIdempotencyKey(idempotencyKey);
  if (existingId) {
    const existing = await getOrder(existingId, req.user.id);
    if (existing) return ok(res, { orderId: existing.id, order: existing, checkoutUrl: existing.checkoutUrl || undefined });
  }

  const cart = await getCart(req.user.id);
  if (!cart.items.length) throw new ApiError(409, 'EMPTY_CART', 'Your cart is empty.');

  let discount = 0;
  let couponId = null;
  if (couponCode) {
    const coupon = await validateCoupon(couponCode, cart.summary.subtotal);
    if (!coupon.valid) throw new ApiError(422, coupon.code || 'COUPON_EXPIRED', coupon.message || 'Coupon is not valid.');
    discount = Number(coupon.discount || 0);
    couponId = coupon.id || null;
  }

  const subtotal = cart.summary.subtotal;
  const shippingFee = subtotal >= 500 ? 0 : 60;
  const tax = 0;
  const total = Math.max(0, Math.round((subtotal - discount + shippingFee + tax) * 100) / 100);
  const totals = { subtotal, discount, shippingFee, tax, total };

  const order = await createOrder({
    userId: req.user.id,
    cart,
    shipping,
    paymentProvider: paymentMethod,
    totals,
    couponId,
    idempotencyKey,
  });
  await rememberIdempotency(idempotencyKey, order.id);

  const session = await createCheckoutSession({ order, provider: paymentMethod });
  await createOrderCheckoutUrl(order.id, session.checkoutUrl, session.providerPaymentId);

  await clearCart(req.user.id);
  return ok(res, { orderId: order.id, order: { ...order, checkoutUrl: session.checkoutUrl }, checkoutUrl: session.checkoutUrl, provider: session.provider });
}));

export default router;
