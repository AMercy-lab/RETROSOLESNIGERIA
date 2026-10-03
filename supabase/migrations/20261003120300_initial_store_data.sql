-- =====================================================================
-- RSN — real starting data: the store's categories and the settings row.
-- (The temporary SAMPLE products are separate, in supabase/seed.sql.)
-- =====================================================================

-- The single store-settings row. Fill in the real bank details later
-- (they will be editable from the admin dashboard).
insert into public.store_settings (id) values (1)
on conflict (id) do nothing;

-- Top-level categories
insert into public.categories (name, slug, tagline, sort_order) values
  ('Shoes', 'shoes', 'From statement sneakers to sharp brogues.', 1),
  ('Clothing', 'clothing', 'Boardroom-ready to street-ready.', 2),
  ('Accessories', 'accessories', 'The details that finish the fit.', 3)
on conflict (slug) do nothing;

-- Subcategories, linked to their top-level category by slug
insert into public.categories (parent_id, name, slug, sort_order)
select parent.id, sub.name, sub.slug, sub.sort_order
from (values
  ('shoes', 'Sneakers', 'sneakers', 1),
  ('shoes', 'Brogues', 'brogues', 2),
  ('shoes', 'Boots', 'boots', 3),
  ('shoes', 'Sandals', 'sandals', 4),
  ('shoes', 'Slides', 'slides', 5),
  ('clothing', 'Corporate Shirts', 'corporate-shirts', 1),
  ('clothing', 'Street T-Shirts', 'street-t-shirts', 2),
  ('clothing', 'Jeans Trousers', 'jeans-trousers', 3),
  ('clothing', 'Pant Trousers', 'pant-trousers', 4),
  ('clothing', 'Jerseys', 'jerseys', 5),
  ('accessories', 'Socks', 'socks', 1),
  ('accessories', 'Caps', 'caps', 2),
  ('accessories', 'Jewellery', 'jewellery', 3)
) as sub (parent_slug, name, slug, sort_order)
join public.categories parent on parent.slug = sub.parent_slug
on conflict (slug) do nothing;
