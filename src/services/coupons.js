import { hasSupabase } from '../config.js';
import { db } from '../lib/db.js';
import { memory } from '../lib/memory.js';

export async function validateCoupon(code, subtotal) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!hasSupabase) {
    const coupon = memory.coupons.find((c) => c.code === normalized && c.isActive);
    if (!coupon) return { valid: false, code: 'COUPON_EXPIRED', message: 'Coupon is invalid or expired.' };
    if (subtotal < coupon.minSubtotal) return { valid: false, code: 'COUPON_MIN_SUBTOTAL', message: `Minimum spend is ₱${coupon.minSubtotal}.` };
    let discount = coupon.discountType === 'percentage' ? (subtotal * coupon.discountValue) / 100 : coupon.discountValue;
    if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    return { valid: true, code: coupon.code, label: coupon.description, discount: Math.round(discount * 100) / 100, discountType: coupon.discountType, discountValue: coupon.discountValue };
  }

  const result = await db.rpc('validate_coupon', { p_code: normalized, p_subtotal: subtotal });
  if (!result?.valid) {
    return { valid: false, code: result?.code || 'COUPON_EXPIRED', message: 'Coupon is invalid or expired.' };
  }
  return result;
}

export async function listPaymentMethods() {
  if (!hasSupabase) return memory.paymentMethods;
  const { data, error } = await db.from('payment_methods').select('code,label,description').eq('is_active', true).order('sort_order');
  if (error) throw error;
  return data;
}
