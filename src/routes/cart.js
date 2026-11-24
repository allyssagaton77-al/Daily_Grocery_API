import { Router } from 'express';
import { asyncHandler, ok } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { addItem, clearCart, getCart, removeItem, updateItem } from '../services/cart.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => ok(res, await getCart(req.user.id))));
router.post('/items', asyncHandler(async (req, res) => ok(res, await addItem(req.user.id, req.body?.productId, req.body?.quantity))));
router.patch('/items/:productId', asyncHandler(async (req, res) => ok(res, await updateItem(req.user.id, req.params.productId, req.body?.quantity))));
router.delete('/items/:productId', asyncHandler(async (req, res) => ok(res, await removeItem(req.user.id, req.params.productId))));
router.delete('/', asyncHandler(async (req, res) => ok(res, await clearCart(req.user.id))));

export default router;
