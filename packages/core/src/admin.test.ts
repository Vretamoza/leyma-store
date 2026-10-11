import { describe, expect, it } from 'vitest';
import {
  productInputSchema,
  settingsInputSchema,
  stockUpdateSchema,
  variantInputSchema,
} from './admin';

describe('productInputSchema', () => {
  it('genera el slug desde el nombre y normaliza vacíos', () => {
    const p = productInputSchema.parse({ name: 'Labial Terciopelo', base_price: '25000', short_description: '' });
    expect(p.slug).toBe('labial-terciopelo');
    expect(p.base_price).toBe(25000);
    expect(p.short_description).toBeNull();
    expect(p.variants).toEqual([]);
  });
  it('rechaza precio anterior menor o igual al actual', () => {
    const r = productInputSchema.safeParse({ name: 'Base', base_price: 30000, compare_at_price: 30000 });
    expect(r.success).toBe(false);
  });
  it('acepta variantes con stock numérico', () => {
    const p = productInputSchema.parse({
      name: 'Base',
      base_price: 1000,
      variants: [{ name: '03 Beige', stock: '4', swatch_hex: '#D9B08C' }],
    });
    expect(p.variants[0].stock).toBe(4);
  });
});

describe('marca y tipo', () => {
  it('acepta ids o null', () => {
    const p = productInputSchema.parse({ name: 'Flawless Bake', base_price: 1000, brand_id: null, product_type_id: undefined });
    expect(p.brand_id).toBeNull();
    expect(p.product_type_id).toBeNull();
  });
});

describe('variantInputSchema', () => {
  it('rechaza stock negativo y color mal formado', () => {
    expect(variantInputSchema.safeParse({ name: 'x', stock: -1 }).success).toBe(false);
    expect(variantInputSchema.safeParse({ name: 'x', stock: 1, swatch_hex: 'rojo' }).success).toBe(false);
  });
});

describe('settingsInputSchema', () => {
  const base = { store_name: 'Leyma', low_stock_threshold: 3, show_low_stock_alert: true, new_badge_days: 30 };
  it('limpia el número de WhatsApp', () => {
    const s = settingsInputSchema.parse({ ...base, whatsapp_number: '+57 300 123 4567' });
    expect(s.whatsapp_number).toBe('573001234567');
  });
  it('rechaza números cortos', () => {
    expect(settingsInputSchema.safeParse({ ...base, whatsapp_number: '123' }).success).toBe(false);
  });
});

describe('stockUpdateSchema', () => {
  it('exige uuid y entero no negativo', () => {
    expect(stockUpdateSchema.safeParse({ id: 'x', stock: 1 }).success).toBe(false);
    expect(
      stockUpdateSchema.safeParse({ id: '8b0f5f6e-2a0e-4f0c-9d0e-3b1f1c5a7d11', stock: -2 }).success,
    ).toBe(false);
  });
});
