import { describe, expect, it } from 'vitest';
import {
  addLine,
  bagTotal,
  bagUnits,
  buildOrderMessage,
  generateRef,
  lineLabel,
  orderItems,
  orderableLines,
  parseBag,
  reconcileBag,
  removeLine,
  setQuantity,
  type BagLine,
} from './bag';
import { whatsappUrl } from './product';

const base = {
  variantId: 'v1',
  productId: 'p1',
  slug: 'base-matte-glow',
  name: 'Base Matte Glow',
  variantLabel: 'Tono' as const,
  variantName: '03 Beige cálido',
  hex: '#D9AE86',
  image: null,
  unitPrice: 45000,
};
const kit = { ...base, variantId: 'v2', productId: 'p2', slug: 'kit', name: 'Kit Pepitas Doradas', variantLabel: null, variantName: null, hex: null, unitPrice: 18000 };

describe('agregar, cambiar y quitar', () => {
  it('agrega una línea nueva y suma a la existente', () => {
    const a = addLine([], base, 1, 5);
    expect(a).toMatchObject({ added: 1, lines: [{ variantId: 'v1', quantity: 1 }] });
    const b = addLine(a.lines, base, 2, 5);
    expect(b.lines).toHaveLength(1);
    expect(b.lines[0]?.quantity).toBe(3);
  });
  it('limita la cantidad al stock disponible', () => {
    const a = addLine([], base, 9, 4);
    expect(a.lines[0]?.quantity).toBe(4);
    expect(a.added).toBe(4);
    const b = addLine(a.lines, base, 1, 4);
    expect(b.added).toBe(0);
    expect(b.lines).toBe(a.lines);
  });
  it('no agrega nada si no hay stock', () => {
    expect(addLine([], base, 1, 0)).toEqual({ lines: [], added: 0 });
  });
  it('fija la cantidad entre 1 y el stock, y quita líneas', () => {
    const lines = addLine([], base, 2, 5).lines;
    expect(setQuantity(lines, 'v1', 99, 5)[0]?.quantity).toBe(5);
    expect(setQuantity(lines, 'v1', 0, 5)[0]?.quantity).toBe(1);
    expect(removeLine(lines, 'v1')).toEqual([]);
  });
  it('suma unidades y total', () => {
    const lines: BagLine[] = [{ ...base, quantity: 1 }, { ...kit, quantity: 2 }];
    expect(bagUnits(lines)).toBe(3);
    expect(bagTotal(lines)).toBe(81000);
  });
});

describe('bolsa guardada', () => {
  it('descarta datos corruptos', () => {
    expect(parseBag('basura')).toEqual([]);
    expect(parseBag([{ ...base, quantity: 1 }, { nada: true }, { ...base, quantity: -2 }])).toHaveLength(1);
  });
});

describe('reconcileBag', () => {
  const lines: BagLine[] = [{ ...base, quantity: 3 }, { ...kit, quantity: 1 }];
  it('no cambia nada si todo coincide', () => {
    const r = reconcileBag(lines, [
      { variantId: 'v1', stock: 5, unitPrice: 45000 },
      { variantId: 'v2', stock: 9, unitPrice: 18000 },
    ]);
    expect(r.issues).toEqual([]);
    expect(r.lines).toEqual(lines);
  });
  it('avisa de agotados, cantidades reducidas y cambios de precio', () => {
    const r = reconcileBag(lines, [
      { variantId: 'v1', stock: 2, unitPrice: 50000 },
      { variantId: 'v2', stock: 0, unitPrice: 18000 },
    ]);
    expect(r.issues).toEqual([
      { type: 'price', variantId: 'v1', from: 45000, to: 50000 },
      { type: 'reduced', variantId: 'v1', from: 3, to: 2 },
      { type: 'out', variantId: 'v2' },
    ]);
    expect(r.lines[0]).toMatchObject({ quantity: 2, unitPrice: 50000 });
    expect(r.stock).toEqual({ v1: 2, v2: 0 });
  });
  it('una variante que ya no existe cuenta como agotada', () => {
    const r = reconcileBag(lines, [{ variantId: 'v1', stock: 5, unitPrice: 45000 }]);
    expect(r.issues).toEqual([{ type: 'unavailable', variantId: 'v2' }]);
    expect(orderableLines(r.lines, r.stock).map((l) => l.variantId)).toEqual(['v1']);
  });
});

describe('referencia y mensaje', () => {
  it('genera una referencia corta sin caracteres ambiguos', () => {
    expect(generateRef(() => 0)).toBe('LS-AAAA');
    for (let i = 0; i < 200; i++) expect(generateRef()).toMatch(/^LS-[A-HJ-NP-Z2-9]{4}$/);
  });
  it('nombra la línea con su tipo de variante', () => {
    expect(lineLabel(base)).toBe('Base Matte Glow, tono 03 Beige cálido');
    expect(lineLabel(kit)).toBe('Kit Pepitas Doradas');
    expect(lineLabel({ ...base, variantLabel: 'Talla', variantName: 'M' })).toBe('Base Matte Glow, talla M');
  });
  it('arma el mensaje del plan', () => {
    const lines: BagLine[] = [{ ...base, quantity: 1 }, { ...kit, quantity: 2 }];
    expect(buildOrderMessage({ storeName: 'Leyma Shop', lines, ref: 'LS-7K2Q' })).toBe(
      [
        'Hola Leyma Shop, quiero hacer este pedido:',
        '',
        '• Base Matte Glow, tono 03 Beige cálido x1 — $45.000',
        '• Kit Pepitas Doradas x2 — $36.000',
        '',
        'Total estimado: $81.000',
        'Ref: LS-7K2Q',
      ].join('\n'),
    );
  });
  it('agrega nombre y ciudad solo si se escribieron', () => {
    const lines: BagLine[] = [{ ...kit, quantity: 1 }];
    const msg = buildOrderMessage({ storeName: 'Leyma Shop', lines, ref: 'LS-AAAA', customer: { name: ' Daniela ', city: '' } });
    expect(msg).toContain('Nombre: Daniela\nRef: LS-AAAA');
    expect(msg).not.toContain('Ciudad');
  });
  it('el enlace de WhatsApp codifica el mensaje completo', () => {
    const lines: BagLine[] = [{ ...kit, quantity: 1 }];
    const text = buildOrderMessage({ storeName: 'Leyma Shop', lines, ref: 'LS-AAAA' });
    const url = whatsappUrl('573043478682', text);
    expect(url?.startsWith('https://wa.me/573043478682?text=')).toBe(true);
    expect(decodeURIComponent(url?.split('text=')[1] ?? '')).toBe(text);
  });
  it('guarda los ítems con el formato que usa "Más pedidos"', () => {
    expect(orderItems([{ ...base, quantity: 2 }])).toEqual([
      { product_id: 'p1', variant_id: 'v1', name: 'Base Matte Glow', variant_name: '03 Beige cálido', quantity: 2, unit_price: 45000 },
    ]);
  });
});
