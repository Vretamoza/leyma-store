-- Marcas y tipos de producto como catálogos propios (sin duplicados, renombrables).
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60)
);
create unique index brands_name_key on public.brands (lower(btrim(name)));

create table public.product_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80)
);
create unique index product_types_name_key on public.product_types (lower(btrim(name)));

alter table public.products
  add column brand_id uuid references public.brands(id) on delete set null,
  add column product_type_id uuid references public.product_types(id) on delete set null;
create index products_brand_id_idx on public.products(brand_id);
create index products_product_type_id_idx on public.products(product_type_id);

-- Conserva lo que ya se hubiera escrito como texto.
insert into public.brands (name)
  select distinct on (lower(btrim(brand))) btrim(brand) from public.products where btrim(coalesce(brand,'')) <> '';
insert into public.product_types (name)
  select distinct on (lower(btrim(product_type))) btrim(product_type) from public.products where btrim(coalesce(product_type,'')) <> '';
update public.products p set brand_id = b.id from public.brands b where lower(btrim(p.brand)) = lower(b.name);
update public.products p set product_type_id = t.id from public.product_types t where lower(btrim(p.product_type)) = lower(t.name);

drop index public.products_brand_idx;
alter table public.products drop column brand, drop column product_type;

alter table public.brands enable row level security;
alter table public.product_types enable row level security;
create policy brands_read on public.brands for select to anon, authenticated using (true);
create policy brands_admin_write on public.brands for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy product_types_read on public.product_types for select to anon, authenticated using (true);
create policy product_types_admin_write on public.product_types for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
