export type Undertone = 'frío' | 'cálido' | 'neutro';
export type VariantLabel = 'Tono' | 'Talla' | 'Color';

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  image_path: string | null;
}

export interface Variant {
  id: string;
  product_id: string;
  name: string;
  code: string | null;
  swatch_hex: string | null;
  undertone: Undertone | null;
  price_override: number | null;
  stock: number;
  sort_order: number;
}

export interface ProductImage {
  id: string;
  product_id: string;
  variant_id: string | null;
  path: string;
  alt: string | null;
  sort_order: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  category_id: string | null;
  base_price: number;
  compare_at_price: number | null;
  variant_label: VariantLabel | null;
  brand?: string | null;
  product_type?: string | null;
  tags: string[];
  is_featured: boolean;
  created_at: string;
  product_variants: Variant[];
  product_images: ProductImage[];
}

/** Campos de texto largo que solo se piden en la ficha. */
export interface ProductExtras {
  description: string | null;
  details: Record<string, unknown>;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  product_id: string | null;
  sort_order: number;
}

export interface KitItem {
  kit_product_id: string;
  item_product_id: string;
  item_variant_id: string | null;
  quantity: number;
}

export interface StoreSettings {
  store_name: string;
  whatsapp_number: string;
  contact_email: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  city: string | null;
  business_hours: string | null;
  shipping_info: string | null;
  payment_methods: string | null;
  low_stock_threshold: number;
  show_low_stock_alert: boolean;
  new_badge_days: number;
}

export type StockStatus = 'in' | 'low' | 'out';
export type SortKey = 'novedades' | 'menor' | 'mayor' | 'pedidos';
