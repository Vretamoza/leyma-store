-- Multimarca: marca y tipo de producto como texto (reemplazado por tablas en 20261010220000).
alter table public.products add column brand text, add column product_type text;
create index products_brand_idx on public.products(brand);
