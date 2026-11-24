import { Router } from 'express';
import { asyncHandler, ApiError, ok } from '../lib/response.js';
import { getProduct, getRelated, getReviews, listCategories, listProducts } from '../services/catalog.js';

const router = Router();

router.get('/categories', asyncHandler(async (_req, res) => ok(res, await listCategories())));

router.get('/products', asyncHandler(async (req, res) => {
  const { items, meta } = await listProducts(req.query);
  return ok(res, items, meta);
}));

router.get('/products/:id/reviews', asyncHandler(async (req, res) => ok(res, await getReviews(req.params.id))));
router.get('/products/:id/related', asyncHandler(async (req, res) => ok(res, await getRelated(req.params.id))));
router.get('/products/:id', asyncHandler(async (req, res) => {
  const product = await getProduct(req.params.id);
  if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
  return ok(res, product);
}));

export default router;
