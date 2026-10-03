-- =====================================================================
-- RSN — product availability and sizes
--
-- RSN sources products from suppliers rather than holding stock, so each
-- product gets ONE availability status chosen by the admin (not per size):
--   available               = I currently know the supplier has it
--   confirm_to_purchase     = I must confirm with the supplier first
--   subject_to_availability = availability can change, depends on the supplier
--
-- Sizes are separate product information (e.g. 40–45, or S–XL) and are
-- optional: an empty list means the product has no sizes (e.g. a cap).
--
-- stock_quantity is kept so no existing data is lost, but the storefront
-- no longer uses it.
--
-- Security: the existing rules already cover new columns — everyone can read
-- active products, and only admins can change them. No rule changes needed.
-- =====================================================================

create type public.product_availability as enum (
  'available',
  'confirm_to_purchase',
  'subject_to_availability'
);

alter table public.products
  add column availability public.product_availability not null default 'available',
  add column sizes text[] not null default '{}'
    -- no empty sizes ('')
    constraint products_sizes_not_blank check (array_position(sizes, '') is null);

comment on column public.products.availability is
  'One status for the whole product (not per size), chosen by the admin.';
comment on column public.products.sizes is
  'Optional sizes/variants in display order, e.g. {40,41,42} or {S,M,L}. Empty = no sizes.';
comment on column public.products.stock_quantity is
  'Not used by the storefront (RSN sources from suppliers). Kept for existing data.';

-- ---------------------------------------------------------------------
-- TEMPORARY sample products: give them test values.
-- Only touches the 8 sample products, by slug; does nothing if they're absent.
-- ---------------------------------------------------------------------
update public.products as p
set availability = v.availability::public.product_availability,
    sizes = v.sizes
from (values
  ('retro-high-85',            'available',               array['40','41','42','43','44','45']),
  ('oxford-wingtip-brogue',    'confirm_to_purchase',     array['40','41','42','43','44','45']),
  ('heavyweight-street-tee',   'available',               array['S','M','L','XL','XXL']),
  ('everyday-slide',           'subject_to_availability', array['40','41','42','43','44','45']),
  ('classic-white-court',      'confirm_to_purchase',     array['36','37','38','39','40','41']),
  ('slim-fit-corporate-shirt', 'available',               array['S','M','L','XL']),
  ('washed-black-jeans',       'subject_to_availability', array['30','32','34','36','38']),
  ('street-logo-cap',          'available',               array[]::text[])
) as v (slug, availability, sizes)
where p.slug = v.slug;
