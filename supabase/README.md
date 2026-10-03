# RSN database (Supabase)

This folder holds the database design as SQL files. Running them builds the
tables, security rules and storage buckets in your Supabase project.

## Files

| File | What it does |
| --- | --- |
| `migrations/20261003120000_initial_schema.sql` | Tables: profiles, categories, products, images, orders, payments, proofs, shopping requests, store settings |
| `migrations/20261003120100_security_policies.sql` | Row Level Security: who may read/change what |
| `migrations/20261003120200_storage_buckets.sql` | Storage buckets `catalog-images` (public) and `payment-proofs` (private) |
| `migrations/20261003120300_initial_store_data.sql` | The real categories and the store-settings row |
| `migrations/20261004090000_product_availability_and_sizes.sql` | One availability status per product, and optional sizes |
| `migrations/20261005090000_checkout_foundations.sql` | Checkout rules: RSN confirmation (3 h) and payment (1 h) deadlines, confirmations, partly-unavailable orders, guest orders, payment checks |
| `seed.sql` | OPTIONAL temporary sample products for testing |

## Applying them (first time)

In the Supabase dashboard → **SQL Editor** → **New query**, paste and **Run**
each migration file **in order** (by the number at the start of the name),
then optionally `seed.sql`. Run each file only once.

## Making yourself an admin

1. Sign in to the website once (available after the sign-in stage), so your user exists.
2. In the SQL Editor, run (with your email):

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'you@example.com';
```

## Changing the database later

Never edit a migration that has already been run. Add a new file with a later
number instead, e.g. `migrations/20261101090000_add_product_sizes.sql`.
