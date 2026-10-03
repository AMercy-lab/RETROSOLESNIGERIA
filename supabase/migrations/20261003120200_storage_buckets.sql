-- =====================================================================
-- RSN — file storage (Supabase Storage)
--
-- Two "buckets" (folders in the cloud):
--
--   catalog-images  PUBLIC   product and category photos
--     products/<product-id>/<file>     e.g. products/3f2a.../front.jpg
--     categories/<category-slug>/<file>
--     Anyone can view; only admins can upload, replace or delete.
--
--   payment-proofs  PRIVATE  bank-transfer receipts
--     <customer-user-id>/<order-id>/<file>
--     A customer can upload into, and view, only their own folder.
--     Admins can view everything. Nobody can replace or delete a proof
--     through the website/app, so a receipt can't be swapped after review.
--     Private files are only viewable through short-lived signed links.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('catalog-images', 'catalog-images', true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('payment-proofs', 'payment-proofs', false, 5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Catalogue images ------------------------------------------------------
create policy "Admins can upload catalogue images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'catalog-images' and (select public.is_admin()));

create policy "Admins can replace catalogue images"
  on storage.objects for update to authenticated
  using (bucket_id = 'catalog-images' and (select public.is_admin()))
  with check (bucket_id = 'catalog-images' and (select public.is_admin()));

create policy "Admins can delete catalogue images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'catalog-images' and (select public.is_admin()));

-- Payment proofs --------------------------------------------------------
create policy "Customers can upload payment proofs to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Customers see their own payment proofs, admins see all"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_admin())
    )
  );
