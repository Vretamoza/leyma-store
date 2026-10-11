import { z } from 'zod';
import { slugify } from './product';

const money = z.coerce.number().int().min(0).max(100_000_000);
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const variantInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Falta el nombre').max(80),
  code: optText(20),
  swatch_hex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido')
    .nullish()
    .transform((v) => v ?? null),
  undertone: z
    .enum(['frío', 'cálido', 'neutro'])
    .nullish()
    .transform((v) => v ?? null),
  price_override: money.nullish().transform((v) => v ?? null),
  stock: z.coerce.number().int().min(0).max(100_000),
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});
export type VariantInput = z.infer<typeof variantInputSchema>;

export const productInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(2, 'Falta el nombre').max(120),
    slug: z.string().trim().max(120).optional(),
    brand_id: z.string().uuid().nullish().transform((v) => v ?? null),
    product_type_id: z.string().uuid().nullish().transform((v) => v ?? null),
    short_description: optText(200),
    description: optText(4000),
    category_id: z
      .string()
      .uuid()
      .nullish()
      .transform((v) => v ?? null),
    base_price: money,
    compare_at_price: money.nullish().transform((v) => v ?? null),
    variant_label: z
      .enum(['Tono', 'Talla', 'Color'])
      .nullish()
      .transform((v) => v ?? null),
    details: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    is_active: z.boolean().default(true),
    is_featured: z.boolean().default(false),
    variants: z.array(variantInputSchema).max(60).default([]),
  })
  .refine((p) => p.compare_at_price === null || p.compare_at_price > p.base_price, {
    path: ['compare_at_price'],
    message: 'El precio anterior debe ser mayor al actual',
  })
  .transform((p) => ({ ...p, slug: slugify(p.slug || p.name) }));
export type ProductInput = z.infer<typeof productInputSchema>;

export const imageMetaSchema = z.object({
  id: z.string().uuid(),
  variant_id: z.string().uuid().nullable(),
  alt: optText(160),
  sort_order: z.number().int().min(0),
});
export type ImageMeta = z.infer<typeof imageMetaSchema>;

export const optionNameSchema = z.string().trim().min(1, 'Escribe un nombre').max(80);

export const categoryInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().max(60).optional(),
  parent_id: z.string().uuid().nullish().transform((v) => v ?? null),
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const faqInputSchema = z.object({
  id: z.string().uuid().optional(),
  question: z.string().trim().min(3).max(200),
  answer: z.string().trim().min(3).max(2000),
  product_id: z.string().uuid().nullish().transform((v) => v ?? null),
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});
export type FaqInput = z.infer<typeof faqInputSchema>;

export const settingsInputSchema = z.object({
  store_name: z.string().trim().min(1).max(60),
  whatsapp_number: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ''))
    .pipe(z.string().regex(/^\d{10,15}$/, 'Usa el formato 573001234567')),
  extra_whatsapp_numbers: z.array(z.string().regex(/^\d{10,15}$/)).max(10).default([]),
  contact_email: optText(120),
  instagram_url: optText(200),
  tiktok_url: optText(200),
  city: optText(80),
  business_hours: optText(200),
  shipping_info: optText(600),
  payment_methods: optText(600),
  low_stock_threshold: z.coerce.number().int().min(0).max(1000),
  new_badge_days: z.coerce.number().int().min(0).max(365),
});
export type SettingsInput = z.infer<typeof settingsInputSchema>;

export const stockUpdateSchema = z.object({
  id: z.string().uuid(),
  stock: z.coerce.number().int().min(0).max(100_000),
});
