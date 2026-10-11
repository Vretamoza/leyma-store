create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references public.categories(id) on delete set null,
  sort_order int not null default 0,
  is_active boolean not null default true
);
create index categories_parent_id_idx on public.categories(parent_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  base_price numeric(12,0) not null check (base_price >= 0),
  compare_at_price numeric(12,0) check (compare_at_price is null or compare_at_price >= 0),
  variant_label text check (variant_label in ('Tono','Talla','Color')),
  details jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  is_active boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_id_idx on public.products(category_id);
create index products_tags_idx on public.products using gin(tags);
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  code text,
  swatch_hex text check (swatch_hex is null or swatch_hex ~ '^#[0-9A-Fa-f]{6}$'),
  swatch_image_path text,
  undertone text check (undertone in ('frío','cálido','neutro')),
  price_override numeric(12,0) check (price_override is null or price_override >= 0),
  stock int not null default 0 check (stock >= 0),
  sort_order int not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
create index product_variants_product_id_idx on public.product_variants(product_id);
create trigger product_variants_set_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  path text not null,
  alt text,
  sort_order int not null default 0
);
create index product_images_product_id_idx on public.product_images(product_id);
create index product_images_variant_id_idx on public.product_images(variant_id);

create table public.kit_items (
  kit_product_id uuid not null references public.products(id) on delete cascade,
  item_product_id uuid not null references public.products(id) on delete cascade,
  item_variant_id uuid references public.product_variants(id) on delete set null,
  quantity int not null default 1 check (quantity > 0),
  primary key (kit_product_id, item_product_id)
);
create index kit_items_item_product_id_idx on public.kit_items(item_product_id);
create index kit_items_item_variant_id_idx on public.kit_items(item_variant_id);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  product_id uuid references public.products(id) on delete cascade,
  sort_order int not null default 0,
  is_active boolean not null default true
);
create index faqs_product_id_idx on public.faqs(product_id);

-- Datos de la tienda: una sola fila, editable desde el admin sin tocar código.
create table public.store_settings (
  id boolean primary key default true check (id),
  store_name text not null default 'Leyma Shop',
  whatsapp_number text not null default '57XXXXXXXXXX',
  extra_whatsapp_numbers jsonb not null default '[]'::jsonb,
  contact_email text,
  instagram_url text,
  city text,
  business_hours text,
  shipping_info text,
  payment_methods text,
  low_stock_threshold int not null default 3 check (low_stock_threshold >= 0),
  updated_at timestamptz not null default now()
);
create trigger store_settings_set_updated_at before update on public.store_settings
  for each row execute function public.set_updated_at();
insert into public.store_settings (id) values (true);

create table public.order_requests (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique check (char_length(ref) between 4 and 16),
  items jsonb not null,
  total numeric(12,0) not null check (total >= 0),
  status text not null default 'sent' check (status in ('sent','confirmed','cancelled')),
  created_at timestamptz not null default now()
);

-- RLS
alter table public.admins enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.kit_items enable row level security;
alter table public.faqs enable row level security;
alter table public.store_settings enable row level security;
alter table public.order_requests enable row level security;

create policy admins_read_self on public.admins for select to authenticated
  using (user_id = (select auth.uid()));

create policy categories_read on public.categories for select to anon, authenticated
  using (is_active or public.is_admin());
create policy categories_admin_write on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy products_read on public.products for select to anon, authenticated
  using (is_active or public.is_admin());
create policy products_admin_write on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy variants_read on public.product_variants for select to anon, authenticated
  using (is_active or public.is_admin());
create policy variants_admin_write on public.product_variants for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy images_read on public.product_images for select to anon, authenticated
  using (true);
create policy images_admin_write on public.product_images for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy kit_items_read on public.kit_items for select to anon, authenticated
  using (true);
create policy kit_items_admin_write on public.kit_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy faqs_read on public.faqs for select to anon, authenticated
  using (is_active or public.is_admin());
create policy faqs_admin_write on public.faqs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy store_settings_read on public.store_settings for select to anon, authenticated
  using (true);
create policy store_settings_admin_update on public.store_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy order_requests_insert on public.order_requests for insert to anon, authenticated
  with check (status = 'sent');
create policy order_requests_admin_read on public.order_requests for select to authenticated
  using (public.is_admin());
create policy order_requests_admin_update on public.order_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy order_requests_admin_delete on public.order_requests for delete to authenticated
  using (public.is_admin());

-- Storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 1048576, array['image/webp','image/jpeg','image/png']);

create policy product_images_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());
create policy product_images_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());
create policy product_images_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
