import { config } from '../config.js';
import { ApiError } from '../lib/response.js';
import { listCategories, listProducts } from './catalog.js';

// Query terms are expanded into catalog-friendly words so "healthy breakfast"
// can still match milk, eggs, fruit, etc. even with AI_PROVIDER=none.
const EXPANSIONS = {
  breakfast: ['egg', 'milk', 'bread', 'coffee', 'banana', 'strawberry', 'apple'],
  healthy: ['fruit', 'vegetable', 'fresh', 'apple', 'orange', 'carrot', 'grapes'],
  kids: ['banana', 'apple', 'grape', 'strawberry', 'milk'],
  snack: ['banana', 'grape', 'apple', 'fig', 'coffee'],
  pasta: ['tomato', 'capsicum', 'cabbage', 'carrot', 'bread'],
  salad: ['tomato', 'capsicum', 'cabbage', 'carrot', 'lemon'],
  pancake: ['milk', 'egg', 'banana', 'strawberry', 'bread'],
  baking: ['milk', 'egg', 'bread', 'banana'],
  drink: ['coffee', 'milk', 'lemon'],
  drinks: ['coffee', 'milk', 'lemon'],
  dairy: ['milk', 'egg'],
  fruit: ['apple', 'orange', 'grape', 'strawberry', 'watermelon', 'banana', 'lemon', 'fig'],
  fruits: ['apple', 'orange', 'grape', 'strawberry', 'watermelon', 'banana', 'lemon', 'fig'],
  vegetable: ['tomato', 'capsicum', 'potato', 'cabbage', 'carrot'],
  vegetables: ['tomato', 'capsicum', 'potato', 'cabbage', 'carrot'],
  fresh: ['apple', 'orange', 'milk', 'bread', 'strawberry'],
};

const STOP_WORDS = new Set([
  'i', 'im', 'need', 'want', 'like', 'something', 'some', 'for', 'a', 'an', 'the',
  'with', 'of', 'me', 'my', 'what', 'goes', 'well', 'can', 'you', 'give', 'please',
  'help', 'find', 'looking', 'get', 'buy', 'today', 'good', 'make', 'how', 'much',
  'many', 'is', 'are', 'do', 'does', 'did', 'have', 'has', 'carry', 'cost', 'costs',
  'price', 'prices', 'tell', 'about', 'there', 'your', 'this', 'that', 'it', 'and',
  'or', 'ba', 'may', 'meron', 'magkano', 'presyo', 'ano', 'ang', 'ng', 'sa', 'po',
]);

const WORD_ALIASES = {
  apples: 'apple', apple: 'apple',
  tomatoes: 'tomato', tomato: 'tomato',
  potatoes: 'potato', potato: 'potato',
  oranges: 'orange', orange: 'orange',
  eggs: 'egg', egg: 'egg',
  bananas: 'banana', banana: 'banana',
  grapes: 'grape', grape: 'grape',
  carrots: 'carrot', carrot: 'carrot',
  strawberries: 'strawberry', strawberry: 'strawberry',
  figs: 'fig', fig: 'fig',
  lemons: 'lemon', lemon: 'lemon',
  mangoes: 'mango', mango: 'mango',
};

// Only broad groups live here. Specific items (eggs, bread) stay as product matches.
const CATEGORY_ALIASES = {
  fruit: 'Fruits', fruits: 'Fruits',
  vegetable: 'Vegetables', vegetables: 'Vegetables', veg: 'Vegetables',
  dairy: 'Dairy & Eggs',
  bakery: 'Bakery',
  beverage: 'Beverages', beverages: 'Beverages', drink: 'Beverages', drinks: 'Beverages',
};

const unique = (list) => [...new Set(list)];
const money = (value) => `₱${Number(value).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
const words = (text) => String(text || '')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/)
  .filter(Boolean);
const normalizeWord = (word) => WORD_ALIASES[word]
  || (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word);
const tokens = (text) => words(text).map(normalizeWord);
const categoryOf = (product) => product.category?.name || '';
const joinList = (items) => {
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
};
const productLine = (product) => `${product.name} — ${money(product.price)}${product.unit ? ` per ${product.unit}` : ''}`;

function detectCategory(normalized) {
  const set = new Set(tokens(normalized));
  for (const [alias, category] of Object.entries(CATEGORY_ALIASES)) {
    if (set.has(alias)) return category;
  }
  return null;
}

function detectIntent(normalized) {
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|thanks|thank you|who are you|your name|what can you do|help)\b/.test(normalized)) return 'help';
  if (/\b(coupon|promo|voucher|discount|welcome10)\b/.test(normalized)) return 'coupon';
  if (/\b(payment|payments|pay|maya|paymongo|checkout|gcash)\b/.test(normalized)) return 'payment';
  if (/\b(order|orders|delivery|deliver|shipping)\b/.test(normalized)) return 'orders';
  if (/\b(how many|total products)\b/.test(normalized)) return 'catalog';
  if (/\b(magkano|presyo|how much|price|prices|cost|costs)\b/.test(normalized)) {
    if (/\b(cheapest|pinakamura|most expensive|pinakamahal|lowest|highest)\b/.test(normalized)) return 'budget';
    return 'price';
  }
  if (/\b(cheapest|pinakamura|most expensive|pinakamahal|lowest|highest|budget|under|below|less than|abot)\b/.test(normalized)) return 'budget';

  const category = detectCategory(normalized);
  if (category && /\b(what|which|list|show|have|carry|categories|category|meron|may|ano)\b/.test(normalized)) return 'category';
  if (/\b(do you have|do you carry|available|in stock|may|meron)\b/.test(normalized)) return 'availability';
  return 'recommend';
}

function matchProducts(catalog, normalized, { useExpansions = false, limit = 6 } = {}) {
  const base = unique(words(normalized)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .map(normalizeWord));
  const terms = useExpansions
    ? unique(base.flatMap((word) => [word, ...(EXPANSIONS[word] || [])]))
    : base;
  if (!terms.length) return [];

  // Factual questions (price/availability) must match every word in the product
  // name or tags. Otherwise "oat milk" would wrongly confirm "Fresh Milk".
  const strict = !useExpansions;

  return catalog.items
    .map((product) => {
      const nameTokens = tokens(product.name);
      const name = nameTokens.join(' ');
      const tags = tokens((product.tags || []).join(' ')).join(' ');
      const category = tokens(categoryOf(product)).join(' ');
      const description = tokens(product.description).join(' ');
      let score = 0;
      const matched = new Set();

      terms.forEach((term) => {
        if (nameTokens.includes(term)) {
          score += 9;
          matched.add(term);
        } else if (!strict && name.includes(term)) {
          score += 5;
          matched.add(term);
        } else if (tags.includes(term)) {
          score += 4;
          matched.add(term);
        } else if (!strict && category.includes(term)) {
          score += 3;
          matched.add(term);
        } else if (!strict && description.includes(term)) {
          score += 1;
          matched.add(term);
        }
      });

      if (!score) return null;
      if (strict && matched.size < terms.length) return null;
      score += Number(product.rating || 0) / 10 + (product.isFeatured ? 0.5 : 0);
      const fromUser = base.filter((word) => matched.has(word));
      return {
        ...product,
        // Only words the user actually typed — never expansion terms.
        matchReason: unique(fromUser).slice(0, 3).join(', '),
        _score: score,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...product }) => product);
}

function groundedMatches(catalog, query) {
  const ranked = matchProducts(catalog, query, { useExpansions: true });
  if (ranked.length) return ranked;
  // No verified match: let the answer say so instead of inventing a suggestion.
  return [];
}

function localAnswer({ intent, query, normalized, catalog, allCategories = [], products }) {
  const all = catalog.items;
  const category = detectCategory(normalized);
  const categories = allCategories.length ? allCategories : unique(all.map(categoryOf).filter(Boolean));

  switch (intent) {
    case 'help':
      return 'I’m the Daily Grocery assistant. I answer using our own store catalog, so I won’t guess. Try “How much are apples?”, “Do you have fresh milk?”, “What fruits do you have?”, or “I need something for a healthy breakfast.”';

    case 'coupon':
      return 'Use coupon WELCOME10 for 10% off, up to ₱150, on orders of at least ₱300. You need to be signed in to apply it in the cart.';

    case 'payment':
      return 'Checkout supports Maya and PayMongo sandbox options. For this class demo, payments run in local sandbox mode, so no real money is charged.';

    case 'orders':
      return 'I can’t see individual orders from this chat. Open My Orders in the app to view your receipts and order history.';

    case 'catalog':
      return `We have ${all.length} products across ${categories.length} categories: ${joinList(categories)}. Ask me about any category for prices.`;

    case 'category': {
      if (!category) return 'I can list products by category. Try “What fruits do you have?” or “What vegetables do you have?”';
      const items = all.filter((product) => categoryOf(product) === category);
      if (!items.length) return `I don’t have any products listed under ${category} right now.`;
      return `In ${category}, we have ${joinList(items.slice(0, 8).map(productLine))}.`;
    }

    case 'price': {
      if (!products.length) {
        return 'I don’t have a verified price for that item because it isn’t in our catalog. Ask me about a product you see in the shop, like “How much are apples?”';
      }
      if (products.length === 1) {
        const product = products[0];
        const was = product.compareAtPrice && Number(product.compareAtPrice) > Number(product.price)
          ? ` (was ${money(product.compareAtPrice)})`
          : '';
        return `${product.name}: ${money(product.price)}${product.unit ? ` per ${product.unit}` : ''}${was}.`;
      }
      return `Here are the catalog prices I found: ${joinList(products.slice(0, 5).map(productLine))}.`;
    }

    case 'availability': {
      if (products.length) return `Yes — we carry ${joinList(products.slice(0, 3).map(productLine))}.`;
      const popular = all.filter((product) => product.isFeatured).slice(0, 3);
      return `Sorry, I don’t see that item in our catalog, so I can’t confirm it. Popular verified picks are ${joinList(popular.map(productLine))}.`;
    }

    case 'budget': {
      const match = normalized.match(/\b(under|below|less than|mas mababa sa|abot)\s*(?:php|₱)?\s*(\d+(?:\.\d+)?)/);
      const limit = match ? Number(match[2]) : null;
      const expensive = /\b(most expensive|pinakamahal|highest)\b/.test(normalized);
      const scope = category ? all.filter((product) => categoryOf(product) === category) : all;
      if (!scope.length) return `I don’t have any products listed under ${category} right now.`;

      const sorted = [...scope].sort((a, b) => (expensive ? b.price - a.price : a.price - b.price));
      const shown = limit && !expensive ? sorted.filter((product) => product.price <= limit) : sorted;
      if (limit && !expensive && !shown.length) {
        const lowest = sorted[sorted.length - 1];
        return `Nothing ${category ? `in ${category} ` : ''}is under ${money(limit)}. The lowest price is ${productLine(lowest)}.`;
      }
      const label = expensive
        ? `Our highest-priced${category ? ` ${category.toLowerCase()}` : ''} items are `
        : limit
          ? `Under ${money(limit)}${category ? ` in ${category}` : ''}, we have `
          : category
            ? `The cheapest items in ${category} are `
            : `Our lowest-priced items are `;
      return `${label}${joinList(shown.slice(0, 6).map(productLine))}.`;
    }

    case 'recommend': {
      if (!products.length) {
        return 'I’m not sure what you mean, and I won’t guess. I can answer questions about our catalog — try “How much are apples?”, “Do you have fresh milk?”, or “What fruits do you have?”';
      }
      const picks = joinList(products.slice(0, 3).map(productLine));
      const reason = products.find((product) => product.matchReason)?.matchReason;
      return reason
        ? `For that, I’d suggest ${picks}. I matched ${reason} from your request, and every price comes from our store catalog.`
        : `For that, I’d suggest ${picks}. These are close catalog matches for what you described, and every price comes from our store catalog.`;
    }

    default:
      return 'I’m the Daily Grocery assistant, so I answer using our store catalog only. Ask me about products, prices, or categories and I’ll give you a verified answer.';
  }
}

function providerPrompt(query, products) {
  if (products.length) {
    const facts = products.map(productLine).join('; ');
    return `You are a friendly grocery shopping assistant for Daily Grocery. Use ONLY these verified catalog facts and do not change any name or price: ${facts}. User request: ${query}. Write 1-2 short sentences. Never invent products, prices, or availability.`;
  }
  // No catalog match: allow general answers, but never invent grocery items.
  return `You are the helpful assistant for Daily Grocery, an online grocery store. Answer the user's question briefly and accurately (1-2 sentences). If the question is about groceries, products, prices, or availability, say you can only answer using the store catalog and that no match was found — do not invent products or prices. For general knowledge questions, answer normally.`;
}

async function callProvider(prompt) {
  if (config.aiProvider === 'gemini' && config.aiApiKey) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.aiModel)}:generateContent?key=${encodeURIComponent(config.aiApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json())?.error?.message || ''; } catch { /* ignore */ }
      throw new ApiError(503, 'AI_UNAVAILABLE', 'AI provider is unavailable.', {
        provider: 'gemini',
        status: response.status,
        detail: String(detail).slice(0, 200),
      });
    }
    const payload = await response.json();
    return payload.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  if (config.aiProvider === 'openai' && config.aiApiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.aiApiKey}` },
      body: JSON.stringify({ model: config.aiModel, messages: [{ role: 'user', content: prompt }], max_tokens: 120 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json())?.error?.message || ''; } catch { /* ignore */ }
      throw new ApiError(503, 'AI_UNAVAILABLE', 'AI provider is unavailable.', {
        provider: 'openai',
        status: response.status,
        detail: String(detail).slice(0, 200),
      });
    }
    const payload = await response.json();
    return payload.choices?.[0]?.message?.content || '';
  }

  return '';
}

async function providerAnswer(query, products) {
  const text = await callProvider(providerPrompt(query, products));
  return text.trim() || localAnswer({
    intent: 'recommend',
    query,
    normalized: query.toLowerCase(),
    catalog: { items: products },
    products,
  });
}

export async function recommend(query) {
  const q = String(query || '').trim().slice(0, 280);
  const normalized = q.toLowerCase();
  const [catalog, categoryRows] = await Promise.all([
    listProducts({ limit: 48 }),
    listCategories(),
  ]);
  const allCategories = (categoryRows || []).map((category) => category.name);
  const intent = detectIntent(normalized);
  const category = detectCategory(normalized);

  let products = [];
  if (intent === 'recommend') products = groundedMatches(catalog, q);
  else if (intent === 'price' || intent === 'availability') products = matchProducts(catalog, normalized);
  else if (intent === 'category') products = category ? catalog.items.filter((p) => categoryOf(p) === category) : [];
  else if (intent === 'budget') products = (category ? catalog.items.filter((p) => categoryOf(p) === category) : catalog.items).slice(0, 6);

  let source = 'catalog';
  let degraded = false;
  let answer = localAnswer({ intent, query: q, normalized, catalog, allCategories, products });

  // The provider handles recommendations and general questions. Store facts
  // (prices, coupons, availability) stay deterministic so no number is invented.
  if (intent === 'recommend' && config.aiProvider !== 'none' && config.aiApiKey) {
    try {
      answer = await providerAnswer(q, products);
      source = 'ai';
    } catch {
      // AI busy/invalid/timeout → keep the verified local answer. Never fail the chat.
      degraded = true;
    }
  }

  return {
    answer,
    products,
    source,
    degraded,
    grounded: products.length > 0,
    provider: config.aiProvider,
    intent,
    matchedCount: products.filter((product) => product.matchReason).length,
  };
}

export async function saveQuery(userId, query, answer, products) {
  if (!userId) return;
  if (!config.supabaseUrl) return;
  const { supabase } = await import('../lib/db.js');
  await supabase.from('ai_queries').insert({
    user_id: userId,
    query,
    answer,
    product_ids: products.map((p) => p.id),
  });
}
