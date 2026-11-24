import { hasSupabase } from '../config.js';
import { db } from '../lib/db.js';
import { memory, newId } from '../lib/memory.js';

const money = (value) => Math.round(Number(value || 0) * 100) / 100;

const shapeOrder = (order, items = []) => ({
  id: order.id,
  orderNumber: order.order_number || order.orderNumber,
  status: order.status,
  paymentStatus: order.payment_status || order.paymentStatus,
  paymentProvider: order.payment_provider || order.paymentProvider || null,
  providerPaymentId: order.provider_payment_id || order.providerPaymentId || null,
  subtotal: money(order.subtotal),
  discount: money(order.discount_amount ?? order.discount),
  shippingFee: money(order.shipping_fee ?? order.shippingFee),
  tax: money(order.tax_amount ?? order.tax),
  total: money(order.total),
  shipping: order.shipping_address || order.shipping || {},
  cardLast4: order.card_last4 || null,
  createdAt: order.created_at || order.createdAt,
  paidAt: order.paid_at || order.paidAt || null,
  checkoutUrl: order.checkout_url || order.checkoutUrl || null,
  items: items.map((item) => ({
    id: item.id,
    productId: item.product_id || item.productId,
    name: item.name_snapshot || item.name,
    image: item.image_url || item.image,
    unitPrice: money(item.unit_price || item.unitPrice),
    quantity: item.quantity,
    lineTotal: money(item.line_total || item.lineTotal),
  })),
});

export async function createOrder({ userId, cart, shipping, paymentProvider, totals, couponId, idempotencyKey }) {
  const id = newId();
  // Derive from the UUID so numbers never collide after a server restart.
  const orderNumber = `DG-${id.replace(/-/g, '').slice(0, 10).toUpperCase()}`;
  const base = {
    id,
    order_number: orderNumber,
    user_id: userId,
    status: 'pending_payment',
    payment_status: 'unpaid',
    payment_provider: paymentProvider || null,
    idempotency_key: idempotencyKey,
    subtotal: totals.subtotal,
    discount_amount: totals.discount,
    shipping_fee: totals.shippingFee,
    tax_amount: totals.tax,
    total: totals.total,
    coupon_id: couponId || null,
    shipping_address: shipping,
    created_at: new Date().toISOString(),
  };
  const items = cart.items.map((item) => ({
    id: newId(),
    product_id: item.productId,
    name_snapshot: item.name,
    image_url: item.image,
    unit_price: item.price,
    quantity: item.quantity,
    line_total: item.lineTotal,
  }));

  if (!hasSupabase) {
    memory.orders.set(id, { ...base, items, events: [{ status: 'pending_payment', note: 'Order created', created_at: base.created_at }] });
    return shapeOrder(base, items);
  }

  const { data: order, error } = await db.from('orders').insert(base).select().single();
  if (error) throw error;
  if (items.length) {
    const { error: itemsError } = await db.from('order_items').insert(items.map((i) => ({ ...i, order_id: id })));
    if (itemsError) throw itemsError;
  }
  await db.from('order_events').insert({ order_id: id, status: 'pending_payment', note: 'Order created' });
  return shapeOrder(order, items);
}

export async function setCheckoutUrl(orderId, checkoutUrl, providerPaymentId) {
  if (!hasSupabase) {
    const order = memory.orders.get(orderId);
    if (order) { order.checkout_url = checkoutUrl; order.provider_payment_id = providerPaymentId || null; }
    return;
  }
  await db.from('orders').update({ checkout_url: checkoutUrl, provider_payment_id: providerPaymentId || null }).eq('id', orderId);
}

export async function listOrders(userId, admin = false) {
  if (!hasSupabase) {
    return [...memory.orders.values()]
      .filter((o) => admin || o.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((o) => shapeOrder(o, o.items));
  }
  let query = db.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(100);
  if (!admin) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) throw error;
  return data.map((o) => shapeOrder(o, o.order_items));
}

export async function getOrder(orderId, userId, admin = false) {
  if (!hasSupabase) {
    const order = memory.orders.get(orderId);
    if (!order || (!admin && order.user_id !== userId)) return null;
    return shapeOrder(order, order.items);
  }
  const { data, error } = await db.from('orders').select('*, order_items(*)').eq('id', orderId).maybeSingle();
  if (error) throw error;
  if (!data || (!admin && data.user_id !== userId)) return null;
  return shapeOrder(data, data.order_items);
}

export async function getOrderByNumber(orderNumber) {
  if (!hasSupabase) return [...memory.orders.values()].find((o) => o.order_number === orderNumber) || null;
  const { data } = await db.from('orders').select('*').eq('order_number', orderNumber).maybeSingle();
  return data;
}

export async function markPaid(orderId, providerPaymentId, paidAt = new Date().toISOString()) {
  if (!hasSupabase) {
    const order = memory.orders.get(orderId);
    if (!order) return null;
    order.status = 'paid';
    order.payment_status = 'paid';
    order.paid_at = paidAt;
    if (providerPaymentId) order.provider_payment_id = providerPaymentId;
    order.events.push({ status: 'paid', note: 'Payment confirmed', created_at: paidAt });
    return shapeOrder(order, order.items);
  }
  const { data, error } = await db.from('orders')
    .update({ status: 'paid', payment_status: 'paid', paid_at: paidAt, provider_payment_id: providerPaymentId || null })
    .eq('id', orderId).select('*, order_items(*)').single();
  if (error) throw error;
  await db.from('order_events').insert({ order_id: orderId, status: 'paid', note: 'Payment confirmed' });
  return shapeOrder(data, data.order_items);
}

export async function markCancelled(orderId) {
  if (!hasSupabase) {
    const order = memory.orders.get(orderId);
    if (!order) return null;
    order.status = 'cancelled';
    order.events.push({ status: 'cancelled', note: 'Checkout cancelled', created_at: new Date().toISOString() });
    return shapeOrder(order, order.items);
  }
  const { data, error } = await db.from('orders').update({ status: 'cancelled' }).eq('id', orderId).select('*, order_items(*)').single();
  if (error) throw error;
  return shapeOrder(data, data.order_items);
}

export async function updateStatus(orderId, status) {
  if (!hasSupabase) {
    const order = memory.orders.get(orderId);
    if (!order) return null;
    order.status = status;
    order.events.push({ status, note: 'Updated by admin', created_at: new Date().toISOString() });
    return shapeOrder(order, order.items);
  }
  const { data, error } = await db.from('orders').update({ status }).eq('id', orderId).select('*, order_items(*)').single();
  if (error) throw error;
  await db.from('order_events').insert({ order_id: orderId, status, note: 'Updated by admin' });
  return shapeOrder(data, data.order_items);
}

export async function findByIdempotencyKey(key) {
  if (!key) return null;
  if (!hasSupabase) return memory.idempotency.get(key) || null;
  const { data } = await db.from('orders').select('id').eq('idempotency_key', key).maybeSingle();
  return data?.id || null;
}

export async function rememberIdempotency(key, orderId) {
  if (!key) return;
  if (!hasSupabase) memory.idempotency.set(key, orderId);
}
