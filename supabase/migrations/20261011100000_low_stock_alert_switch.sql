-- Interruptor para mostrar u ocultar los avisos de "Últimas unidades" en la tienda.
alter table public.store_settings add column show_low_stock_alert boolean not null default true;
