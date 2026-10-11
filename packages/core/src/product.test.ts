import { describe, expect, it } from 'vitest';
import {
  availabilityMessage,
  detailList,
  detailRows,
  discountPercent,
  eyebrow,
  galleryImages,
  mergeLiveVariants,
  pickVariant,
  slugify,
  variantKey,
  variantParam,
  whatsappUrl,
} from './product';
import type { ProductImage, Variant } from './types';

function v(over: Partial<Variant> = {}): Variant {
  return {
    id: 'v1',
    product_id: 'p',
    name: '03 Beige cálido',
    code: '03',
    swatch_hex: '#D9AE86',
    undertone: 'cálido',
    price_override: null,
    stock: 5,
    sort_order: 0,
    ...over,
  };
}
function img(id: string, variant_id: string | null, sort_order = 0): ProductImage {
  return { id, product_id: 'p', variant_id, path: `${id}.webp`, alt: null, sort_order };
}

describe('variantes en la URL', () => {
  it('usa el código, o el nombre sin tildes', () => {
    expect(variantKey(v())).toBe('03');
    expect(variantKey(v({ code: null, name: 'Rojo Clásico' }))).toBe('rojo-clasico');
    expect(slugify('  Cálido Ñu ')).toBe('calido-nu');
  });
  it('nombra el parámetro según el tipo de variante', () => {
    expect(variantParam('Tono')).toBe('tono');
    expect(variantParam('Talla')).toBe('talla');
    expect(variantParam('Color')).toBe('color');
    expect(variantParam(null)).toBe('tono');
  });
  it('elige la variante de la URL, o la primera con stock, o la primera', () => {
    const list = [v({ id: 'a', code: '01', stock: 0 }), v({ id: 'b', code: '02' }), v({ id: 'c', code: '03' })];
    expect(pickVariant(list, '03')?.id).toBe('c');
    expect(pickVariant(list, '  03 ')?.id).toBe('c');
    expect(pickVariant(list, 'zzz')?.id).toBe('b');
    expect(pickVariant(list, null)?.id).toBe('b');
    expect(pickVariant([v({ id: 'a', stock: 0 })], null)?.id).toBe('a');
    expect(pickVariant([], '03')).toBeUndefined();
  });
  it('permite abrir directamente un tono agotado', () => {
    const list = [v({ id: 'a', code: '01', stock: 0 }), v({ id: 'b', code: '02' })];
    expect(pickVariant(list, '01')?.id).toBe('a');
  });
});

describe('galleryImages', () => {
  const images = [img('g1', null, 1), img('t1', 'a', 2), img('t0', 'a', 1), img('x', 'b', 1), img('g0', null, 0)];
  it('muestra primero las del tono y luego las generales', () => {
    expect(galleryImages(images, 'a').map((i) => i.id)).toEqual(['t0', 't1', 'g0', 'g1']);
  });
  it('sin tono solo muestra las generales', () => {
    expect(galleryImages(images, null).map((i) => i.id)).toEqual(['g0', 'g1']);
  });
});

describe('precios y datos en vivo', () => {
  it('calcula el descuento', () => {
    expect(discountPercent(52000, 62000)).toBe(16);
    expect(discountPercent(52000, null)).toBeNull();
    expect(discountPercent(52000, 52000)).toBeNull();
  });
  it('los datos en vivo pisan stock y precio', () => {
    const merged = mergeLiveVariants([v({ id: 'a', stock: 5 }), v({ id: 'b', stock: 2 })], [{ id: 'a', stock: 0, price_override: 9000 }]);
    expect(merged[0]).toMatchObject({ stock: 0, price_override: 9000 });
    expect(merged[1].stock).toBe(2);
  });
});

describe('detalles', () => {
  const details = { acabado: 'Mate', tipo_de_piel: 'Mixta', modo_de_uso: ['a', 'b'], ingredientes: 'Aqua', extra_cosa: 'x', vacio: ' ', n: 30 };
  it('arma las filas con etiquetas y excluye textos largos y vacíos', () => {
    expect(detailRows(details)).toEqual([
      { label: 'Acabado', value: 'Mate' },
      { label: 'Tipo de piel', value: 'Mixta' },
      { label: 'Extra cosa', value: 'x' },
      { label: 'N', value: '30' },
    ]);
  });
  it('lee listas de texto como lista o string', () => {
    expect(detailList(details, 'modo_de_uso')).toEqual(['a', 'b']);
    expect(detailList(details, 'ingredientes')).toEqual(['Aqua']);
    expect(detailList(details, 'nada')).toEqual([]);
  });
  it('arma la línea superior', () => {
    expect(eyebrow('Bases', { contenido: '30 ml' })).toBe('BASES · 30 ML');
    expect(eyebrow(null, {})).toBe('');
    expect(eyebrow('Maquillaje', { contenido: '8 g' }, 'Enchanté', 'Polvo traslúcido')).toBe('ENCHANTÉ · POLVO TRASLÚCIDO · 8 G');
  });
});

describe('WhatsApp', () => {
  it('rechaza el número de ejemplo y acepta uno real', () => {
    expect(whatsappUrl('57XXXXXXXXXX', 'hola')).toBeNull();
    expect(whatsappUrl('', 'hola')).toBeNull();
    expect(whatsappUrl('+57 300 123 4567', 'hola ñ')).toBe('https://wa.me/573001234567?text=hola%20%C3%B1');
  });
  it('arma el mensaje de disponibilidad', () => {
    expect(availabilityMessage('Leyma Shop', { name: 'Base', variant_label: 'Tono' }, '05 Moca')).toBe(
      'Hola Leyma Shop, quisiera saber cuándo vuelve a estar disponible: Base, tono 05 Moca.',
    );
    expect(availabilityMessage('Leyma Shop', { name: 'Kit', variant_label: null }, 'Única')).toContain('Kit.');
  });
});
