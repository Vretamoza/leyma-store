import { useRef, useState } from 'react';
import { actions } from 'astro:actions';
import { createBrowser } from '../../lib/supabase';
import { compressImage } from './compress';
import OptionSelect, { type Option } from './OptionSelect';
import { Button, btnGhost, Card, Field, input, NoticeBar, run, useNotice } from './ui';

interface VariantRow {
  key: string;
  id?: string;
  name: string;
  code: string;
  swatch_hex: string;
  undertone: string;
  price_override: string;
  stock: string;
  is_active: boolean;
}
interface ImageRow {
  id: string;
  path: string;
  alt: string | null;
  variant_id: string | null;
  sort_order: number;
}
interface Props {
  product: Record<string, any> | null;
  categories: { id: string; name: string; parent_id: string | null }[];
  brands: Option[];
  types: Option[];
  supabaseUrl: string;
}

const SHORT_DETAILS: [string, string][] = [
  ['acabado', 'Acabado'],
  ['cobertura', 'Cobertura'],
  ['tipo_de_piel', 'Tipo de piel'],
  ['contenido', 'Contenido (ml / g)'],
  ['duracion', 'Duración'],
  ['material', 'Material'],
];
const LONG_DETAILS: [string, string][] = [
  ['modo_de_uso', 'Modo de uso (una línea por paso)'],
  ['ingredientes', 'Ingredientes (uno por línea)'],
  ['guia_tallas', 'Guía de tallas'],
];

const asLines = (v: unknown) => (Array.isArray(v) ? v.join('\n') : typeof v === 'string' ? v : '');

export default function ProductEditor({ product, categories, brands, types, supabaseUrl }: Props) {
  const isNew = !product;
  const [notice, setNotice] = useNotice();
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState<string>(product?.name ?? '');
  const [brandId, setBrandId] = useState<string>(product?.brand_id ?? '');
  const [typeId, setTypeId] = useState<string>(product?.product_type_id ?? '');
  const [slug, setSlug] = useState<string>(product?.slug ?? '');
  const [shortDesc, setShortDesc] = useState<string>(product?.short_description ?? '');
  const [description, setDescription] = useState<string>(product?.description ?? '');
  const [categoryId, setCategoryId] = useState<string>(product?.category_id ?? '');
  const [price, setPrice] = useState<string>(product ? String(product.base_price) : '');
  const [compareAt, setCompareAt] = useState<string>(product?.compare_at_price ? String(product.compare_at_price) : '');
  const [label, setLabel] = useState<string>(product?.variant_label ?? '');
  const [tags, setTags] = useState<string>((product?.tags ?? []).join(', '));
  const [active, setActive] = useState<boolean>(product?.is_active ?? true);
  const [featured, setFeatured] = useState<boolean>(product?.is_featured ?? false);
  const [details, setDetails] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    for (const [k, v] of Object.entries((product?.details ?? {}) as Record<string, unknown>)) d[k] = asLines(v);
    return d;
  });
  const [variants, setVariants] = useState<VariantRow[]>(() =>
    ((product?.product_variants ?? []) as any[])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({
        key: v.id,
        id: v.id,
        name: v.name,
        code: v.code ?? '',
        swatch_hex: v.swatch_hex ?? '',
        undertone: v.undertone ?? '',
        price_override: v.price_override != null ? String(v.price_override) : '',
        stock: String(v.stock),
        is_active: v.is_active,
      })),
  );
  const [images, setImages] = useState<ImageRow[]>(() =>
    ((product?.product_images ?? []) as ImageRow[]).sort((a, b) => a.sort_order - b.sort_order),
  );
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  /** variant_id al que van las fotos que se están eligiendo (null = generales). */
  const uploadTarget = useRef<string | null>(null);

  const hasVariants = variants.length > 0;
  const hiddenOnly = variants.length === 1 && variants[0].name === 'Única';

  function setVariant(key: string, patch: Partial<VariantRow>) {
    setVariants((all) => all.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  }
  function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const copy = [...list];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  }

  function buildDetails() {
    const out: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(details)) {
      const text = v.trim();
      if (!text) continue;
      out[k] = LONG_DETAILS.some(([lk]) => lk === k && k !== 'guia_tallas') ? text.split('\n').map((l) => l.trim()).filter(Boolean) : text;
    }
    return out;
  }

  async function save() {
    setBusy(true);
    const toVariants = variants.map((v, i) => ({
      id: v.id,
      name: v.name,
      code: v.code || null,
      swatch_hex: v.swatch_hex || null,
      undertone: (v.undertone || null) as 'frío' | 'cálido' | 'neutro' | null,
      price_override: v.price_override === '' ? null : Number(v.price_override),
      stock: Number(v.stock || 0),
      sort_order: i,
      is_active: v.is_active,
    }));
    const res = await run(
      actions.saveProduct({
        id: product?.id,
        name,
        brand_id: brandId || null,
        product_type_id: typeId || null,
        slug: slug || undefined,
        short_description: shortDesc,
        description,
        category_id: categoryId || null,
        base_price: Number(price || 0),
        compare_at_price: compareAt === '' ? null : Number(compareAt),
        variant_label: (label || null) as 'Tono' | 'Talla' | 'Color' | null,
        details: buildDetails(),
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        is_active: active,
        is_featured: featured,
        variants: toVariants,
      }),
    );
    setBusy(false);
    if ('error' in res) return setNotice({ kind: 'error', text: res.error });
    if (isNew) {
      window.location.href = `/admin/productos/${res.data.id}?nuevo=1`;
      return;
    }
    setNotice({ kind: 'ok', text: 'Guardado. Ya está publicado en la tienda.' });
    // Recarga para tener los ids de las variantes nuevas (necesarios para asignar fotos).
    setTimeout(() => window.location.reload(), 900);
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length || !product) return;
    const variantId = uploadTarget.current;
    setUploading(true);
    const supabase = createBrowser();
    let next = images.length;
    const added: ImageRow[] = [];
    try {
      for (const file of Array.from(files)) {
        const { blob, ext } = await compressImage(file);
        const path = `${product.id}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from('product-images').upload(path, blob, {
          contentType: blob.type,
          cacheControl: '31536000',
        });
        if (up.error) throw new Error(up.error.message);
        const r = await run(
          actions.addImage({ product_id: product.id, variant_id: variantId, path, alt: null, sort_order: next }),
        );
        if ('error' in r) {
          await supabase.storage.from('product-images').remove([path]);
          throw new Error(r.error);
        }
        added.push({ id: r.data.id, path, alt: null, variant_id: variantId, sort_order: next++ });
      }
      setNotice({ kind: 'ok', text: `${added.length} foto(s) subida(s)` });
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : 'No se pudo subir la foto' });
    }
    setImages((all) => [...all, ...added]);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function pickFiles(variantId: string | null) {
    uploadTarget.current = variantId;
    fileRef.current?.click();
  }

  async function saveImages() {
    const res = await run(
      actions.saveImages(
        images.map((im, i) => ({ id: im.id, variant_id: im.variant_id, alt: im.alt, sort_order: i })),
      ),
    );
    setNotice('error' in res ? { kind: 'error', text: res.error } : { kind: 'ok', text: 'Fotos guardadas' });
  }

  async function removeImage(im: ImageRow) {
    const res = await run(actions.deleteImage({ id: im.id }));
    if ('error' in res) return setNotice({ kind: 'error', text: res.error });
    setImages((all) => all.filter((x) => x.id !== im.id));
  }

  async function remove() {
    if (!product || !confirm('¿Eliminar este producto y sus fotos? No se puede deshacer.')) return;
    const res = await run(actions.deleteProduct({ id: product.id }));
    if ('error' in res) return setNotice({ kind: 'error', text: res.error });
    window.location.href = '/admin/productos';
  }

  const namedVariants = variants.filter((v) => v.id && !(hiddenOnly));
  const cell = `${input} !py-2`;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold text-primary">{isNew ? 'Nuevo producto' : 'Editar producto'}</h1>
        {!isNew && <a href={`/p/${product!.slug}`} className="text-sm text-muted underline" target="_blank" rel="noreferrer">Ver ficha</a>}
      </div>

      <Card title="Datos generales">
        <Field label="Tipo de producto" hint="Ej. Polvo traslúcido, Labial, Kit">
          <OptionSelect table="product_types" noun="tipo" options={types} value={typeId} onChange={setTypeId} onError={(text) => setNotice({ kind: 'error', text })} />
        </Field>
        <Field label="Nombre" hint="Ej. Flawless Bake">
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Marca" hint="Ej. Enchanté">
          <OptionSelect table="brands" noun="marca" options={brands} value={brandId} onChange={setBrandId} onError={(text) => setNotice({ kind: 'error', text })} />
        </Field>
        <Field label="Enlace (opcional)" hint="Se genera del nombre si lo dejas vacío">
          <input className={input} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="labial-velvet" />
        </Field>
        <Field label="Descripción corta"><input className={input} value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} /></Field>
        <Field label="Descripción"><textarea className={input} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Categoría" hint="Si no existe, créala aquí, como principal o como subcategoría.">
          <OptionSelect
            table="categories"
            noun="categoría"
            parents={categories.filter((c) => !c.parent_id).map((c) => ({ id: c.id, name: c.name }))}
            options={categories.map((c) => ({ id: c.id, name: `${c.parent_id ? '— ' : ''}${c.name}` }))}
            value={categoryId}
            onChange={setCategoryId}
            onError={(text) => setNotice({ kind: 'error', text })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio (COP)"><input className={input} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Precio anterior"><input className={input} inputMode="numeric" value={compareAt} onChange={(e) => setCompareAt(e.target.value.replace(/\D/g, ''))} /></Field>
        </div>
        <Field label="Etiquetas" hint="Separadas por coma">
          <input className={input} value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
        <label className="flex items-center gap-3"><input type="checkbox" className="h-5 w-5" checked={active} onChange={(e) => setActive(e.target.checked)} /> Publicado en la tienda</label>
        <label className="flex items-center gap-3"><input type="checkbox" className="h-5 w-5" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> Destacado en el inicio</label>
      </Card>

      <Card title="Detalles">
        {SHORT_DETAILS.map(([k, l]) => (
          <Field key={k} label={l}><input className={input} value={details[k] ?? ''} onChange={(e) => setDetails({ ...details, [k]: e.target.value })} /></Field>
        ))}
        {LONG_DETAILS.map(([k, l]) => (
          <Field key={k} label={l}><textarea className={input} rows={3} value={details[k] ?? ''} onChange={(e) => setDetails({ ...details, [k]: e.target.value })} /></Field>
        ))}
      </Card>

      <Card title="Variantes y stock">
        <Field label="Tipo de variante" hint="Déjalo vacío si el producto es único">
          <select className={input} value={label} onChange={(e) => setLabel(e.target.value)}>
            <option value="">Producto único</option>
            <option value="Tono">Tono</option>
            <option value="Talla">Talla</option>
            <option value="Color">Color</option>
          </select>
        </Field>
        {hasVariants && (
          <ul className="space-y-3">
            {variants.map((v, i) => (
              <li key={v.key} className="space-y-2 rounded-xl border border-line p-3">
                <div className="flex gap-2">
                  <input className={cell} placeholder="Nombre (03 Beige cálido)" aria-label="Nombre de la variante" value={v.name} onChange={(e) => setVariant(v.key, { name: e.target.value })} />
                  <input type="color" aria-label="Color de muestra" className="h-11 w-14 shrink-0 rounded-lg border border-outline bg-surface" value={v.swatch_hex || '#e6eaef'} onChange={(e) => setVariant(v.key, { swatch_hex: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input className={cell} placeholder="Código" aria-label="Código" value={v.code} onChange={(e) => setVariant(v.key, { code: e.target.value })} />
                  <input className={cell} inputMode="numeric" placeholder="Stock" aria-label="Stock" value={v.stock} onChange={(e) => setVariant(v.key, { stock: e.target.value.replace(/\D/g, '') })} />
                  <input className={cell} inputMode="numeric" placeholder="Precio propio" aria-label="Precio propio" value={v.price_override} onChange={(e) => setVariant(v.key, { price_override: e.target.value.replace(/\D/g, '') })} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select className={`${cell} !w-auto`} aria-label="Subtono" value={v.undertone} onChange={(e) => setVariant(v.key, { undertone: e.target.value })}>
                    <option value="">Sin subtono</option>
                    <option value="frío">Frío</option>
                    <option value="cálido">Cálido</option>
                    <option value="neutro">Neutro</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.is_active} onChange={(e) => setVariant(v.key, { is_active: e.target.checked })} /> Activa</label>
                  <span className="ml-auto flex gap-1">
                    <button type="button" className={btnGhost} aria-label="Subir" onClick={() => setVariants(move(variants, i, -1))}>↑</button>
                    <button type="button" className={btnGhost} aria-label="Bajar" onClick={() => setVariants(move(variants, i, 1))}>↓</button>
                    <button type="button" className={btnGhost} aria-label="Quitar variante" onClick={() => setVariants(variants.filter((x) => x.key !== v.key))}>Quitar</button>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
                  {v.id ? (
                    <>
                      {images
                        .filter((im) => im.variant_id === v.id)
                        .map((im) => (
                          <span key={im.id} className="relative h-16 w-12 overflow-hidden rounded-lg bg-ph">
                            <img src={`${supabaseUrl}/storage/v1/object/public/product-images/${im.path}`} alt="" className="h-full w-full object-cover" loading="lazy" />
                            <button type="button" aria-label="Quitar foto" className="absolute right-0 top-0 flex size-7 items-center justify-center rounded-bl-lg bg-surface/90 text-xs transition hover:bg-tint active:bg-line" onClick={() => removeImage(im)}>✕</button>
                          </span>
                        ))}
                      <Button variant="ghost" busy={uploading} busyText="Subiendo…" onClick={() => pickFiles(v.id!)}>
                        {'+ Fotos de este ' + (label ? label.toLowerCase() : 'tono')}
                      </Button>
                    </>
                  ) : (
                    <span className="text-sm text-muted">Guarda el producto para subir las fotos de esta variante.</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className={btnGhost}
          onClick={() => setVariants([...variants, { key: crypto.randomUUID(), name: '', code: '', swatch_hex: '', undertone: '', price_override: '', stock: '0', is_active: true }])}
        >
          + Agregar {label ? label.toLowerCase() : 'variante'}
        </button>
        {!hasVariants && <p className="text-sm text-muted">Sin variantes se crea una variante “Única” oculta con stock 0. Agrega una para controlar el stock.</p>}
      </Card>

      {!isNew && (
        <Card title="Todas las fotos">
          <p className="text-sm text-muted">Se comprimen a WebP automáticamente. Asigna cada foto a un {label ? label.toLowerCase() : 'tono'} o déjala general.</p>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
          <Button busy={uploading} busyText="Subiendo…" onClick={() => pickFiles(null)}>
            + Subir fotos
          </Button>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((im, i) => (
              <li key={im.id} className="space-y-2 rounded-xl border border-line p-2">
                <img src={`${supabaseUrl}/storage/v1/object/public/product-images/${im.path}`} alt={im.alt ?? ''} className="aspect-[4/5] w-full rounded-lg bg-ph object-cover" loading="lazy" />
                <select
                  className={cell}
                  aria-label="Asignar a"
                  value={im.variant_id ?? ''}
                  onChange={(e) => setImages((all) => all.map((x) => (x.id === im.id ? { ...x, variant_id: e.target.value || null } : x)))}
                >
                  <option value="">General</option>
                  {namedVariants.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <div className="flex gap-1">
                  <button type="button" className={`${btnGhost} flex-1`} aria-label="Mover antes" onClick={() => setImages(move(images, i, -1))}>←</button>
                  <button type="button" className={`${btnGhost} flex-1`} aria-label="Mover después" onClick={() => setImages(move(images, i, 1))}>→</button>
                  <Button variant="ghost" className="flex-1" aria-label="Eliminar foto" onClick={() => removeImage(im)}>✕</Button>
                </div>
              </li>
            ))}
          </ul>
          {images.length > 0 && <Button busyText="Guardando…" onClick={saveImages}>Guardar orden y asignaciones</Button>}
          {hasVariants && namedVariants.length < variants.length && (
            <p className="text-sm text-muted">Guarda el producto para poder asignar fotos a las variantes nuevas.</p>
          )}
        </Card>
      )}
      {isNew && <p className="text-sm text-muted">Las fotos se suben después de guardar por primera vez.</p>}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-bg px-4 py-3">
        <div className="mx-auto flex max-w-4xl gap-2">
          <Button className="flex-1" busy={busy} busyText="Guardando…" onClick={save}>Guardar</Button>
          {!isNew && <Button variant="ghost" disabled={busy} onClick={remove}>Eliminar</Button>}
        </div>
      </div>
      <NoticeBar notice={notice} />
    </div>
  );
}
