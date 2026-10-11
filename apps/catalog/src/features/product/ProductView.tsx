import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  availabilityMessage,
  discountPercent,
  formatCOP,
  galleryImages,
  isNew,
  mergeLiveVariants,
  pickVariant,
  stockStatus,
  variantKey,
  variantParam,
  variantPrice,
  whatsappUrl,
  type BagLine,
  type Product,
  type Undertone,
  type Variant,
} from '@leyma/core';
import type { ArtKind } from '../../lib/art';
import { imageUrl } from '../../lib/images';
import { addToBag } from '../bag/store';
import { sendOrder } from '../bag/order';
import { Gallery, type Slide } from './Gallery';
import { ProductArt } from './ProductArt';

interface Props {
  product: Product;
  /** Valor de `?tono=` con el que se abrió la página. */
  initialKey: string | null;
  eyebrow: string;
  art: ArtKind;
  store: { name: string; whatsapp: string; lowStock: number; newDays: number };
  /** Contenido de la columna derecha debajo de los botones (acordeones, envíos…). */
  children?: ReactNode;
}

const UNDERTONES: { value: Undertone; label: string }[] = [
  { value: 'frío', label: 'Frío' },
  { value: 'cálido', label: 'Cálido' },
  { value: 'neutro', label: 'Neutro' },
];
const SUBTONE_FILTER_FROM = 8;

export default function ProductView({ product, initialKey, eyebrow, art, store, children }: Props) {
  const [variants, setVariants] = useState<Variant[]>(product.product_variants);
  const [selectedId, setSelectedId] = useState<string | undefined>(() => pickVariant(product.product_variants, initialKey)?.id);
  const [undertone, setUndertone] = useState<Undertone | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const sorted = useMemo(() => [...variants].sort((a, b) => a.sort_order - b.sort_order), [variants]);
  const selected = sorted.find((v) => v.id === selectedId) ?? sorted[0];
  const label = product.variant_label;
  const showSelector = Boolean(label) && sorted.length > 0;

  // Stock y precio en vivo: el HTML puede venir de la caché de 5 minutos.
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      // Se carga aparte para no sumar supabase-js al primer pintado.
      const { createPublicClient } = await import('../../lib/supabase-browser');
      const supabase = createPublicClient();
      const { data } = await supabase
        .from('product_variants')
        .select('id, stock, price_override')
        .eq('product_id', product.id);
      if (!cancelled && data) setVariants((prev) => mergeLiveVariants(prev, data));
    }
    refresh();
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [product.id]);

  function select(v: Variant) {
    setSelectedId(v.id);
    setQuantity(1);
    const url = new URL(window.location.href);
    url.searchParams.set(variantParam(label), variantKey(v));
    window.history.replaceState(null, '', url);
  }

  const price = selected ? variantPrice(product, selected) : product.base_price;
  const off = discountPercent(price, product.compare_at_price);
  const status = selected ? stockStatus(selected.stock, store.lowStock) : 'in';
  const out = status === 'out';
  const productNew = isNew(product.created_at, store.newDays);

  const slides: Slide[] = useMemo(() => {
    const imgs = galleryImages(product.product_images, selected?.id ?? null);
    return imgs.map((i) => ({ id: i.id, src: imageUrl(i.path), alt: i.alt ?? `${product.name}${selected ? `, ${selected.name}` : ''}` }));
  }, [product, selected]);
  const artHex = selected?.swatch_hex ?? '#D6AB84';
  const galleryLabel = label && selected ? `Fotos del ${label.toLowerCase()} ${selected.name}` : `Fotos de ${product.name}`;
  const gallerySlides = slides.length ? slides : [{ id: 'art', alt: product.name }];

  const showFilter = sorted.length > SUBTONE_FILTER_FROM;
  const tones = showFilter ? UNDERTONES.filter((t) => sorted.some((v) => v.undertone === t.value)) : [];
  const visible = showFilter && undertone ? sorted.filter((v) => v.undertone === undertone) : sorted;

  const similar = out
    ? sorted.find((v) => v.stock > 0 && v.undertone && v.undertone === selected?.undertone) ?? sorted.find((v) => v.stock > 0)
    : undefined;
  const ask = whatsappUrl(store.whatsapp, availabilityMessage(store.name, product, selected?.name ?? null));

  const maxQty = selected ? Math.max(1, selected.stock) : 1;
  const qty = Math.min(quantity, maxQty);
  const photo = galleryImages(product.product_images, selected?.id ?? null)[0];

  function currentLine(): Omit<BagLine, 'quantity'> | null {
    if (!selected) return null;
    return {
      variantId: selected.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      variantLabel: label,
      variantName: label ? selected.name : null,
      hex: selected.swatch_hex,
      image: photo?.path ?? null,
      art,
      unitPrice: price,
    };
  }

  function addToCart() {
    const line = currentLine();
    if (!line || !selected) return;
    const result = addToBag(line, qty, selected.stock);
    clearTimeout(toastTimer.current);
    setToast(result.added > 0 ? `Agregado a la bolsa${label ? ` · ${selected.name}` : ''}` : 'Ya tienes todo el stock de este producto en tu bolsa');
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  function orderNow() {
    const line = currentLine();
    if (!line) return;
    sendOrder({ storeName: store.name, whatsapp: store.whatsapp, lines: [{ ...line, quantity: qty }] });
  }
  const canOrderNow = Boolean(whatsappUrl(store.whatsapp, 'x'));

  const group = useRef<HTMLDivElement>(null);
  function onKey(e: KeyboardEvent) {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const i = visible.findIndex((v) => v.id === selected?.id);
    const next = visible[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : visible.length - 1)) % visible.length];
    if (next) {
      select(next);
      group.current?.querySelector<HTMLButtonElement>(`[data-vid="${next.id}"]`)?.focus();
    }
  }

  const badges = (
    <>
      {productNew && !out && (
        <span className="absolute left-3 top-3 rounded-full border border-gold bg-surface px-2.5 py-1 text-[11px] font-semibold tracking-wide text-gold-ink">NUEVO</span>
      )}
      {out && (
        <span className="absolute right-3 top-3 rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-bg">
          {label ? `Agotado en este ${label.toLowerCase()}` : 'Agotado'}
        </span>
      )}
    </>
  );

  return (
    <div className="grid items-start gap-6 md:grid-cols-2 md:gap-12">
      <div className="md:sticky md:top-6">
        <Gallery
          slides={gallerySlides}
          label={galleryLabel}
          resetKey={selected?.id ?? 'none'}
          badges={badges}
          art={<ProductArt kind={art} hex={artHex} label={`${product.name}${selected ? `, ${selected.name}` : ''}`} />}
        />
      </div>

      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 text-xs tracking-[1.4px] text-muted">{eyebrow}</p>}
        <h1 className="font-serif text-[34px] font-semibold leading-[1.05] md:text-[44px]">{product.name}</h1>
        {product.short_description && <p className="mt-2 text-sm leading-normal text-muted md:text-[15px]">{product.short_description}</p>}
        <div className="mt-3.5 flex items-baseline gap-2.5">
          <span className="text-2xl font-semibold">{formatCOP(price)}</span>
          {off !== null && product.compare_at_price !== null && (
            <>
              <span className="text-[15px] text-muted line-through">{formatCOP(product.compare_at_price)}</span>
              <span className="rounded-full bg-tint px-2 py-[3px] text-xs font-semibold text-primary">-{off}%</span>
            </>
          )}
        </div>

        {showSelector && selected && (
          <section aria-labelledby="variante-h" className="mt-5 border-t border-line pt-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="variante-h" className="text-sm font-semibold">
                {label}: <span className="font-normal">{selected.name}</span>
              </h2>
              {selected.undertone && <span className="text-xs text-muted">Subtono {selected.undertone}</span>}
            </div>

            {tones.length > 1 && (
              <div role="group" aria-label="Filtrar por subtono" className="mt-3.5 flex flex-wrap gap-2">
                {[{ value: null, label: 'Todos' }, ...tones].map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    aria-pressed={undertone === t.value}
                    onClick={() => setUndertone(t.value as Undertone | null)}
                    className={`h-[34px] cursor-pointer rounded-full border px-3.5 text-[13px] ${undertone === t.value ? 'border-secondary bg-tint font-semibold' : 'border-line bg-surface'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            <div ref={group} role="radiogroup" aria-label={label ?? 'Opciones'} onKeyDown={onKey} className="mt-4 flex flex-wrap gap-1.5">
              {visible.map((v) => {
                const isSel = v.id === selected.id;
                const vOut = v.stock <= 0;
                const text = `${v.name}${vOut ? ', agotado' : ''}`;
                return v.swatch_hex ? (
                  <button
                    key={v.id}
                    data-vid={v.id}
                    type="button"
                    role="radio"
                    aria-checked={isSel}
                    aria-label={text}
                    title={text}
                    tabIndex={isSel ? 0 : -1}
                    onClick={() => select(v)}
                    className="relative flex size-12 cursor-pointer items-center justify-center border-0 bg-transparent p-0"
                  >
                    <span
                      className="relative block size-[38px] overflow-hidden rounded-full transition-shadow duration-200"
                      style={{
                        background: v.swatch_hex ?? '#ccc',
                        boxShadow: isSel
                          ? '0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-primary)'
                          : 'inset 0 0 0 1px rgba(37,52,79,.18)',
                      }}
                    >
                      {vOut && (
                        <span
                          className="absolute left-[-4px] top-[18px] block h-[1.5px] w-[46px] -rotate-45 bg-surface"
                          style={{ boxShadow: '0 0 0 .5px rgba(37,52,79,.5)' }}
                        />
                      )}
                    </span>
                  </button>
                ) : (
                  <button
                    key={v.id}
                    data-vid={v.id}
                    type="button"
                    role="radio"
                    aria-checked={isSel}
                    aria-label={text}
                    tabIndex={isSel ? 0 : -1}
                    onClick={() => select(v)}
                    className={`h-11 min-w-12 cursor-pointer rounded-full border px-4 text-sm ${isSel ? 'border-primary bg-tint font-semibold' : 'border-line bg-surface'} ${vOut ? 'text-muted line-through' : ''}`}
                  >
                    {v.name}
                  </button>
                );
              })}
            </div>
            {showFilter && (
              <p className="mt-2.5 text-xs text-muted">
                {visible.length} de {sorted.length} {label === 'Tono' ? 'tonos' : 'opciones'}
              </p>
            )}
          </section>
        )}

        <div aria-live="polite" className="mt-[18px]">
          {selected && status === 'in' && (
            <p className="flex items-center gap-2 text-sm">
              <span className="size-2 rounded-full bg-[#5F8A69]" />
              Disponible · listo para enviar
            </p>
          )}
          {selected && status === 'low' && (
            <p className="inline-flex items-center gap-2 rounded-full bg-gold-tint px-3 py-2 text-sm font-medium text-gold-ink">
              <span className="size-2 rounded-full bg-gold" />
              ¡Últimas {selected.stock} {selected.stock === 1 ? 'unidad' : 'unidades'}{label ? ` en este ${label.toLowerCase()}` : ''}!
            </p>
          )}
          {selected && out && (
            <div className="rounded-xl border border-line bg-surface px-3.5 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span className="size-2 rounded-full border-[1.5px] border-muted" />
                {label ? `Agotado en este ${label.toLowerCase()}` : 'Agotado'}
              </p>
              <p className="ml-4 mt-1 text-[13px] leading-snug text-muted">
                Puedes ver sus fotos. Escríbenos y te avisamos cuando vuelva{similar ? ', o te sugerimos uno parecido' : ''}.
              </p>
            </div>
          )}
        </div>

        {out && (
          <div className="mt-[18px] flex flex-col gap-2.5">
            {ask && (
              <a href={ask} rel="noopener" className="flex h-[52px] items-center justify-center rounded-full bg-primary text-[15px] font-semibold text-bg no-underline hover:bg-primary-dark">
                Preguntar por disponibilidad
              </a>
            )}
            {similar && (
              <button type="button" onClick={() => select(similar)} className="h-11 cursor-pointer border-0 bg-transparent text-sm font-semibold text-primary underline">
                Ver {label === 'Tono' ? 'un tono parecido disponible' : 'otra opción disponible'}
              </button>
            )}
          </div>
        )}

        {selected && !out && (
          <div className="mt-[18px] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span id="cant-l" className="text-sm font-semibold">Cantidad</span>
              <div role="group" aria-labelledby="cant-l" className="flex h-11 items-center rounded-full border border-outline">
                <button type="button" aria-label="Quitar uno" disabled={qty <= 1} onClick={() => setQuantity(qty - 1)} className="h-[42px] w-11 cursor-pointer border-0 bg-transparent text-xl text-ink disabled:cursor-default disabled:text-muted">−</button>
                <span className="w-8 text-center text-[15px] font-semibold" aria-live="polite">{qty}</span>
                <button type="button" aria-label="Agregar uno" disabled={qty >= maxQty} onClick={() => setQuantity(qty + 1)} className="h-[42px] w-11 cursor-pointer border-0 bg-transparent text-xl text-ink disabled:cursor-default disabled:text-muted">+</button>
              </div>
            </div>
            <button type="button" onClick={addToCart} className="h-[52px] cursor-pointer rounded-full border-0 bg-primary text-[15px] font-semibold tracking-[.2px] text-bg hover:bg-primary-dark">
              Agregar a la bolsa · {formatCOP(price * qty)}
            </button>
            {canOrderNow && (
              <button type="button" onClick={orderNow} className="flex h-[52px] cursor-pointer items-center justify-center gap-2 rounded-full border border-primary bg-surface text-[15px] font-semibold text-primary">
                Pedir ya por WhatsApp
              </button>
            )}
          </div>
        )}

        {children}
      </div>

      {selected && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-line bg-surface px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 md:hidden">
          {selected.swatch_hex && <span className="size-7 shrink-0 rounded-full border border-line" style={{ background: selected.swatch_hex }} />}
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-xs text-muted">{label ? selected.name : product.name}</div>
            <div className="text-[17px] font-semibold">{formatCOP(price)}</div>
          </div>
          {out ? (
            ask && <a href={ask} rel="noopener" className="flex h-12 items-center rounded-full bg-primary px-[18px] text-sm font-semibold text-bg no-underline">Preguntar disponibilidad</a>
          ) : (
            <button type="button" onClick={addToCart} className="h-12 cursor-pointer rounded-full border-0 bg-primary px-[22px] text-[15px] font-semibold text-bg">Agregar a la bolsa</button>
          )}
        </div>
      )}

      {toast && (
        <div role="status" className="toast-in fixed inset-x-4 bottom-[88px] z-30 flex items-center gap-2.5 rounded-xl bg-ink px-3.5 py-3 text-sm text-bg md:inset-x-auto md:bottom-6 md:right-6 md:w-[380px]">
          <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-tint text-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
          </span>
          <span className="flex-1">{toast}</span>
          <a href="/bolsa" className="font-semibold text-gold">Ver bolsa</a>
        </div>
      )}
    </div>
  );
}
