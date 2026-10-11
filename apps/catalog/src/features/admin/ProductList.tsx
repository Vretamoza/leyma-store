import { useMemo, useState } from 'react';
import { actions } from 'astro:actions';
import { formatCOP, normalize } from '@leyma/core';
import { btn, btnGhost, input, NoticeBar, run, useNotice } from './ui';

interface Row {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  category_id: string | null;
  base_price: number;
  is_active: boolean;
  stock: number;
  photo: string | null;
}

export default function ProductList(props: {
  products: Row[];
  categories: { id: string; name: string }[];
  supabaseUrl: string;
}) {
  const [rows, setRows] = useState(props.products);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [state, setState] = useState<'' | 'on' | 'off'>('');
  const [notice, setNotice] = useNotice();

  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!q || normalize(`${r.brand ?? ''} ${r.name}`).includes(normalize(q))) &&
          (!cat || r.category_id === cat) &&
          (!state || r.is_active === (state === 'on')),
      ),
    [rows, q, cat, state],
  );

  async function toggle(r: Row) {
    const res = await run(actions.setProductActive({ id: r.id, is_active: !r.is_active }));
    if ('error' in res) return setNotice({ kind: 'error', text: res.error });
    setRows((all) => all.map((x) => (x.id === r.id ? { ...x, is_active: !r.is_active } : x)));
  }

  async function duplicate(r: Row) {
    const res = await run(actions.duplicateProduct({ id: r.id }));
    if ('error' in res) return setNotice({ kind: 'error', text: res.error });
    window.location.href = `/admin/productos/${res.data.id}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold text-primary">Productos</h1>
        <a href="/admin/productos/nuevo" className={btn}>+ Nuevo</a>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <input className={input} type="search" placeholder="Buscar…" aria-label="Buscar producto" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={input} aria-label="Categoría" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {props.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={input} aria-label="Estado" value={state} onChange={(e) => setState(e.target.value as '' | 'on' | 'off')}>
          <option value="">Todos</option>
          <option value="on">Publicados</option>
          <option value="off">Ocultos</option>
        </select>
      </div>
      <ul className="space-y-2">
        {shown.map((r) => (
          <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
            <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-ph">
              {r.photo && <img src={`${props.supabaseUrl}/storage/v1/object/public/product-images/${r.photo}`} alt="" className="h-full w-full object-cover" loading="lazy" />}
            </div>
            <a href={`/admin/productos/${r.id}`} className="min-w-0 flex-1">
              <span className="block truncate font-medium">{r.brand ? `${r.brand} · ` : ''}{r.name}</span>
              <span className="block text-sm text-muted">
                {formatCOP(r.base_price)} · {r.stock === 0 ? 'Agotado' : `${r.stock} u.`}
                {!r.is_active && ' · Oculto'}
              </span>
            </a>
            <div className="flex flex-col gap-1 sm:flex-row">
              <button className={btnGhost} onClick={() => toggle(r)}>{r.is_active ? 'Ocultar' : 'Publicar'}</button>
              <button className={btnGhost} onClick={() => duplicate(r)}>Duplicar</button>
            </div>
          </li>
        ))}
        {!shown.length && <li className="py-8 text-center text-muted">No hay productos con ese filtro.</li>}
      </ul>
      <NoticeBar notice={notice} />
    </div>
  );
}
