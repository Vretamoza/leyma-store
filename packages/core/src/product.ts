import { normalize } from './catalog';
import type { Product, ProductImage, Variant, VariantLabel } from './types';

export function slugify(text: string): string {
  return normalize(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Valor de la URL que identifica una variante: su código, o el nombre sin tildes. */
export function variantKey(variant: Pick<Variant, 'code' | 'name'>): string {
  return slugify(variant.code || variant.name);
}

/** Nombre del parámetro de URL según el tipo de variante (`?tono=03`). */
export function variantParam(label: VariantLabel | null): 'tono' | 'talla' | 'color' {
  if (label === 'Talla') return 'talla';
  if (label === 'Color') return 'color';
  return 'tono';
}

/** Variante pedida por la URL; si no existe, la primera con stock; si no hay, la primera. */
export function pickVariant(variants: Variant[], key: string | null): Variant | undefined {
  const sorted = [...variants].sort((a, b) => a.sort_order - b.sort_order);
  const wanted = key ? slugify(key) : '';
  return (
    (wanted ? sorted.find((v) => variantKey(v) === wanted) : undefined) ??
    sorted.find((v) => v.stock > 0) ??
    sorted[0]
  );
}

/** Fotos de la variante primero y luego las generales; las de otras variantes no se muestran. */
export function galleryImages(images: ProductImage[], variantId: string | null): ProductImage[] {
  const byOrder = (a: ProductImage, b: ProductImage) => a.sort_order - b.sort_order;
  const own = variantId ? images.filter((i) => i.variant_id === variantId).sort(byOrder) : [];
  const general = images.filter((i) => i.variant_id === null).sort(byOrder);
  return [...own, ...general];
}

export function discountPercent(price: number, compareAt: number | null): number | null {
  if (compareAt === null || compareAt <= price || compareAt <= 0) return null;
  return Math.round((1 - price / compareAt) * 100);
}

/** Datos en vivo (stock/precio) que pisan los del HTML cacheado. */
export function mergeLiveVariants(
  variants: Variant[],
  live: Pick<Variant, 'id' | 'stock' | 'price_override'>[],
): Variant[] {
  const byId = new Map(live.map((l) => [l.id, l]));
  return variants.map((v) => {
    const l = byId.get(v.id);
    return l ? { ...v, stock: l.stock, price_override: l.price_override } : v;
  });
}

const DETAIL_LABELS: Record<string, string> = {
  acabado: 'Acabado',
  cobertura: 'Cobertura',
  tipo_de_piel: 'Tipo de piel',
  contenido: 'Contenido',
  duracion: 'Duración',
  material: 'Material',
};
/** Claves de `details` que se muestran en su propio acordeón, no en la tabla. */
const LONG_TEXT_KEYS = new Set(['modo_de_uso', 'ingredientes', 'guia_tallas']);

function humanize(key: string): string {
  const text = key.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function detailRows(details: Record<string, unknown>): { label: string; value: string }[] {
  return Object.entries(details)
    .filter(([key, value]) => !LONG_TEXT_KEYS.has(key) && (typeof value === 'string' || typeof value === 'number') && String(value).trim())
    .map(([key, value]) => ({ label: DETAIL_LABELS[key] ?? humanize(key), value: String(value) }));
}

/** Texto largo de `details` (string o lista de strings) como lista de líneas. */
export function detailList(details: Record<string, unknown>, key: string): string[] {
  const value = details[key];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

/** Línea superior de la ficha: "BASE LÍQUIDA · 30 ML". */
export function eyebrow(
  categoryName: string | null,
  details: Record<string, unknown>,
  brand?: string | null,
  productType?: string | null,
): string {
  const parts = [
    brand,
    productType || categoryName,
    typeof details.contenido === 'string' ? details.contenido : null,
  ].filter(Boolean);
  return parts.join(' · ').toUpperCase();
}

/** Enlace wa.me, o null si el número no es válido (p. ej. el placeholder 57XXXXXXXXXX). */
export function whatsappUrl(number: string, text: string): string | null {
  const digits = number.replace(/[^\d]/g, '');
  if (digits.length < 10 || digits.length > 15 || /[^\d+\s-]/.test(number)) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function availabilityMessage(storeName: string, product: Pick<Product, 'name' | 'variant_label'>, variantName: string | null): string {
  const what = variantName && product.variant_label ? `${product.name}, ${product.variant_label.toLowerCase()} ${variantName}` : product.name;
  return `Hola ${storeName}, quisiera saber cuándo vuelve a estar disponible: ${what}.`;
}
