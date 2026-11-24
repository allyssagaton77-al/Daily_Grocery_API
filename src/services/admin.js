import { hasSupabase } from '../config.js';
import { db } from '../lib/db.js';
import { memory, newId } from '../lib/memory.js';
import { shape as shapePublic } from './catalog.js';
import { listOrders, updateStatus } from './orders.js';

export async function listAdminProducts() {
  if (!hasSupabase) {
    return memory.products.map((p) => ({
      id: p.id, name: p.name, price: p.price, stock: p.stock,
      unit: p.unit, description: p.description, image: p.image,
      categoryId: p.categoryId, isActive: true,
    }));
  }
  const { data, error } = await db.from('products').select('*, categories(id,name,slug)').order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(shapePublic);
}

export async function saveProduct(payload) {
  const { id, name, price, stock, unit, description, categoryId, imageUrl } = payload;
  if (!hasSupabase) {
    if (id) {
      const product = memory.products.find((p) => p.id === id);
      if (!product) return null;
      Object.assign(product, { name, price: Number(price), stock: Number(stock), unit, description, categoryId, image: imageUrl || product.image });
      return product;
    }
    const product = {
      id: newId(), name, price: Number(price), stock: Number(stock), unit: unit || 'pcs',
      description: description || '', categoryId: categoryId || memory.categories[0].id,
      image: imageUrl || null, rating: 0, tags: [], isFeatured: false,
    };
    memory.products.push(product);
    return product;
  }

  const row = {
    name,
    price: Number(price),
    stock: Number(stock),
    unit: unit || 'pcs',
    description: description || null,
    category_id: categoryId || null,
    image_url: imageUrl || null,
    slug: `${name || 'product'}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + `-${Date.now().toString(36)}`,
  };
  if (id) {
    const { data, error } = await db.from('products').update(row).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await db.from('products').insert(row).select().single();
  if (error) throw error;
  return data;
}

export const listAdminOrders = () => listOrders(null, true);
export const changeOrderStatus = (id, status) => updateStatus(id, status);
