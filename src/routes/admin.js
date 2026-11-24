import { Router } from 'express';
import { asyncHandler, ApiError, ok } from '../lib/response.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { changeOrderStatus, listAdminOrders, listAdminProducts, saveProduct } from '../services/admin.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/products', asyncHandler(async (_req, res) => ok(res, await listAdminProducts())));

router.post('/products', asyncHandler(async (req, res) => {
  if (!req.body?.name || !req.body?.price) throw new ApiError(422, 'VALIDATION_ERROR', 'Name and price are required.');
  return ok(res, await saveProduct(req.body));
}));

router.patch('/products/:id', asyncHandler(async (req, res) => {
  const product = await saveProduct({ ...req.body, id: req.params.id });
  if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
  return ok(res, product);
}));

router.get('/orders', asyncHandler(async (_req, res) => ok(res, await listAdminOrders())));

router.patch('/orders/:id/status', asyncHandler(async (req, res) => {
  const order = await changeOrderStatus(req.params.id, req.body?.status);
  if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  return ok(res, order);
}));

export default router;
