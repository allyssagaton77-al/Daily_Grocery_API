import { Router } from 'express';
import { config } from '../config.js';
import { asyncHandler, ApiError, ok } from '../lib/response.js';
import { getOrder, markCancelled, markPaid } from '../services/orders.js';
import { demoCheckoutPage } from '../services/payments.js';

const router = Router();

/** Local sandbox "hosted checkout" page used when no real gateway keys are set. */
router.get('/demo/checkout', asyncHandler(async (req, res) => {
  const order = await getOrder(req.query.order_id, null, true);
  if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  // This static local sandbox page uses a small inline script for card picking.
  res.removeHeader('Content-Security-Policy');
  res.type('html').send(demoCheckoutPage(order, req.query.provider || 'maya'));
}));

const confirmDemo = asyncHandler(async (req, res) => {
  const orderId = req.query?.orderId || req.body?.orderId;
  const order = await markPaid(orderId);
  if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  // Sandbox links navigate the browser back into the PWA.
  if (req.method === 'GET' || req.is('application/x-www-form-urlencoded')) {
    return res.redirect(303, `${config.frontendUrl}/payment/success?order_id=${encodeURIComponent(order.id)}`);
  }
  return ok(res, order);
});

const cancelDemo = asyncHandler(async (req, res) => {
  const orderId = req.query?.orderId || req.body?.orderId;
  const order = await markCancelled(orderId);
  if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  if (req.method === 'GET' || req.is('application/x-www-form-urlencoded')) {
    return res.redirect(303, `${config.frontendUrl}/payment/cancelled?order_id=${encodeURIComponent(order.id)}`);
  }
  return ok(res, order);
});

router.get('/demo/confirm', confirmDemo);
router.post('/demo/confirm', confirmDemo);
router.get('/demo/cancel', cancelDemo);
router.post('/demo/cancel', cancelDemo);

export default router;
