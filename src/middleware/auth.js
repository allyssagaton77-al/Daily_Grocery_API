import { userFromToken } from '../services/authService.js';
import { fail } from '../lib/response.js';

const bearer = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
};

export const requireAuth = async (req, res, next) => {
  try {
    const user = await userFromToken(bearer(req));
    if (!user) return fail(res, 401, 'UNAUTHORIZED', 'Sign in to continue.');
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireAdmin = (req, res, next) => {
  if (!['admin', 'staff'].includes(req.user?.role)) {
    return fail(res, 403, 'FORBIDDEN', 'Admin access required.');
  }
  return next();
};
