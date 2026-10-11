import { useStore } from '@nanostores/react';
import { useEffect, useMemo, useState } from 'react';
import {
  bagTotal,
  bagUnits,
  buildOrderMessage,
  formatCOP,
  generateRef,
  lineLabel,
  lineTotal,
  orderableLines,
  reconcileBag,
  type BagCheck,
  type BagIssue,
  type BagLine,
  type LiveVariant,
} from '@leyma/core';
import { imageUrl } from '../../lib/images';
import { ProductArt } from '../product/ProductArt';
import { $bag, $customer, changeQuantity, removeFromBag } from './store';
import { orderUrl, sendOrder } from './order';
import { useBag } from './useBag';

interface Props {
  store: { name: string; whatsapp: string };
}

interface VariantRow {
  id: string;
  stock: number;
  price_override: number | null;
  products: { base_price: number } | { base_price: number }[] | null;
}

async function fetchLive(ids: string[]): Promise<LiveVariant[]> {
  const { createPublicClient } = await import('../../lib/supabase-browser');
  const { data, error } = await createPublicClient()
    .from('product_variants')
    .select('id, stock, price_override, products(base_price)')
    .in('id', ids);
  if (error || !data) throw new Error(error?.message ?? 'sin datos');
  return (data as unknown as VariantRow[]).flatMap((row) => {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    // Producto inactivo u oculto: se trata como que ya no existe.
    return product ? [{ variantId: row.id, stock: row.stock, unitPrice: row.price_override ?? product.base_price }] : [];
  });
}

function issueText(issue: BagIssue, lines: BagLine[]): string {
  const line = lines.find((l) => l.variantId === issue.variantId);
  const name = line ? lineLabel(line) : 'Un producto';
  switch (issue.type) {
    case 'out':
    case 'unavailable':
      return `${name} se agotó. No lo incluiremos en el mensaje. Puedes quitarlo o preguntarnos por uno similar.`;
    case 'reduced':
      return `Ajustamos ${name} a ${issue.to} ${issue.to === 1 ? 'unidad' : 'unidades'}, que es lo que hay disponible.`;
    case 'price':
      return `El precio de ${name} cambió de ${formatCOP(issue.from)} a ${formatCOP(issue.to)}.`;
  }
}

export default function BagView({ store }: Props) {
  const { lines, ready } = useBag();
  const customer = useStore($customer);
  const [check, setCheck] = useState<BagCheck | null>(null);
  const [notices, setNotices] = useState<{ issues: BagIssue[]; lines: BagLine[] }>({ issues: [], lines: [] });
  const [ref, setRef] = useState(() => generateRef());

  // Valida contra el stock y los precios actuales al abrir la bolsa.
  const idsKey = lines.map((l) => l.variantId).sort().join(',');
  useEffect(() => {
    if (!ready || lines.length === 0) {
      setCheck(null);
      return;
    }
    let cancelled = false;
    fetchLive(lines.map((l) => l.variantId))
      .then((live) => {
        if (cancelled) return;
        const result = reconcileBag($bag.get(), live);
        const adjusted = result.issues.filter((i) => i.type === 'reduced' || i.type === 'price');
        if (adjusted.length) $bag.set(result.lines);
        setCheck(result);
        setNotices((prev) => {
          const known = new Set(prev.issues.map((i) => `${i.type}:${i.variantId}`));
          const fresh = result.issues.filter((i) => !known.has(`${i.type}:${i.variantId}`));
          return { issues: [...prev.issues.filter((i) => result.issues.some((r) => r.type === i.type && r.variantId === i.variantId)), ...fresh], lines: result.lines };
        });
      })
      .catch(() => {
        // Sin conexión: se puede pedir igual; el stock se confirma por WhatsApp.
        if (!cancelled) setCheck(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, idsKey]);

  const stock = check?.stock ?? {};
  const orderable = useMemo(() => orderableLines(lines, stock), [lines, stock]);
  const total = bagTotal(orderable);
  const units = bagUnits(orderable);
  const message = buildOrderMessage({ storeName: store.name, lines: orderable, ref, customer });
  const canSend = orderable.length > 0 && orderUrl({ ...store, storeName: store.name, lines: orderable, customer, ref }) !== null;
  const hasOut = lines.some((l) => (stock[l.variantId] ?? 1) <= 0);

  function send() {
    if (sendOrder({ storeName: store.name, whatsapp: store.whatsapp, lines: orderable, customer, ref })) setRef(generateRef());
  }

  if (!ready) {
    return (
      <div aria-hidden="true" className="space-y-4 px-4 py-6">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="sk h-[105px] w-[84px] rounded-[10px]" />
            <div className="flex-1 space-y-2">
              <div className="sk h-4 w-2/3 rounded-md" />
              <div className="sk h-3 w-1/3 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center px-10 py-16 text-center">
        <span className="flex size-28 items-center justify-center rounded-full bg-tint text-secondary">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 8h14l-1 12H6L5 8z" />
            <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
          </svg>
        </span>
        <div className="my-6 h-px w-10 bg-gold" />
        <h2 className="font-serif text-[32px] font-semibold leading-[1.1]">Tu bolsa está vacía</h2>
        <p className="mt-3 max-w-sm text-[15px] leading-[1.55] text-muted">
          Elige tus favoritos, agrégalos aquí y nos envías el pedido por WhatsApp con un solo toque.
        </p>
        <a href="/c/maquillaje" className="mt-7 flex h-[52px] items-center rounded-full bg-primary px-7 text-[15px] font-semibold text-bg no-underline hover:bg-primary-dark">
          Explorar novedades
        </a>
        <a href="/" className="mt-3.5 text-sm font-medium">Ver categorías</a>
      </div>
    );
  }

  const input = 'mt-1 block h-[46px] w-full rounded-[10px] border border-outline bg-surface px-3.5 text-[15px] text-ink';

  return (
    <div className="pb-40 md:grid md:grid-cols-[1fr_380px] md:items-start md:gap-12 md:pb-0">
      <div>
        {notices.issues.length > 0 && (
          <div role="alert" className="mt-4 space-y-2">
            {notices.issues.map((issue) => (
              <p key={`${issue.type}:${issue.variantId}`} className="rounded-xl border border-gold bg-surface px-3.5 py-3 text-[13px] leading-[1.45]">
                {issueText(issue, notices.lines.length ? notices.lines : lines)}
              </p>
            ))}
          </div>
        )}

        <ul className="m-0 mt-2 list-none p-0">
          {lines.map((line) => {
            const out = (stock[line.variantId] ?? 1) <= 0;
            const max = stock[line.variantId];
            const label = line.variantName;
            return (
              <li key={line.variantId} className={`flex gap-3 border-b border-line py-4 ${out ? 'opacity-70' : ''}`}>
                <a href={`/p/${line.slug}`} className="relative block h-[105px] w-[84px] shrink-0 overflow-hidden rounded-[10px] border border-line bg-ph">
                  {line.image ? (
                    <img src={imageUrl(line.image)} alt="" width={84} height={105} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <ProductArt kind={line.art} hex={line.hex ?? '#D6AB84'} label={line.name} />
                  )}
                </a>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex justify-between gap-2">
                    <a href={`/p/${line.slug}`} className="text-[15px] font-medium text-ink no-underline">{line.name}</a>
                    <button
                      type="button"
                      onClick={() => removeFromBag(line.variantId)}
                      aria-label={`Quitar ${line.name}`}
                      className="-mr-1.5 -mt-1.5 flex size-8 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent text-muted"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </div>
                  {label && (
                    <p className="mt-[3px] flex items-center gap-1.5 text-[13px] text-muted">
                      {line.hex && <span className="size-3 rounded-full" style={{ background: line.hex, boxShadow: 'inset 0 0 0 1px rgba(37,52,79,.14)' }} />}
                      {label}
                    </p>
                  )}
                  {out ? (
                    <p className="mt-2 flex items-center gap-2.5 text-[13px]">
                      <span className="rounded-full border border-outline bg-surface px-2.5 py-[3px] text-[11px] font-semibold text-ink">Agotado</span>
                      <a href={`/p/${line.slug}`} className="font-semibold">Ver opciones similares</a>
                    </p>
                  ) : (
                    <div className="mt-auto flex items-center justify-between pt-2.5">
                      <div role="group" aria-label={`Cantidad de ${lineLabel(line)}`} className="flex h-9 items-center rounded-full border border-outline">
                        <button type="button" aria-label="Quitar uno" disabled={line.quantity <= 1} onClick={() => changeQuantity(line.variantId, line.quantity - 1, max)} className="size-9 cursor-pointer border-0 bg-transparent text-lg text-ink disabled:cursor-default disabled:text-muted">−</button>
                        <span className="w-6 text-center text-sm font-semibold" aria-live="polite">{line.quantity}</span>
                        <button type="button" aria-label="Agregar uno" disabled={max !== undefined && line.quantity >= max} onClick={() => changeQuantity(line.variantId, line.quantity + 1, max)} className="size-9 cursor-pointer border-0 bg-transparent text-lg text-ink disabled:cursor-default disabled:text-muted">+</button>
                      </div>
                      <span className="text-[15px] font-semibold">{formatCOP(lineTotal(line))}</span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="md:sticky md:top-6">
        <section aria-label="Resumen" className="mt-5 flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-4 text-sm md:mt-2">
          <div className="flex justify-between"><span className="text-muted">Productos ({units})</span><span>{formatCOP(total)}</span></div>
          <div className="flex justify-between"><span className="text-muted">Envío</span><span className="text-muted">Se confirma por WhatsApp</span></div>
          <div className="h-px bg-line" />
          <div className="flex items-baseline justify-between"><span className="font-semibold">Total estimado</span><span className="text-xl font-semibold">{formatCOP(total)}</span></div>
        </section>

        <section aria-labelledby="datos-h" className="mt-6">
          <h2 id="datos-h" className="mb-1 text-sm font-semibold">Tus datos <span className="font-normal text-muted">(opcional)</span></h2>
          <p className="mb-3 text-[13px] text-muted">Los agregamos al mensaje para atenderte más rápido.</p>
          <div className="flex flex-col gap-2.5">
            <label className="text-xs text-muted">Nombre
              <input value={customer.name ?? ''} onChange={(e) => $customer.set({ ...customer, name: e.target.value })} placeholder="Ej. Daniela" autoComplete="given-name" className={input} />
            </label>
            <label className="text-xs text-muted">Ciudad y barrio
              <input value={customer.city ?? ''} onChange={(e) => $customer.set({ ...customer, city: e.target.value })} placeholder="Ej. Barranquilla, El Prado" autoComplete="address-level2" className={input} />
            </label>
          </div>
        </section>

        {orderable.length > 0 && (
          <section aria-labelledby="msg-h" className="mt-6">
            <h2 id="msg-h" className="mb-2.5 text-sm font-semibold">Así se verá tu mensaje</h2>
            <div className="rounded-xl bg-tint p-4">
              <div className="ml-6 whitespace-pre-line rounded-xl rounded-br-[4px] bg-surface px-3.5 py-3 text-[13px] leading-[1.55]">{message}</div>
            </div>
          </section>
        )}

        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 md:static md:mt-6 md:border-0 md:bg-transparent md:p-0">
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            className="flex h-[54px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-full border-0 bg-primary text-[15px] font-semibold text-bg hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-outline"
          >
            {canSend ? `Enviar pedido por WhatsApp · ${formatCOP(total)}` : hasOut && orderable.length === 0 ? 'No hay productos disponibles' : 'WhatsApp no disponible'}
          </button>
          <p className="mt-2 text-center text-xs text-muted">No pagas nada todavía. Confirmamos todo contigo en el chat.</p>
        </div>
      </div>
    </div>
  );
}
