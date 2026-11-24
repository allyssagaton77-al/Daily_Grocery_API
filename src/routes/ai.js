import { Router } from 'express';
import { asyncHandler, ApiError, ok } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { recommend, saveQuery } from '../services/ai.js';

const router = Router();

router.post('/recommendations', asyncHandler(async (req, res) => {
  const query = String(req.body?.query || '').trim().slice(0, 280);
  if (!query) throw new ApiError(422, 'VALIDATION_ERROR', 'Please describe what you are looking for.');
  const result = await recommend(query);
  if (req.headers.authorization) {
    const { userFromToken } = await import('../services/authService.js');
    const user = await userFromToken(req.headers.authorization.slice(7));
    if (user) await saveQuery(user.id, query, result.answer, result.products);
  }
  return ok(res, result);
}));

export default router;
