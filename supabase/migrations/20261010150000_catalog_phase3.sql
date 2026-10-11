-- Imagen de categoría, TikTok, días de la etiqueta NUEVO, y popularidad para "Más pedidos".
alter table public.categories add column image_path text;
alter table public.store_settings
  add column tiktok_url text,
  add column new_badge_days int not null default 30 check (new_badge_days >= 0);

-- Datos de tienda tomados del diseño (editables desde el admin).
update public.store_settings set
  city = 'Barranquilla, Colombia',
  shipping_info = 'Barranquilla en 24 h · Resto de Colombia en 2 a 5 días hábiles',
  payment_methods = 'Transferencia, Nequi o contraentrega en Barranquilla',
  business_hours = 'Lunes a sábado, 9:00 a. m. – 7:00 p. m.'
where id;

-- Kits como categoría principal y subcategorías de Maquillaje.
insert into public.categories (name, slug, sort_order) values ('Kits', 'kits', 2);
update public.categories set sort_order = 3 where slug = 'ropa';
update public.categories set sort_order = 4 where slug = 'accesorios-faciales';

insert into public.categories (name, slug, parent_id, sort_order)
select v.name, v.slug, c.id, v.ord
from public.categories c
cross join (values ('Bases','bases',1),('Labiales','labiales',2),('Correctores','correctores',3)) as v(name, slug, ord)
where c.slug = 'maquillaje';

update public.products set category_id = (select id from public.categories where slug = 'bases') where slug = 'base-matte-glow';
update public.products set category_id = (select id from public.categories where slug = 'labiales') where slug = 'labial-velvet';
update public.products set category_id = (select id from public.categories where slug = 'correctores') where slug = 'corrector-luminoso';
update public.products set category_id = (select id from public.categories where slug = 'kits') where slug = 'kit-pepitas-doradas';

-- Unidades pedidas por producto (agregado público; no expone pedidos individuales).
-- items de order_requests: [{ "product_id": uuid, "variant_id": uuid, "quantity": n, ... }]
create or replace function public.product_popularity()
returns table (product_id uuid, units bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select (i->>'product_id')::uuid, sum(coalesce((i->>'quantity')::int, 1))::bigint
  from public.order_requests o, jsonb_array_elements(o.items) i
  where o.status <> 'cancelled' and (i->>'product_id') ~ '^[0-9a-fA-F-]{36}$'
  group by 1;
$$;
revoke all on function public.product_popularity() from public;
grant execute on function public.product_popularity() to anon, authenticated;
