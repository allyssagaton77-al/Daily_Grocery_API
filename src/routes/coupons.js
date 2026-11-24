import { Router } from 'express';
import { asyncHandler, ok } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { listPaymentMethods, validateCoupon } from '../services/coupons.js';
import { getCart } from '../services/cart.js';

const router = Router();

router.get('/payments/methods', asyncHandler(async (_req, res) => ok(res, await listPaymentMethods())));

router.post('/coupons/validate', requireAuth, asyncHandler(async (req, res) => {
  const cart = await getCart(req.user.id);
  const result = await validateCoupon(req.body?.code, cart.summary.subtotal);
  if (!result.valid) {
    return res.status(422).json({
      success: false,
      error: { code: result.code, message: result.message || 'Coupon is not valid.', details: result },
      requestId: crypto.randomUUID(),
    });
  }
  return ok(res, result);
}));

export default router;
