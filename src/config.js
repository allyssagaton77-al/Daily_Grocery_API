import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const number = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();

export const config = {
  port: number(process.env.PORT, 4000),
  // FRONTEND_URL may list several origins (deployed Vercel app plus local dev
  // and :4173 preview used for Lighthouse/PWA audits); redirects need one URL.
  frontendOrigins: (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  frontendUrl,
  apiBase: `http://localhost:${number(process.env.PORT, 4000)}/api/v1`,
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  paymentProvider: process.env.PAYMENT_PROVIDER || 'demo',
  mayaBaseUrl: process.env.MAYA_BASE_URL || 'https://pg-sandbox.paymaya.com',
  mayaSuccessUrl: process.env.MAYA_SUCCESS_URL || `${frontendUrl}/payment/success`,
  mayaFailureUrl: process.env.MAYA_FAILURE_URL || `${frontendUrl}/payment/failed`,
  mayaCancelUrl: process.env.MAYA_CANCEL_URL || `${frontendUrl}/cart`,
  mayaApiKey: process.env.MAYA_API_KEY || '',
  mayaApiSecret: process.env.MAYA_API_SECRET || '',
  paymongoSecretKey: process.env.PAYMONGO_SECRET_KEY || '',
  aiProvider: process.env.AI_PROVIDER || 'none',
  aiApiKey: process.env.AI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'gemini-3.8-flash',
};

export const hasSupabase = Boolean(config.supabaseUrl && config.supabaseServiceKey);
export const isDemoPayments = config.paymentProvider === 'demo' || (!config.mayaApiKey && !config.paymongoSecretKey);
