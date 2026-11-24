# Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor → New query**.
3. Paste the entire contents of [`schema.sql`](schema.sql) and click **Run**.
4. In **Project Settings → API**, copy:
   - `Project URL`
   - `service_role` key → put these **only** in your Express backend `.env`

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # backend only — NEVER in VITE_ variables
```

5. Create your first admin: sign up normally, then in the Supabase table editor set `public.profiles.role = 'admin'` for that user.
6. The frontend needs only:

```env
VITE_API_BASE_URL=https://your-express-backend.example.com/api/v1
```

## Notes

- RLS is enabled on every table. Shoppers read their own cart/orders; the backend uses the service role to write authoritative totals and payment status.
- `payment_methods` is seeded with `maya` and `paymongo` (sandbox).
- `match_products()` returns only real catalog rows so AI answers stay grounded in actual prices and stock.
- Order tracking was intentionally omitted from the UI; `order_events` is kept server-side as an audit trail only.
