import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ApiError, fail } from './lib/response.js';
import { config, hasSupabase, isDemoPayments } from './config.js';

import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import cartRoutes from './routes/cart.js';
import couponRoutes from './routes/coupons.js';
import checkoutRoutes from './routes/checkout.js';
import orderRoutes from './routes/orders.js';
import aiRoutes from './routes/ai.js';
import adminRoutes from './routes/admin.js';
import paymentRoutes from './routes/payments.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: false }));
// Allow the deployed HTTPS frontend to reach the local dev API on the same
// machine (Chrome Private Network Access preflight).
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  next();
});
app.use(cors({ origin: config.frontendOrigins, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

const healthHandler = (_req, res) => res.json({
  success: true,
  data: {
    service: 'daily-grocery-api',
    version: '1.0.0',
    database: hasSupabase ? 'supabase' : 'memory-demo',
    payments: isDemoPayments ? 'sandbox-demo' : config.paymentProvider,
    ai: config.aiProvider,
  },
});

app.get('/', (_req, res) => res.json({
  success: true,
  data: {
    service: 'Daily Grocery API',
    message: 'This is the backend API. Open the frontend at http://localhost:5173',
    endpoints: {
      health: '/api/v1/health',
      categories: '/api/v1/categories',
      products: '/api/v1/products',
      checkout: '/api/v1/checkout',
      orders: '/api/v1/orders',
    },
  },
}));

app.get('/health', healthHandler);

const api = express.Router();
api.get('/health', healthHandler);
api.use('/auth', authRoutes);
api.use('/', couponRoutes);
api.use('/', catalogRoutes);
api.use('/cart', cartRoutes);
api.use('/checkout', checkoutRoutes);
api.use('/orders', orderRoutes);
api.use('/ai', aiRoutes);
api.use('/admin', adminRoutes);
api.use('/payments', paymentRoutes);
app.use('/api/v1', api);

app.use((_req, res) => fail(res, 404, 'ROUTE_NOT_FOUND', 'Endpoint not found.'));

app.use((error, _req, res, _next) => {
  if (error instanceof ApiError) return fail(res, error.status, error.code, error.message, error.details);
  if (error?.status && error?.code) return fail(res, error.status, error.code, error.message, error.details);
  if (error?.code === 'SUPABASE_NOT_CONFIGURED') {
    return fail(res, 503, 'DATABASE_NOT_CONFIGURED', 'Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to backend/.env.');
  }
  console.error('[backend]', error);
  return fail(res, 500, 'INTERNAL_ERROR', 'Something went wrong on the server.');
});

app.listen(config.port, () => {
  console.log(`Daily Grocery API running at http://localhost:${config.port}/api/v1`);
  console.log(`Database mode: ${hasSupabase ? 'Supabase' : 'in-memory demo'}`);
  console.log(`Payments: ${isDemoPayments ? 'local sandbox demo' : config.paymentProvider}`);
});
