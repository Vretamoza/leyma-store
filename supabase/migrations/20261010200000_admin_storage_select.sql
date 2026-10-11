-- Fase 6: Storage necesita SELECT para que el admin pueda reemplazar/borrar archivos (remove/upsert).
create policy product_images_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
