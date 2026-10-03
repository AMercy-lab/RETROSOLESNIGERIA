-- =====================================================================
-- RSN — TEMPORARY sample products (the same 8 the storefront shows today).
--
-- Optional: run this once in the Supabase SQL Editor AFTER the migrations,
-- so there are products to test with. Delete or deactivate them when the
-- real products are added through the admin dashboard.
-- Prices are in kobo (₦85,000 = 8,500,000).
-- Needs every migration to have run first (availability and sizes come from
-- migration 20261004090000).
-- =====================================================================

insert into public.products
  (slug, name, description, category_id, price_kobo, stock_quantity, audience, tag, keywords, availability, sizes)
select s.slug, s.name, s.description, c.id, s.price_kobo, s.stock, s.audience::public.product_audience, s.tag, s.keywords,
  s.availability::public.product_availability, s.sizes
from (values
  ('retro-high-85', 'Retro High ''85',
    'High-top leather sneaker with a padded collar and a bold red sole.',
    'sneakers', 8500000, 10, 'unisex', 'New', array['high top', 'leather', 'red'],
    'available', array['40','41','42','43','44','45']),
  ('oxford-wingtip-brogue', 'Oxford Wingtip Brogue',
    'Classic tan leather brogue for the office, weddings and owambe.',
    'brogues', 7200000, 10, 'men', null, array['oxford', 'tan', 'leather', 'formal'],
    'confirm_to_purchase', array['40','41','42','43','44','45']),
  ('heavyweight-street-tee', 'Heavyweight Street Tee',
    'Oversized cotton t-shirt with a boxy fit. Everyday streetwear essential.',
    'street-t-shirts', 1800000, 10, 'men', 'Hot', array['oversized', 'cotton', 'tee'],
    'available', array['S','M','L','XL','XXL']),
  ('everyday-slide', 'Everyday Slide',
    'Cushioned rubber slide for home, the beach and quick runs.',
    'slides', 2200000, 10, 'unisex', null, array['rubber', 'pam', 'palm'],
    'subject_to_availability', array['40','41','42','43','44','45']),
  ('classic-white-court', 'Classic White Court',
    'Clean all-white low-top sneaker that goes with everything.',
    'sneakers', 6800000, 10, 'women', 'New', array['white', 'low top', 'court'],
    'confirm_to_purchase', array['36','37','38','39','40','41']),
  ('slim-fit-corporate-shirt', 'Slim-Fit Corporate Shirt',
    'Crisp cotton office shirt with a tailored slim fit.',
    'corporate-shirts', 2400000, 10, 'men', null, array['office', 'formal', 'cotton'],
    'available', array['S','M','L','XL']),
  ('washed-black-jeans', 'Washed Black Jeans',
    'Straight-leg denim trousers in a faded black wash.',
    'jeans-trousers', 3500000, 10, 'men', null, array['denim', 'black', 'straight leg'],
    'subject_to_availability', array['30','32','34','36','38']),
  ('street-logo-cap', 'Street Logo Cap',
    'Structured six-panel baseball cap with an adjustable strap.',
    'caps', 1200000, 10, 'unisex', 'Hot', array['baseball cap', 'hat', 'snapback'],
    'available', array[]::text[])
) as s (slug, name, description, category_slug, price_kobo, stock, audience, tag, keywords, availability, sizes)
join public.categories c on c.slug = s.category_slug
on conflict (slug) do nothing;
