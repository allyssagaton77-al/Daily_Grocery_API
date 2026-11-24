import { hasSupabase } from '../config.js';
import { db } from '../lib/db.js';
import { memory, newId } from '../lib/memory.js';
import { getProduct } from './catalog.js';

const summaryFor = (items) => ({
  subtotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
  itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
  discount: 0,
  shippingFee: 0,
  total: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
});

const shapeMemory = (cart) => {
  const items = [...cart.items].map((item) => {
    const product = memory.products.find((p) => p.id === item.productId);
    return {
      id: item.productId,
      productId: item.productId,
      name: product?.name || 'Item',
      price: Number(product?.price || 0),
      image: product?.image || null,
      quantity: item.quantity,
      lineTotal: Number(product?.price || 0) * item.quantity,
      stock: product?.stock ?? 0,
    };
  });
  return { items, summary: summaryFor(items) };
};

async function memoryCart(userId) {
  if (!memory.carts.has(userId)) memory.carts.set(userId, { id: newId(), userId, items: [] });
  return memory.carts.get(userId);
}

export async function getCart(userId) {
  if (!hasSupabase) return shapeMemory(await memoryCart(userId));

  const { data: cart, error: cartError } = await db.from('carts').select('id').eq('user_id', userId).maybeSingle();
  if (cartError) throw cartError;
  if (!cart) return { items: [], summary: summaryFor([]) };

  const { data, error } = await db.from('cart_items')
    .select('id,product_id,quantity,products(id,name,price,image_url,stock,categories(name))')
    .eq('cart_id', cart.id);
  if (error) throw error;

  const items = (data || []).map((row) => ({
    id: row.product_id,
    productId: row.product_id,
    name: row.products?.name || 'Item',
    price: Number(row.products?.price || 0),
    image: row.products?.image_url || null,
    quantity: row.quantity,
    lineTotal: Number(row.products?.price || 0) * row.quantity,
    stock: row.products?.stock ?? 0,
    category: row.products?.categories?.name || null,
  }));
  return { items, summary: summaryFor(items) };
}

async function ensureSupabaseCart(userId) {
  const { data, error } = await db.from('carts').select('id').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (data) return data.id;
  const { data: created, error: createError } = await db.from('carts').insert({ user_id: userId }).select('id').single();
  if (createError) throw createError;
  return created.id;
}

// Safety cap only — stock is intentionally not enforced in this demo store.
const MAX_QUANTITY = 9999;

export async function addItem(userId, productId, quantity = 1) {
  const product = await getProduct(productId);
  if (!product) throw Object.assign(new Error('Product not found'), { status: 404, code: 'PRODUCT_NOT_FOUND' });
  const qty = Math.min(MAX_QUANTITY, Math.max(1, Number(quantity) || 1));

  if (!hasSupabase) {
    const cart = await memoryCart(userId);
    const existing = cart.items.find((i) => i.productId === product.id);
    if (existing) existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + qty);
    else cart.items.push({ productId: product.id, quantity: qty });
    return getCart(userId);
  }

  const cartId = await ensureSupabaseCart(userId);
  const { error } = await db.from('cart_items')
    .upsert({ cart_id: cartId, product_id: product.id, quantity: qty }, { onConflict: 'cart_id,product_id' });
  if (error) throw error;
  return getCart(userId);
}

export async function updateItem(userId, productId, quantity) {
  const qty = Math.min(MAX_QUANTITY, Math.max(1, Number(quantity) || 1));

  if (!hasSupabase) {
    const cart = await memoryCart(userId);
    const item = cart.items.find((i) => i.productId === productId);
    if (!item) throw Object.assign(new Error('Cart item not found'), { status: 404, code: 'CART_ITEM_NOT_FOUND' });
    item.quantity = qty;
    return getCart(userId);
  }

  const { data: cart } = await db.from('carts').select('id').eq('user_id', userId).maybeSingle();
  const { error } = await db.from('cart_items').update({ quantity: qty }).eq('cart_id', cart?.id).eq('product_id', productId);
  if (error) throw error;
  return getCart(userId);
}

export async function removeItem(userId, productId) {
  if (!hasSupabase) {
    const cart = await memoryCart(userId);
    cart.items = cart.items.filter((i) => i.productId !== productId);
    return getCart(userId);
  }
  const { data: cart } = await db.from('carts').select('id').eq('user_id', userId).maybeSingle();
  const { error } = await db.from('cart_items').delete().eq('cart_id', cart?.id).eq('product_id', productId);
  if (error) throw error;
  return getCart(userId);
}

export async function clearCart(userId) {
  if (!hasSupabase) {
    const cart = await memoryCart(userId);
    cart.items = [];
    return getCart(userId);
  }
  const { data: cart } = await db.from('carts').select('id').eq('user_id', userId).maybeSingle();
  if (cart) {
    const { error } = await db.from('cart_items').delete().eq('cart_id', cart.id);
    if (error) throw error;
  }
  return getCart(userId);
}
