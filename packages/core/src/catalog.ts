import type {
  Category,
  Product,
  SortKey,
  StockStatus,
  Undertone,
  Variant,
} from './types';

const DAY_MS = 86_400_000;

/** Minúsculas y sin tildes, para búsquedas tolerantes ("calido" encuentra "cálido"). */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function variantPrice(product: Product, variant: Variant): number {
  return variant.price_override ?? product.base_price;
}

/** Precio mínimo entre variantes (o el precio base si no hay variantes). */
export function minPrice(product: Product): number {
  const prices = product.product_variants.map((v) => variantPrice(product, v));
  return prices.length ? Math.min(...prices) : product.base_price;
}

export function maxPrice(product: Product): number {
  const prices = product.product_variants.map((v) => variantPrice(product, v));
  return prices.length ? Math.max(...prices) : product.base_price;
}

export function stockStatus(stock: number, threshold: number): StockStatus {
  if (stock <= 0) return 'out';
  if (stock <= threshold) return 'low';
  return 'in';
}

export function totalStock(product: Product): number {
  return product.product_variants.reduce((sum, v) => sum + v.stock, 0);
}

export function isAvailable(product: Product): boolean {
  return totalStock(product) > 0;
}

/** Agotado si ninguna variante tiene stock; "últimas unidades" si queda poco en total. */
export function productStatus(product: Product, threshold: number): StockStatus {
  return stockStatus(totalStock(product), threshold);
}

export function isNew(createdAt: string, days: number, now: Date = new Date()): boolean {
  if (days <= 0) return false;
  return now.getTime() - new Date(createdAt).getTime() <= days * DAY_MS;
}

export function productUndertones(product: Product): Undertone[] {
  const set = new Set<Undertone>();
  for (const v of product.product_variants) if (v.undertone) set.add(v.undertone);
  return [...set];
}

export interface SwatchPreview {
  colors: string[];
  more: number;
}

/** Hasta `max` muestras de color y cuántas variantes quedan sin mostrar. */
export function swatchPreview(product: Product, max = 3): SwatchPreview {
  const withColor = [...product.product_variants]
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter((v) => v.swatch_hex);
  return {
    colors: withColor.slice(0, max).map((v) => v.swatch_hex as string),
    more: Math.max(0, withColor.length - max),
  };
}

/** Texto secundario de la tarjeta: tallas, o cantidad de productos de un kit. */
export function cardMeta(product: Product, kitSize = 0): string {
  if (kitSize > 0) return `Incluye ${kitSize} ${kitSize === 1 ? 'producto' : 'productos'}`;
  if (product.variant_label === 'Talla') {
    const sizes = [...product.product_variants]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => v.name);
    if (sizes.length) return `${sizes.length === 1 ? 'Talla' : 'Tallas'} ${sizes.join(' · ')}`;
  }
  return '';
}

/** Id de la categoría y de todas sus descendientes. */
export function categoryTreeIds(categories: Category[], rootId: string): string[] {
  const ids = new Set<string>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of categories) {
      if (c.parent_id && ids.has(c.parent_id) && !ids.has(c.id)) {
        ids.add(c.id);
        grew = true;
      }
    }
  }
  return [...ids];
}

export interface CatalogFilters {
  /** Slugs de subcategorías; vacío = todas. */
  subcategories: string[];
  minPrice: number | null;
  maxPrice: number | null;
  onlyAvailable: boolean;
  undertones: Undertone[];
}

export const emptyFilters: CatalogFilters = {
  subcategories: [],
  minPrice: null,
  maxPrice: null,
  onlyAvailable: false,
  undertones: [],
};

const UNDERTONES: Undertone[] = ['frío', 'cálido', 'neutro'];
const SORTS: SortKey[] = ['novedades', 'menor', 'mayor', 'pedidos'];

function parsePrice(raw: string | null): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

export function parseFilters(params: URLSearchParams): CatalogFilters {
  return {
    subcategories: params.getAll('sub'),
    minPrice: parsePrice(params.get('min')),
    maxPrice: parsePrice(params.get('max')),
    onlyAvailable: params.get('disponible') === '1',
    undertones: params
      .getAll('subtono')
      .map(normalize)
      .map((t) => UNDERTONES.find((u) => normalize(u) === t))
      .filter((u): u is Undertone => Boolean(u)),
  };
}

export function parseSort(params: URLSearchParams): SortKey {
  const value = params.get('orden');
  return SORTS.find((s) => s === value) ?? 'novedades';
}

export function activeFilterCount(f: CatalogFilters): number {
  return (
    f.subcategories.length +
    (f.minPrice !== null || f.maxPrice !== null ? 1 : 0) +
    (f.onlyAvailable ? 1 : 0) +
    f.undertones.length
  );
}

export function applyFilters(
  products: Product[],
  filters: CatalogFilters,
  categories: Category[],
): Product[] {
  let allowedCategoryIds: Set<string> | null = null;
  if (filters.subcategories.length) {
    allowedCategoryIds = new Set();
    for (const slug of filters.subcategories) {
      const cat = categories.find((c) => c.slug === slug);
      if (cat) for (const id of categoryTreeIds(categories, cat.id)) allowedCategoryIds.add(id);
    }
  }
  return products.filter((p) => {
    if (allowedCategoryIds && (!p.category_id || !allowedCategoryIds.has(p.category_id))) return false;
    if (filters.onlyAvailable && !isAvailable(p)) return false;
    if (filters.minPrice !== null && maxPrice(p) < filters.minPrice) return false;
    if (filters.maxPrice !== null && minPrice(p) > filters.maxPrice) return false;
    if (filters.undertones.length) {
      const own = productUndertones(p);
      if (!filters.undertones.some((u) => own.includes(u))) return false;
    }
    return true;
  });
}

/** `popularity`: unidades pedidas por id de producto (para el orden "Más pedidos"). */
export function sortProducts(
  products: Product[],
  sort: SortKey,
  popularity: Record<string, number> = {},
): Product[] {
  const byNewest = (a: Product, b: Product) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  const copy = [...products];
  switch (sort) {
    case 'menor':
      return copy.sort((a, b) => minPrice(a) - minPrice(b) || byNewest(a, b));
    case 'mayor':
      return copy.sort((a, b) => minPrice(b) - minPrice(a) || byNewest(a, b));
    case 'pedidos':
      return copy.sort((a, b) => (popularity[b.id] ?? 0) - (popularity[a.id] ?? 0) || byNewest(a, b));
    default:
      return copy.sort(byNewest);
  }
}

/** Búsqueda por nombre, categoría y tags; todas las palabras deben aparecer. */
export function searchProducts(products: Product[], query: string, categories: Category[]): Product[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  return products.filter((p) => {
    const haystack = normalize(
      [p.name, p.brand ?? '', p.product_type ?? '', p.short_description ?? '', catName.get(p.category_id ?? '') ?? '', ...p.tags].join(' '),
    );
    return words.every((w) => haystack.includes(w));
  });
}
