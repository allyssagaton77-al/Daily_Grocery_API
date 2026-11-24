import { createClient } from '@supabase/supabase-js';
import { config, hasSupabase } from '../config.js';

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

/**
 * Service-role client. RLS is bypassed here on purpose — this is the trusted backend.
 * Never call auth.signIn* on this client: it would attach a user JWT and silently
 * downgrade all later data calls from service_role to authenticated (RLS).
 */
export const supabase = hasSupabase
  ? createClient(config.supabaseUrl, config.supabaseServiceKey, clientOptions)
  : null;

/** Separate client for user auth calls only (signUp / signIn / getUser). */
export const supabaseAuth = hasSupabase
  ? createClient(config.supabaseUrl, config.supabaseServiceKey, clientOptions)
  : null;

export const db = {
  from(table) {
    if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
    return supabase.from(table);
  },
  async rpc(name, args = {}) {
    if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw error;
    return data;
  },
};
