import { Router } from 'express';
import { asyncHandler, ApiError, ok } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { getOrder, listOrders } from '../services/orders.js';
import { verifyWithProvider } from '../services/payments.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => ok(res, await listOrders(req.user.id))));

router.post('/:id/verify', asyncHandler(async (req, res) => {
  const order = await getOrder(req.params.id, req.user.id);
  if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  await verifyWithProvider(order);
  const fresh = await getOrder(req.params.id, req.user.id);
  return ok(res, fresh);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const order = await getOrder(req.params.id, req.user.id);
  if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  return ok(res, order);
}));

export default router;
