import { Router } from 'express';
import { asyncHandler, ApiError, created, ok } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { login, register, userFromToken } from '../services/authService.js';

const router = Router();

router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body || {};
  if (!name || !email || !password) throw new ApiError(422, 'VALIDATION_ERROR', 'Name, email and password are required.', { fields: { name: !name, email: !email, password: !password } });
  const result = await register({ name, email, password, phone });
  return created(res, result);
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw new ApiError(422, 'VALIDATION_ERROR', 'Email and password are required.');
  const result = await login({ email, password });
  return ok(res, result);
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => ok(res, req.user)));

export default router;
