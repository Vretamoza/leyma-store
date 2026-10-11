import type { Category, Faq, KitItem, Product, ProductExtras, StoreSettings } from '@leyma/core';
import { createServer } from './supabase';

const SETTINGS_FALLBACK: StoreSettings = {
  store_name: 'Leyma Shop',
  whatsapp_number: '',
  contact_email: null,
  instagram_url: null,
  tiktok_url: null,
  city: null,
  business_hours: null,
  shipping_info: null,
  payment_methods: null,
  low_stock_threshold: 3,
  new_badge_days: 30,
};

export { imageUrl } from './images';

export interface CatalogData {
  categories: Category[];
  products: Product[];
  kitSizes: Record<string, number>;
  kitItems: KitItem[];
  settings: StoreSettings;
}

/** El catálogo es pequeño: se trae completo y se filtra/ordena con la lógica pura de core. */
export async function loadCatalog(): Promise<CatalogData> {
  const supabase = createServer();
  const [cats, prods, kits, settings] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, slug, parent_id, sort_order, image_path')
      .order('sort_order'),
    supabase
      .from('products')
      .select(
        'id, name, slug, brands(name), product_types(name), short_description, category_id, base_price, compare_at_price, variant_label, tags, is_featured, created_at, product_variants(id, product_id, name, code, swatch_hex, undertone, price_override, stock, sort_order), product_images(id, product_id, variant_id, path, alt, sort_order)',
      ),
    supabase.from('kit_items').select('kit_product_id, item_product_id, item_variant_id, quantity'),
    supabase.from('store_settings').select('*').maybeSingle(),
  ]);

  for (const r of [cats, prods, kits]) if (r.error) throw new Error(r.error.message);

  const kitSizes: Record<string, number> = {};
  for (const k of (kits.data ?? []) as KitItem[]) {
    kitSizes[k.kit_product_id] = (kitSizes[k.kit_product_id] ?? 0) + 1;
  }

  return {
    categories: (cats.data ?? []) as Category[],
    products: ((prods.data ?? []) as unknown as (Product & {
      brands: { name: string } | null;
      product_types: { name: string } | null;
    })[]).map(({ brands, product_types, ...p }) => ({
      ...p,
      brand: brands?.name ?? null,
      product_type: product_types?.name ?? null,
    })),
    kitSizes,
    kitItems: (kits.data ?? []) as KitItem[],
    settings: (settings.data as StoreSettings | null) ?? SETTINGS_FALLBACK,
  };
}

export async function loadPopularity(): Promise<Record<string, number>> {
  const { data } = await createServer().rpc('product_popularity');
  const out: Record<string, number> = {};
  for (const row of (data ?? []) as { product_id: string; units: number }[]) {
    out[row.product_id] = Number(row.units);
  }
  return out;
}

export function cacheHeaders(response: ResponseInit & { headers: Headers }): void {
  response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
}

/** Texto largo y FAQs: solo se piden en la ficha, no en los listados. */
export async function loadProductExtras(
  productId: string,
): Promise<{ extras: ProductExtras; faqs: Faq[] }> {
  const supabase = createServer();
  const [prod, faqs] = await Promise.all([
    supabase.from('products').select('description, details').eq('id', productId).maybeSingle(),
    supabase
      .from('faqs')
      .select('id, question, answer, product_id, sort_order')
      .order('sort_order'),
  ]);
  if (prod.error) throw new Error(prod.error.message);
  if (faqs.error) throw new Error(faqs.error.message);
  const row = prod.data as { description: string | null; details: Record<string, unknown> | null } | null;
  return {
    extras: { description: row?.description ?? null, details: row?.details ?? {} },
    // Primero las del producto, luego las generales.
    faqs: ((faqs.data ?? []) as Faq[])
      .filter((f) => f.product_id === null || f.product_id === productId)
      .sort((a, b) => Number(a.product_id === null) - Number(b.product_id === null) || a.sort_order - b.sort_order),
  };
}
