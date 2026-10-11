import { ActionError, defineAction, type ActionAPIContext } from 'astro:actions';
import { z } from 'astro:schema';
import {
  categoryInputSchema,
  faqInputSchema,
  imageMetaSchema,
  optionNameSchema,
  productInputSchema,
  settingsInputSchema,
  slugify,
  stockUpdateSchema,
} from '@leyma/core';

type Db = NonNullable<App.Locals['supabase']>;

function db(ctx: ActionAPIContext): Db {
  const supabase = ctx.locals.supabase;
  if (!supabase || !ctx.locals.userId) {
    throw new ActionError({ code: 'UNAUTHORIZED', message: 'Sesión vencida' });
  }
  return supabase;
}

function check<T extends { error: { message: string; code?: string } | null }>(r: T): T {
  if (r.error) {
    const dup = r.error.code === '23505';
    throw new ActionError({
      code: dup ? 'CONFLICT' : 'INTERNAL_SERVER_ERROR',
      message: dup ? 'Ya existe un registro con ese nombre o enlace' : r.error.message,
    });
  }
  return r;
}

/** Borra de Storage solo los archivos que ninguna fila (p. ej. un producto duplicado) sigue usando. */
async function removeUnreferenced(supabase: Db, paths: string[]) {
  const unique = [...new Set(paths)];
  if (!unique.length) return;
  const { data } = await supabase.from('product_images').select('path').in('path', unique);
  const used = new Set((data ?? []).map((r) => r.path as string));
  const free = unique.filter((p) => !used.has(p));
  if (free.length) await supabase.storage.from('product-images').remove(free);
}

const id = z.object({ id: z.string().uuid() });
const optionTable = z.enum(['brands', 'product_types']);
const createTable = z.enum(['brands', 'product_types', 'categories']);

export const server = {
  login: defineAction({
    accept: 'json',
    input: z.object({ email: z.string().email(), password: z.string().min(1) }),
    handler: async (input, ctx) => {
      const supabase = ctx.locals.supabase;
      if (!supabase) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Sin cliente' });
      const { data, error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
      if (error || !data.user) {
        throw new ActionError({ code: 'UNAUTHORIZED', message: 'Correo o contraseña incorrectos' });
      }
      const { data: ok } = await supabase.rpc('is_admin');
      if (ok !== true) {
        await supabase.auth.signOut();
        throw new ActionError({ code: 'FORBIDDEN', message: 'Esta cuenta no tiene acceso al panel' });
      }
      return { ok: true };
    },
  }),

  logout: defineAction({
    accept: 'json',
    handler: async (_input, ctx) => {
      await ctx.locals.supabase?.auth.signOut();
      return { ok: true };
    },
  }),

  saveProduct: defineAction({
    accept: 'json',
    input: productInputSchema,
    handler: async (p, ctx) => {
      const supabase = db(ctx);
      const { variants, id: productIdIn, ...fields } = p;
      // Producto sin variantes = una variante "Única" (el stock vive siempre en la variante).
      const list = variants.length
        ? variants
        : [
            {
              name: 'Única',
              code: null,
              swatch_hex: null,
              undertone: null,
              price_override: null,
              stock: 0,
              sort_order: 0,
              is_active: true,
            } as (typeof variants)[number],
          ];

      let productId = productIdIn;
      if (productId) {
        check(await supabase.from('products').update(fields).eq('id', productId));
      } else {
        const r = check(await supabase.from('products').insert(fields).select('id').single());
        productId = r.data!.id as string;
      }

      const existing =
        check(await supabase.from('product_variants').select('id').eq('product_id', productId)).data ?? [];
      const keep = new Set(list.map((v) => v.id).filter(Boolean));
      const removed = existing.map((v) => v.id as string).filter((vid) => !keep.has(vid));
      if (removed.length) check(await supabase.from('product_variants').delete().in('id', removed));

      for (const [i, v] of list.entries()) {
        const row = { ...v, product_id: productId, sort_order: i };
        if (v.id) check(await supabase.from('product_variants').update(row).eq('id', v.id));
        else check(await supabase.from('product_variants').insert(row));
      }
      return { id: productId, slug: fields.slug };
    },
  }),

  setProductActive: defineAction({
    accept: 'json',
    input: z.object({ id: z.string().uuid(), is_active: z.boolean() }),
    handler: async ({ id: pid, is_active }, ctx) => {
      check(await db(ctx).from('products').update({ is_active }).eq('id', pid));
      return { ok: true };
    },
  }),

  deleteProduct: defineAction({
    accept: 'json',
    input: id,
    handler: async ({ id: pid }, ctx) => {
      const supabase = db(ctx);
      const imgs = check(await supabase.from('product_images').select('path').eq('product_id', pid)).data ?? [];
      check(await supabase.from('products').delete().eq('id', pid));
      await removeUnreferenced(supabase, imgs.map((i) => i.path as string));
      return { ok: true };
    },
  }),

  duplicateProduct: defineAction({
    accept: 'json',
    input: id,
    handler: async ({ id: pid }, ctx) => {
      const supabase = db(ctx);
      const src = check(
        await supabase.from('products').select('*, product_variants(*)').eq('id', pid).single(),
      ).data!;
      const { id: _id, created_at: _c, updated_at: _u, product_variants, slug, name, ...rest } = src;
      let newSlug = `${slug}-copia`;
      for (let n = 2; ; n++) {
        const { data } = await supabase.from('products').select('id').eq('slug', newSlug).maybeSingle();
        if (!data) break;
        newSlug = `${slug}-copia-${n}`;
      }
      const created = check(
        await supabase
          .from('products')
          .insert({ ...rest, name: `${name} (copia)`, slug: newSlug, is_active: false })
          .select('id')
          .single(),
      ).data!;
      if (product_variants.length) {
        check(
          await supabase.from('product_variants').insert(
            product_variants.map((v: Record<string, unknown>) => {
              const { id: _vid, product_id: _p, updated_at: _vu, ...keep } = v;
              return { ...keep, product_id: created.id };
            }),
          ),
        );
      }
      return { id: created.id as string };
    },
  }),

  updateStock: defineAction({
    accept: 'json',
    input: z.array(stockUpdateSchema).min(1).max(200),
    handler: async (rows, ctx) => {
      const supabase = db(ctx);
      for (const r of rows) {
        check(await supabase.from('product_variants').update({ stock: r.stock }).eq('id', r.id));
      }
      return { ok: true };
    },
  }),

  /** Registra la foto ya subida a Storage por el navegador. */
  addImage: defineAction({
    accept: 'json',
    input: z.object({
      product_id: z.string().uuid(),
      variant_id: z.string().uuid().nullable(),
      path: z.string().min(3).max(200).regex(/^[\w\-./]+$/),
      alt: z.string().max(160).nullable(),
      sort_order: z.number().int().min(0),
    }),
    handler: async (input, ctx) => {
      const r = check(await db(ctx).from('product_images').insert(input).select('id').single());
      return { id: r.data!.id as string };
    },
  }),

  saveImages: defineAction({
    accept: 'json',
    input: z.array(imageMetaSchema).max(200),
    handler: async (rows, ctx) => {
      const supabase = db(ctx);
      for (const r of rows) {
        const { id: imgId, ...rest } = r;
        check(await supabase.from('product_images').update(rest).eq('id', imgId));
      }
      return { ok: true };
    },
  }),

  deleteImage: defineAction({
    accept: 'json',
    input: id,
    handler: async ({ id: imgId }, ctx) => {
      const supabase = db(ctx);
      const row = check(await supabase.from('product_images').select('path').eq('id', imgId).single()).data!;
      check(await supabase.from('product_images').delete().eq('id', imgId));
      await removeUnreferenced(supabase, [row.path as string]);
      return { ok: true };
    },
  }),

  /** Crea una marca o tipo; si ya existe (sin importar mayúsculas) devuelve el existente. */
  createOption: defineAction({
    accept: 'json',
    input: z.object({ table: createTable, name: optionNameSchema, parent_id: z.string().uuid().nullish() }),
    handler: async ({ table, name, parent_id }, ctx) => {
      const supabase = db(ctx);
      if (table === 'categories') {
        const { data: cats } = await supabase.from('categories').select('id, name, sort_order');
        const same = (cats ?? []).find((c) => c.name.trim().toLowerCase() === name.toLowerCase());
        if (same) return { id: same.id as string, name: same.name as string };
        const next = Math.max(0, ...(cats ?? []).map((c) => c.sort_order as number)) + 1;
        const r = check(
          await supabase.from('categories').insert({ name, slug: slugify(name), parent_id: parent_id ?? null, sort_order: next }).select('id, name').single(),
        );
        return { id: r.data!.id as string, name: r.data!.name as string };
      }
      const { data: all } = await supabase.from(table).select('id, name');
      const found = (all ?? []).find((r) => r.name.trim().toLowerCase() === name.toLowerCase());
      if (found) return { id: found.id as string, name: found.name as string };
      const r = check(await supabase.from(table).insert({ name }).select('id, name').single());
      return { id: r.data!.id as string, name: r.data!.name as string };
    },
  }),

  renameOption: defineAction({
    accept: 'json',
    input: z.object({ table: optionTable, id: z.string().uuid(), name: optionNameSchema }),
    handler: async ({ table, id: oid, name }, ctx) => {
      check(await db(ctx).from(table).update({ name }).eq('id', oid));
      return { ok: true };
    },
  }),

  deleteOption: defineAction({
    accept: 'json',
    input: z.object({ table: optionTable, id: z.string().uuid() }),
    handler: async ({ table, id: oid }, ctx) => {
      check(await db(ctx).from(table).delete().eq('id', oid));
      return { ok: true };
    },
  }),

  saveSettings: defineAction({
    accept: 'json',
    input: settingsInputSchema,
    handler: async (s, ctx) => {
      check(await db(ctx).from('store_settings').update(s).eq('id', true));
      return { ok: true };
    },
  }),

  saveCategory: defineAction({
    accept: 'json',
    input: categoryInputSchema,
    handler: async (c, ctx) => {
      const { id: cid, ...rest } = c;
      const row = { ...rest, slug: slugify(rest.slug || rest.name) };
      const q = db(ctx).from('categories');
      check(cid ? await q.update(row).eq('id', cid) : await q.insert(row));
      return { ok: true };
    },
  }),

  deleteCategory: defineAction({
    accept: 'json',
    input: id,
    handler: async ({ id: cid }, ctx) => {
      check(await db(ctx).from('categories').delete().eq('id', cid));
      return { ok: true };
    },
  }),

  saveFaq: defineAction({
    accept: 'json',
    input: faqInputSchema,
    handler: async (f, ctx) => {
      const { id: fid, ...row } = f;
      const q = db(ctx).from('faqs');
      check(fid ? await q.update(row).eq('id', fid) : await q.insert(row));
      return { ok: true };
    },
  }),

  deleteFaq: defineAction({
    accept: 'json',
    input: id,
    handler: async ({ id: fid }, ctx) => {
      check(await db(ctx).from('faqs').delete().eq('id', fid));
      return { ok: true };
    },
  }),
};
