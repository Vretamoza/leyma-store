import { useMemo, useState } from 'react';
import { actions } from 'astro:actions';
import { normalize } from '@leyma/core';
import { btn, btnGhost, input, NoticeBar, run, useNotice } from './ui';

interface Row {
  id: string;
  product: string;
  variant: string;
  stock: number;
}

export default function StockBoard({ rows, threshold }: { rows: Row[]; threshold: number }) {
  const [saved, setSaved] = useState<Record<string, number>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, r.stock])),
  );
  const [stock, setStock] = useState<Record<string, number>>(saved);
  const [q, setQ] = useState('');
  const [only, setOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useNotice();

  const dirty = rows.filter((r) => stock[r.id] !== saved[r.id]);
  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!q || normalize(`${r.product} ${r.variant}`).includes(normalize(q))) &&
          (!only || stock[r.id] <= threshold),
      ),
    [rows, q, only, stock, threshold],
  );
  const set = (id: string, n: number) =>
    setStock((s) => ({ ...s, [id]: Math.max(0, Math.min(100000, n || 0)) }));

  async function save() {
    setBusy(true);
    const res = await run(actions.updateStock(dirty.map((r) => ({ id: r.id, stock: stock[r.id] }))));
    setBusy(false);
    if ('error' in res) return setNotice({ kind: 'error', text: res.error });
    setSaved(stock);
    setNotice({ kind: 'ok', text: 'Stock actualizado' });
  }

  return (
    <div className="space-y-4 pb-24">
      <h1 className="font-serif text-3xl font-semibold text-primary">Stock rápido</h1>
      <div className="flex gap-2">
        <input
          className={input}
          type="search"
          placeholder="Buscar producto o tono…"
          aria-label="Buscar"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> Bajo stock
        </label>
      </div>
      <ul className="space-y-2">
        {shown.map((r) => {
          const n = stock[r.id];
          const tone =
            n === 0
              ? 'border-red-300 bg-red-50'
              : n <= threshold
                ? 'border-gold bg-gold-tint'
                : 'border-line bg-surface';
          return (
            <li key={r.id} className={`flex items-center gap-2 rounded-2xl border p-3 ${tone}`}>
              <div className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.product}</span>
                <span className="block truncate text-sm text-muted">
                  {r.variant}
                  {n === 0 ? ' · Agotado' : n <= threshold ? ' · Últimas unidades' : ''}
                </span>
              </div>
              <button className={`${btnGhost} !px-4`} aria-label={`Restar a ${r.variant}`} onClick={() => set(r.id, n - 1)}>
                −
              </button>
              <input
                className={`${input} !w-16 !px-1 text-center`}
                inputMode="numeric"
                aria-label={`Stock de ${r.variant}`}
                value={n}
                onChange={(e) => set(r.id, Number(e.target.value.replace(/\D/g, '')))}
              />
              <button className={`${btnGhost} !px-4`} aria-label={`Sumar a ${r.variant}`} onClick={() => set(r.id, n + 1)}>
                +
              </button>
            </li>
          );
        })}
        {!shown.length && <li className="py-8 text-center text-muted">Nada que mostrar.</li>}
      </ul>
      {dirty.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-bg px-4 py-3">
          <div className="mx-auto flex max-w-4xl gap-2">
            <button className={`${btn} flex-1`} disabled={busy} onClick={save}>
              {busy ? 'Guardando…' : `Guardar ${dirty.length} cambio(s)`}
            </button>
            <button className={btnGhost} onClick={() => setStock(saved)}>
              Descartar
            </button>
          </div>
        </div>
      )}
      <NoticeBar notice={notice} />
    </div>
  );
}
