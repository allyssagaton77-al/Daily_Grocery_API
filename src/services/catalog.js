import { hasSupabase } from '../config.js';
import { db } from '../lib/db.js';
import { memory } from '../lib/memory.js';

export const shape = (p) => ({
  id: p.id,
  name: p.name,
  slug: p.slug,
  description: p.description,
  price: Number(p.price ?? 0),
  compareAtPrice: p.compare_at_price ? Number(p.compare_at_price) : p.compareAtPrice ?? null,
  stock: Number(p.stock ?? 0),
  unit: p.unit,
  image: p.image_url || p.image || null,
  imageUrl: p.image_url || p.image || null,
  rating: Number(p.rating ?? 0),
  tags: p.tags || [],
  category: p.categories
    ? { id: p.categories.id, name: p.categories.name, slug: p.categories.slug }
    : p.category || null,
  isFeatured: p.is_featured ?? p.isFeatured ?? false,
});

const sortProducts = (list, sort) => {
  const copy = [...list];
  if (sort === 'price_asc') return copy.sort((a, b) => a.price - b.price);
  if (sort === 'price_desc') return copy.sort((a, b) => b.price - a.price);
  if (sort === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name));
  return copy.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
};

export async function listCategories() {
  if (!hasSupabase) return memory.categories.map(({ id, name, slug, icon }) => ({ id, name, slug, icon }));
  const { data, error } = await db.from('categories').select('id,name,slug,icon').order('sort_order');
  if (error) throw error;
  return data;
}

export async function listProducts(params = {}) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(48, Math.max(1, Number(params.limit) || 12));

  if (!hasSupabase) {
    let list = memory.products.map((p) => shape({
      ...p,
      category: memory.categories.find((c) => c.id === p.categoryId) || null,
    }));
    if (params.q) {
      const q = String(params.q).toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(q)) ||
        (p.category?.name || '').toLowerCase().includes(q),
      );
    }
    if (params.category) list = list.filter((p) => p.category?.id === params.category || p.category?.slug === params.category);
    if (params.inStock) list = list.filter((p) => p.stock > 0);
    if (params.featured) list = list.filter((p) => p.isFeatured);
    list = sortProducts(list, params.sort);
    return { items: list.slice((page - 1) * limit, page * limit), meta: { page, limit, total: list.length, totalPages: Math.ceil(list.length / limit) } };
  }

  let query = db.from('products').select('*, categories(id,name,slug)', { count: 'exact' }).eq('is_active', true);
  if (params.q) query = query.or(`name.ilike.%${params.q}%,description.ilike.%${params.q}%`);
  if (params.category) query = query.eq('category_id', params.category);
  if (params.inStock) query = query.gt('stock', 0);
  if (params.featured) query = query.eq('is_featured', true);
  if (params.sort === 'price_asc') query = query.order('price', { ascending: true });
  else if (params.sort === 'price_desc') query = query.order('price', { ascending: false });
  else if (params.sort === 'name') query = query.order('name', { ascending: true });
  else query = query.order('is_featured', { ascending: false }).order('name');

  const { data, error, count } = await query.range((page - 1) * limit, page * limit - 1);
  if (error) throw error;
  return {
    items: data.map(shape),
    meta: { page, limit, total: count ?? data.length, totalPages: Math.ceil((count ?? data.length) / limit) },
  };
}

export async function getProduct(id) {
  if (!hasSupabase) {
    const p = memory.products.find((item) => item.id === id || item.slug === id);
    if (!p) return null;
    return shape({ ...p, category: memory.categories.find((c) => c.id === p.categoryId) || null });
  }
  const isUuid = /^[0-9a-f-]{36}$/i.test(id);
  const { data, error } = await db.from('products')
    .select('*, categories(id,name,slug)')
    .eq(isUuid ? 'id' : 'slug', id)
    .maybeSingle();
  if (error) throw error;
  return data ? shape(data) : null;
}

export async function getReviews(productId) {
  if (!hasSupabase) return memory.reviews.filter((r) => r.productId === productId || r.productId === (memory.products.find((p) => p.id === productId || p.slug === productId)?.id));
  const product = await getProduct(productId);
  if (!product) return [];
  const { data, error } = await db.from('product_reviews').select('id,rating,body,created_at,user_id').eq('product_id', product.id).order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((r) => ({ id: r.id, rating: r.rating, body: r.body, author: 'Verified buyer', createdAt: r.created_at }));
}

export async function getRelated(productId) {
  const product = await getProduct(productId);
  if (!product) return [];
  const all = (await listProducts({ limit: 48 })).items;
  return all.filter((p) => p.id !== product.id && (p.category?.id === product.category?.id || p.isFeatured)).slice(0, 4);
}

export async function findProducts(query, limit = 6) {
  if (!hasSupabase) {
    const q = String(query || '').toLowerCase();
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    return memory.products
      .filter((p) => !q || words.some((w) =>
        p.name.toLowerCase().includes(w) ||
        (p.description || '').toLowerCase().includes(w) ||
        (p.tags || []).some((t) => t.includes(w)),
      ))
      .slice(0, limit)
      .map((p) => shape({ ...p, category: memory.categories.find((c) => c.id === p.categoryId) || null }));
  }
  const rows = await db.rpc('match_products', { p_query: query, p_limit: limit });
  return (rows || []).map((r) => ({
    id: r.id, name: r.name, description: r.description,
    price: Number(r.price), image: r.image_url, imageUrl: r.image_url,
    stock: r.stock, rating: Number(r.rating || 0), category: { name: r.category },
  }));
}
