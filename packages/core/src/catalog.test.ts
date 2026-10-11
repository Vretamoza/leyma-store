import { describe, expect, it } from 'vitest';
import {
  applyFilters,
  cardMeta,
  categoryTreeIds,
  emptyFilters,
  isNew,
  minPrice,
  normalize,
  parseFilters,
  parseSort,
  productStatus,
  searchProducts,
  sortProducts,
  stockStatus,
  swatchPreview,
} from './catalog';
import type { Category, Product, Variant } from './types';

const cats: Category[] = [
  { id: 'mk', name: 'Maquillaje', slug: 'maquillaje', parent_id: null, sort_order: 1, image_path: null },
  { id: 'bs', name: 'Bases', slug: 'bases', parent_id: 'mk', sort_order: 1, image_path: null },
  { id: 'lb', name: 'Labiales', slug: 'labiales', parent_id: 'mk', sort_order: 2, image_path: null },
  { id: 'rp', name: 'Ropa', slug: 'ropa', parent_id: null, sort_order: 3, image_path: null },
];

function variant(over: Partial<Variant> = {}): Variant {
  return {
    id: 'v',
    product_id: 'p',
    name: 'Único',
    code: null,
    swatch_hex: null,
    undertone: null,
    price_override: null,
    stock: 5,
    sort_order: 0,
    ...over,
  };
}

function product(over: Partial<Product> = {}): Product {
  return {
    id: 'p',
    name: 'Base Matte Glow',
    slug: 'base',
    short_description: null,
    category_id: 'bs',
    base_price: 45000,
    compare_at_price: null,
    variant_label: 'Tono',
    tags: [],
    is_featured: false,
    created_at: '2026-10-01T00:00:00Z',
    product_variants: [variant()],
    product_images: [],
    ...over,
  };
}

describe('normalize', () => {
  it('quita tildes y mayúsculas', () => {
    expect(normalize('  CÁLIDO ')).toBe('calido');
  });
});

describe('stock', () => {
  it('clasifica según el umbral', () => {
    expect(stockStatus(0, 3)).toBe('out');
    expect(stockStatus(3, 3)).toBe('low');
    expect(stockStatus(4, 3)).toBe('in');
  });
  it('un producto está agotado si todas sus variantes están en 0', () => {
    const p = product({ product_variants: [variant({ stock: 0 }), variant({ stock: 0 })] });
    expect(productStatus(p, 3)).toBe('out');
  });
});

describe('isNew', () => {
  const now = new Date('2026-10-10T00:00:00Z');
  it('es nuevo dentro de la ventana', () => {
    expect(isNew('2026-09-20T00:00:00Z', 30, now)).toBe(true);
    expect(isNew('2026-08-01T00:00:00Z', 30, now)).toBe(false);
  });
  it('con 0 días nunca es nuevo', () => {
    expect(isNew('2026-10-10T00:00:00Z', 0, now)).toBe(false);
  });
});

describe('precios', () => {
  it('usa el menor precio efectivo entre variantes', () => {
    const p = product({
      product_variants: [variant({ price_override: 40000 }), variant({ price_override: null })],
    });
    expect(minPrice(p)).toBe(40000);
  });
});

describe('swatchPreview / cardMeta', () => {
  it('limita las muestras y cuenta el resto', () => {
    const p = product({
      product_variants: ['#111111', '#222222', '#333333', '#444444', '#555555'].map((hex, i) =>
        variant({ swatch_hex: hex, sort_order: i }),
      ),
    });
    expect(swatchPreview(p)).toEqual({ colors: ['#111111', '#222222', '#333333'], more: 2 });
  });
  it('lista las tallas y el contenido de los kits', () => {
    const talla = product({
      variant_label: 'Talla',
      product_variants: [variant({ name: 'S' }), variant({ name: 'M', sort_order: 1 })],
    });
    expect(cardMeta(talla)).toBe('Tallas S · M');
    expect(cardMeta(product(), 4)).toBe('Incluye 4 productos');
    expect(cardMeta(product())).toBe('');
  });
});

describe('categorías', () => {
  it('incluye las subcategorías', () => {
    expect(categoryTreeIds(cats, 'mk').sort()).toEqual(['bs', 'lb', 'mk']);
    expect(categoryTreeIds(cats, 'rp')).toEqual(['rp']);
  });
});

describe('filtros y orden', () => {
  const base = product({ id: 'a', category_id: 'bs', product_variants: [variant({ undertone: 'cálido' })] });
  const labial = product({
    id: 'b',
    category_id: 'lb',
    base_price: 28000,
    created_at: '2026-10-05T00:00:00Z',
    product_variants: [variant({ stock: 0 })],
  });
  const all = [base, labial];

  it('filtra por subcategoría', () => {
    const f = { ...emptyFilters, subcategories: ['labiales'] };
    expect(applyFilters(all, f, cats).map((p) => p.id)).toEqual(['b']);
  });
  it('filtra por disponibilidad, subtono y precio', () => {
    expect(applyFilters(all, { ...emptyFilters, onlyAvailable: true }, cats).map((p) => p.id)).toEqual(['a']);
    expect(applyFilters(all, { ...emptyFilters, undertones: ['cálido'] }, cats).map((p) => p.id)).toEqual(['a']);
    expect(applyFilters(all, { ...emptyFilters, maxPrice: 30000 }, cats).map((p) => p.id)).toEqual(['b']);
  });
  it('ordena por novedades, precio y pedidos', () => {
    expect(sortProducts(all, 'novedades').map((p) => p.id)).toEqual(['b', 'a']);
    expect(sortProducts(all, 'menor').map((p) => p.id)).toEqual(['b', 'a']);
    expect(sortProducts(all, 'mayor').map((p) => p.id)).toEqual(['a', 'b']);
    expect(sortProducts(all, 'pedidos', { a: 9 }).map((p) => p.id)).toEqual(['a', 'b']);
  });
  it('lee filtros y orden desde la URL', () => {
    const params = new URLSearchParams('sub=bases&min=$15.000&subtono=Calido&disponible=1&orden=mayor');
    expect(parseFilters(params)).toEqual({
      subcategories: ['bases'],
      minPrice: 15000,
      maxPrice: null,
      onlyAvailable: true,
      undertones: ['cálido'],
    });
    expect(parseSort(params)).toBe('mayor');
    expect(parseSort(new URLSearchParams('orden=zzz'))).toBe('novedades');
  });
});

describe('búsqueda', () => {
  const p = product({ name: 'Labial Velvet', category_id: 'lb', tags: ['labios'], short_description: 'Tono cálido' });
  it('ignora tildes y mayúsculas, y exige todas las palabras', () => {
    expect(searchProducts([p], 'CALIDO labial', cats)).toHaveLength(1);
    expect(searchProducts([p], 'labial base', cats)).toHaveLength(0);
  });
  it('encuentra por nombre de categoría y por tag', () => {
    expect(searchProducts([p], 'labiales', cats)).toHaveLength(1);
    expect(searchProducts([p], 'labios', cats)).toHaveLength(1);
  });
  it('una consulta vacía no devuelve nada', () => {
    expect(searchProducts([p], '   ', cats)).toEqual([]);
  });
  it('tolera comas y paréntesis', () => {
    expect(() => searchProducts([p], 'a,b)(c', cats)).not.toThrow();
  });
});
