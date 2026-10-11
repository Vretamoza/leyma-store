import { useState } from 'react';
import { actions } from 'astro:actions';
import { btn, btnGhost, input, run } from './ui';

export interface Option {
  id: string;
  name: string;
}

/** Dropdown de un catálogo (marcas o tipos) con creación en línea, sin duplicados. */
export default function OptionSelect(props: {
  table: 'brands' | 'product_types' | 'categories';
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  onError: (message: string) => void;
  noun: string;
  /** Solo categorías: categorías principales donde se puede anidar la nueva. */
  parents?: Option[];
}) {
  const [options, setOptions] = useState(props.options);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await run(actions.createOption({ table: props.table, name, parent_id: parentId || null }));
    setBusy(false);
    if ('error' in res) return props.onError(res.error);
    const created = res.data as Option;
    if (parentId && props.table === 'categories') created.name = `— ${created.name}`;
    setOptions((all) => (all.some((o) => o.id === created.id) ? all : [...all, created].sort((a, b) => a.name.localeCompare(b.name, 'es'))));
    props.onChange(created.id);
    setName('');
    setParentId('');
    setAdding(false);
  }

  if (adding) {
    return (
      <div className="space-y-2">
        <input
          className={input}
          autoFocus
          placeholder={`Nombre (${props.noun})`}
          aria-label={`Nombre de ${props.noun}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        {props.parents && (
          <select className={input} aria-label="Dentro de" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Categoría principal</option>
            {props.parents.map((p) => (
              <option key={p.id} value={p.id}>
                Subcategoría de {p.name}
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-2">
          <button type="button" className={btn} disabled={busy} onClick={add}>
            Agregar
          </button>
          <button type="button" className={btnGhost} onClick={() => setAdding(false)}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <select
      className={input}
      value={props.value}
      onChange={(e) => (e.target.value === '__new' ? setAdding(true) : props.onChange(e.target.value))}
    >
      <option value="">Sin {props.noun}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
      <option value="__new">＋ Agregar {props.noun}…</option>
    </select>
  );
}
