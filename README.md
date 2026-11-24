# Daily Grocery — Express.js Backend

This is the trusted backend. It owns the database, business rules, coupon validation,
payment sessions and AI provider calls. No payment secrets or AI keys ever reach the frontend.

## Run

```bash
cd backend
npm install
cp .env.example .env
# Optional: fill Supabase URL + service role key to use the real database.
# With no keys, an in-memory demo dataset is used so you can test immediately.
npm run dev
```

API base: `http://localhost:4000/api/v1` · Health check: `http://localhost:4000/health`

## Database

Paste `backend/supabase/schema.sql` into **Supabase → SQL Editor → Run**, then set
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`.

## Payment flow

- `POST /api/v1/checkout` returns `{ checkoutUrl, orderId }` and the browser redirects there.
- With no gateway keys, a **local sandbox page** is returned at `/api/v1/payments/demo/checkout`
  so you can demonstrate the full redirect → return flow in class. The Maya sandbox shows a
  clean card form (card number, expiry, CVV) with no pre-filled values or test-card list.
  Press **Pay** — it redirects to `/payment/success` and the backend marks the order paid.
- Return pages only read `GET /api/v1/orders/:id`; only the backend marks an order paid.
- Real Maya Checkout uses `MAYA_BASE_URL` (sandbox `https://pg-sandbox.paymaya.com`,
  production `https://pg.maya.ph`) plus your `MAYA_API_KEY` (public key). The old
  `https://pg-api.maya.ph/v1/checkout` endpoint is no longer used.
- Maya return URLs are configurable: `MAYA_SUCCESS_URL`, `MAYA_FAILURE_URL`, and
  `MAYA_CANCEL_URL`. The backend adds `?order_id=...` automatically. The frontend
  also accepts `/payment-success` and `/payment-failed` as aliases.

## AI

`POST /api/v1/ai/recommendations` is a grounded, intent-based assistant:

- `price` — "How much are apples?" → exact catalog price and unit
- `availability` — "Do you have fresh milk?" → confirms only catalog items
- `category` — "What fruits do you have?" → lists that category with prices
- `budget` — "Under ₱100" / "cheapest fruit" → sorted real prices
- `coupon` / `payment` / `orders` / `catalog` — answers from known app facts
- `recommend` — "healthy breakfast" uses keyword and synonym scoring over real products

With `AI_PROVIDER=none` all answers are generated locally from the catalog. With a
configured Gemini/OpenAI key, the provider writes recommendation answers and can also
answer general knowledge questions when nothing in the catalog matches. Prices, coupons,
payment, availability and category answers stay deterministic so the app never invents
store facts. Use `AI_MODEL=gemini-3.8-flash` (or your provider's current model) — the old
`gemini-2.0-flash` model has been retired. Requests time out after 8 seconds and fall
back to the verified local answer (marked `degraded: true`), so the chat keeps working
when Gemini is overloaded.

## Routes

`/auth`, `/categories`, `/products`, `/cart`, `/coupons/validate`, `/payments/methods`,
`/checkout`, `/orders`, `/ai`, `/admin`, `/payments/demo`.
