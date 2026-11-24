import { randomUUID } from 'node:crypto';

// Used only when Supabase credentials are absent (local demo). Everything here
// lives in memory and disappears on restart — the real backend uses Postgres.
const img = (id) => `https://images.unsplash.com/${id}?w=600&h=600&fit=crop`;

export const memory = {
  categories: [
    { id: 'c-fruits', name: 'Fruits', slug: 'fruits', icon: 'heart' },
    { id: 'c-veg', name: 'Vegetables', slug: 'vegetables', icon: 'leaf' },
    { id: 'c-dairy', name: 'Dairy & Eggs', slug: 'dairy-eggs', icon: 'package' },
    { id: 'c-bakery', name: 'Bakery', slug: 'bakery', icon: 'bag' },
    { id: 'c-drinks', name: 'Beverages', slug: 'beverages', icon: 'card' },
  ],
  products: [
    { id: 'apple', name: 'Apples', slug: 'apples', categoryId: 'c-fruits', price: 145, compareAtPrice: 169, stock: 48, unit: 'kg', image: img('photo-1560806887-1e4cd0b6cbd6'), rating: 4.8, tags: ['fruit', 'fresh'], isFeatured: true, description: 'Crisp red apples, hand-picked for freshness.' },
    { id: 'orange', name: 'Fresh Orange', slug: 'fresh-orange', categoryId: 'c-fruits', price: 89, stock: 72, unit: 'kg', image: img('photo-1547514701-42782101795e'), rating: 4.7, tags: ['fruit', 'citrus'], isFeatured: true, description: 'Juicy oranges packed with vitamin C.' },
    { id: 'grapes', name: 'Grapes', slug: 'grapes', categoryId: 'c-fruits', price: 120, compareAtPrice: 139, stock: 35, unit: 'pack', image: img('photo-1537640538966-79f369143f8f'), rating: 4.6, tags: ['fruit', 'snack'], isFeatured: true, description: 'Sweet seedless grapes, chilled and ready.' },
    { id: 'strawberry', name: 'Strawberry', slug: 'strawberry', categoryId: 'c-fruits', price: 198, stock: 22, unit: 'pack', image: img('photo-1464965911861-746a04b4bca6'), rating: 4.9, tags: ['fruit', 'berry'], isFeatured: true, description: 'Farm-fresh strawberries, perfect for desserts.' },
    { id: 'lemon', name: 'Lemon', slug: 'lemon', categoryId: 'c-fruits', price: 65, stock: 90, unit: 'pcs', image: img('photo-1590502593747-42a996133562'), rating: 4.5, tags: ['fruit', 'citrus'], isFeatured: false, description: 'Zesty lemons for drinks and cooking.' },
    { id: 'figs', name: 'Figs', slug: 'figs', categoryId: 'c-fruits', price: 175, stock: 18, unit: 'pack', image: img('photo-1600428877878-4a0f23f6f9f2'), rating: 4.4, tags: ['fruit'], isFeatured: false, description: 'Ripe, naturally sweet figs.' },
    { id: 'watermelon', name: 'Watermelon', slug: 'watermelon', categoryId: 'c-fruits', price: 149, stock: 26, unit: 'pcs', image: img('photo-1563114773-84221bd62daa'), rating: 4.7, tags: ['fruit'], isFeatured: true, description: 'Cool, refreshing watermelon.' },
    { id: 'banana', name: 'Banana', slug: 'banana', categoryId: 'c-fruits', price: 58, stock: 110, unit: 'kg', image: img('photo-1571771894821-ce9b6c11b08e'), rating: 4.8, tags: ['fruit', 'breakfast'], isFeatured: true, description: 'Energy-packed bananas.' },
    { id: 'capsicum', name: 'Capsicum', slug: 'capsicum', categoryId: 'c-veg', price: 95, stock: 40, unit: 'pcs', image: img('photo-1563565375-f3fdfdbefa83'), rating: 4.5, tags: ['vegetable', 'salad'], isFeatured: true, description: 'Colorful bell peppers.' },
    { id: 'tomato', name: 'Tomatoes', slug: 'tomatoes', categoryId: 'c-veg', price: 72, stock: 64, unit: 'kg', image: img('photo-1546470427-e5b89a2e8b17'), rating: 4.6, tags: ['vegetable'], isFeatured: true, description: 'Plump tomatoes for everyday cooking.' },
    { id: 'potato', name: 'Potatoes', slug: 'potatoes', categoryId: 'c-veg', price: 62, stock: 80, unit: 'kg', image: img('photo-1518977676601-b53f82aba655'), rating: 4.4, tags: ['vegetable'], isFeatured: false, description: 'All-purpose potatoes.' },
    { id: 'cabbage', name: 'Cabbage', slug: 'cabbage', categoryId: 'c-veg', price: 55, stock: 45, unit: 'pcs', image: img('photo-1594282486552-05b4d80fbb9f'), rating: 4.3, tags: ['vegetable'], isFeatured: false, description: 'Fresh, tightly packed cabbage.' },
    { id: 'carrot', name: 'Carrots', slug: 'carrots', categoryId: 'c-veg', price: 68, stock: 55, unit: 'kg', image: img('photo-1598170845058-32b9d6a5da37'), rating: 4.6, tags: ['vegetable'], isFeatured: false, description: 'Sweet crunchy carrots.' },
    { id: 'milk', name: 'Fresh Milk', slug: 'fresh-milk', categoryId: 'c-dairy', price: 98, stock: 38, unit: 'L', image: img('photo-1550583724-b2692b85b150'), rating: 4.7, tags: ['dairy', 'breakfast'], isFeatured: true, description: 'Farm-fresh whole milk, 1 L.' },
    { id: 'eggs', name: 'Free-range Eggs', slug: 'free-range-eggs', categoryId: 'c-dairy', price: 135, stock: 30, unit: 'dozen', image: img('photo-1518569656558-1f25e69d93d7'), rating: 4.8, tags: ['eggs', 'breakfast'], isFeatured: true, description: 'A dozen free-range eggs.' },
    { id: 'bread', name: 'Artisan Bread', slug: 'artisan-bread', categoryId: 'c-bakery', price: 110, stock: 20, unit: 'loaf', image: img('photo-1509440159596-0249088772ff'), rating: 4.9, tags: ['bakery'], isFeatured: true, description: 'Freshly baked sourdough loaf.' },
    { id: 'coffee', name: 'Ground Coffee', slug: 'ground-coffee', categoryId: 'c-drinks', price: 249, compareAtPrice: 279, stock: 25, unit: 'pack', image: img('photo-1447933601403-0c6688de566e'), rating: 4.8, tags: ['coffee'], isFeatured: true, description: 'Rich aromatic ground coffee, 250 g.' },
  ],
  reviews: [
    { id: 'r1', productId: 'apple', author: 'Maria S.', rating: 5, body: 'Always crisp and fresh. My go-to fruit!' },
    { id: 'r2', productId: 'apple', author: 'Juan D.', rating: 4, body: 'Great value for the price.' },
    { id: 'r3', productId: 'milk', author: 'Ana P.', rating: 5, body: 'Delivered cold and on time.' },
  ],
  coupons: [
    { id: 'coupon1', code: 'WELCOME10', description: '10% off your first order', discountType: 'percentage', discountValue: 10, minSubtotal: 300, maxDiscount: 150, expiresAt: null, usageLimit: 1000, usedCount: 0, isActive: true },
    { id: 'coupon2', code: 'FRESH20', description: '₱20 off fresh picks', discountType: 'fixed', discountValue: 20, minSubtotal: 200, maxDiscount: null, expiresAt: null, usageLimit: 500, usedCount: 0, isActive: true },
  ],
  paymentMethods: [
    { code: 'maya', label: 'Maya', description: 'Sandbox · GCash and cards', isActive: true },
    { code: 'paymongo', label: 'PayMongo', description: 'Sandbox · cards and e-wallets', isActive: true },
  ],
  users: new Map(),
  carts: new Map(),
  orders: new Map(),
  aiQueries: [],
  idempotency: new Map(),
  orderCounter: 1001,
};

export const newId = () => randomUUID();
