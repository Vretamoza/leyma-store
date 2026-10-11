import { useState } from 'react';
import { actions } from 'astro:actions';
import { btn, btnGhost, Card, input, run } from './ui';
import type { Option } from './OptionSelect';

export default function OptionsManager(props: {
  title: string;
  table: 'brands' | 'product_types';
  options: Option[];
  onNotice: (kind: 'ok' | 'error', text: string) => void;
}) {
  const [rows, setRows] = useState(props.options);

  async function rename(o: Option) {
    const res = await run(actions.renameOption({ table: props.table, id: o.id, name: o.name }));
    props.onNotice('error' in res ? 'error' : 'ok', 'error' in res ? res.error : 'Guardado');
  }
  async function remove(o: Option) {
    if (!confirm(`¿Eliminar “${o.name}”? Los productos que la usan quedarán sin esta información.`)) return;
    const res = await run(actions.deleteOption({ table: props.table, id: o.id }));
    if ('error' in res) return props.onNotice('error', res.error);
    setRows(rows.filter((r) => r.id !== o.id));
  }

  return (
    <Card title={props.title}>
      {rows.map((o) => (
        <div key={o.id} className="flex gap-2">
          <input
            className={input}
            aria-label="Nombre"
            value={o.name}
            onChange={(e) => setRows(rows.map((r) => (r.id === o.id ? { ...r, name: e.target.value } : r)))}
          />
          <button className={btn} onClick={() => rename(o)}>Guardar</button>
          <button className={btnGhost} onClick={() => remove(o)}>Eliminar</button>
        </div>
      ))}
      {!rows.length && <p className="text-sm text-muted">Aún no hay ninguna. Se crean desde el formulario del producto.</p>}
    </Card>
  );
}
