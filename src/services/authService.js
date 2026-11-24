import { hasSupabase } from '../config.js';
import { supabase, supabaseAuth } from '../lib/db.js';
import { memory, newId } from '../lib/memory.js';

const shapeUser = (row) => ({
  id: row.id,
  fullName: row.full_name || row.fullName || row.user_metadata?.full_name || row.email?.split('@')[0],
  email: row.email,
  phone: row.phone || null,
  role: row.role || 'customer',
});

export async function register(payload) {
  const { name, email, password, phone } = payload;
  if (!hasSupabase) {
    if (memory.users.size && [...memory.users.values()].some((u) => u.email === email)) {
      throw Object.assign(new Error('Email already registered'), { status: 409, code: 'EMAIL_TAKEN' });
    }
    const user = { id: newId(), fullName: name, email, phone: phone || null, role: 'customer', password };
    memory.users.set(user.id, user);
    return { token: `demo.${user.id}`, user: shapeUser(user) };
  }

  const { data, error } = await supabaseAuth.auth.signUp({
    email,
    password,
    options: { data: { full_name: name, phone: phone || null } },
  });
  if (error) throw Object.assign(error, { status: 422, code: 'REGISTRATION_FAILED' });

  // With email confirmation enabled, signUp returns no session. Use the
  // service-role admin API to confirm the new user, then sign them in so the
  // client always receives a usable token (no mailbox needed for class demos).
  let session = data.session;
  if (!session && data.user) {
    try {
      await supabase.auth.admin.updateUserById(data.user.id, { email_confirm: true });
    } catch {
      // If admin confirm is unavailable, the fallback sign-in below still tries.
    }
    const { data: signed } = await supabaseAuth.auth.signInWithPassword({ email, password });
    session = signed?.session || null;
  }

  const user = data.user;
  return { token: session?.access_token || null, user: shapeUser(user) };
}

export async function login({ email, password }) {
  if (!hasSupabase) {
    const user = [...memory.users.values()].find((u) => u.email === email && u.password === password);
    if (!user) throw Object.assign(new Error('Invalid email or password'), { status: 401, code: 'INVALID_CREDENTIALS' });
    return { token: `demo.${user.id}`, user: shapeUser(user) };
  }

  const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
  if (error) throw Object.assign(error, { status: 401, code: 'INVALID_CREDENTIALS' });
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
  return { token: data.session.access_token, user: shapeUser({ ...data.user, ...(profile || {}) }) };
}

export async function userFromToken(token) {
  if (!token) return null;
  if (!hasSupabase) {
    if (!token.startsWith('demo.')) return null;
    const user = memory.users.get(token.slice(5));
    return user ? shapeUser(user) : null;
  }
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
  return shapeUser({ ...data.user, ...(profile || {}) });
}
