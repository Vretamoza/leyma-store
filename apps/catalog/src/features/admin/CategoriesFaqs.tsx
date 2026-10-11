import { useState } from 'react';
import { actions } from 'astro:actions';
import OptionsManager from './OptionsManager';
import type { Option } from './OptionSelect';
import { Button, btnGhost, Card, Field, input, NoticeBar, run, useNotice } from './ui';

interface Cat {
  id?: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
}
interface Faq {
  id?: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
}

const num = (v: string) => Number(v.replace(/\D/g, ''));

export default function CategoriesFaqs(props: { categories: Cat[]; faqs: Faq[]; brands: Option[]; types: Option[] }) {
  const [cats, setCats] = useState(props.categories);
  const [faqs, setFaqs] = useState(props.faqs);
  const [notice, setNotice] = useNotice();

  const reload = () => setTimeout(() => window.location.reload(), 700);
  const patchCat = (c: Cat, p: Partial<Cat>) => setCats(cats.map((x) => (x === c ? { ...x, ...p } : x)));
  const patchFaq = (f: Faq, p: Partial<Faq>) => setFaqs(faqs.map((x) => (x === f ? { ...x, ...p } : x)));

  async function saveCat(c: Cat) {
    const res = await run(actions.saveCategory(c));
    if ('error' in res) return setNotice({ kind: 'error', text: res.error });
    setNotice({ kind: 'ok', text: 'Categoría guardada' });
    if (!c.id) reload();
  }
  async function delCat(c: Cat) {
    if (!c.id) return setCats(cats.filter((x) => x !== c));
    if (!confirm(`¿Eliminar “${c.name}”? Sus productos quedarán sin categoría.`)) return;
    const res = await run(actions.deleteCategory({ id: c.id }));
    if ('error' in res) return setNotice({ kind: 'error', text: res.error });
    setCats(cats.filter((x) => x.id !== c.id));
  }
  async function saveFaq(f: Faq) {
    const res = await run(actions.saveFaq({ ...f, product_id: null }));
    if ('error' in res) return setNotice({ kind: 'error', text: res.error });
    setNotice({ kind: 'ok', text: 'Pregunta guardada' });
    if (!f.id) reload();
  }
  async function delFaq(f: Faq) {
    if (!f.id) return setFaqs(faqs.filter((x) => x !== f));
    if (!confirm('¿Eliminar esta pregunta?')) return;
    const res = await run(actions.deleteFaq({ id: f.id }));
    if ('error' in res) return setNotice({ kind: 'error', text: res.error });
    setFaqs(faqs.filter((x) => x.id !== f.id));
  }

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl font-semibold text-primary">Categorías y FAQs</h1>
      <Card title="Categorías">
        {cats.map((c, i) => (
          <div key={c.id ?? `n${i}`} className="space-y-2 rounded-xl border border-line p-3">
            <div className="grid grid-cols-[1fr_5rem] gap-2">
              <input className={input} aria-label="Nombre" placeholder="Nombre" value={c.name} onChange={(e) => patchCat(c, { name: e.target.value })} />
              <input className={input} aria-label="Orden" inputMode="numeric" value={c.sort_order} onChange={(e) => patchCat(c, { sort_order: num(e.target.value) })} />
            </div>
            <select className={input} aria-label="Categoría padre" value={c.parent_id ?? ''} onChange={(e) => patchCat(c, { parent_id: e.target.value || null })}>
              <option value="">Categoría principal</option>
              {cats
                .filter((p) => p.id && p.id !== c.id && !p.parent_id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    Dentro de {p.name}
                  </option>
                ))}
            </select>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={c.is_active} onChange={(e) => patchCat(c, { is_active: e.target.checked })} /> Visible
              </label>
              <span className="ml-auto flex gap-1">
                <Button onClick={() => saveCat(c)} busyText="Guardando…">Guardar</Button>
                <Button variant="ghost" onClick={() => delCat(c)}>Eliminar</Button>
              </span>
            </div>
          </div>
        ))}
        <button className={btnGhost} onClick={() => setCats([...cats, { name: '', slug: '', parent_id: null, sort_order: cats.length + 1, is_active: true }])}>
          + Nueva categoría
        </button>
      </Card>

      <OptionsManager title="Marcas" table="brands" options={props.brands} onNotice={(kind, text) => setNotice({ kind, text })} />
      <OptionsManager title="Tipos de producto" table="product_types" options={props.types} onNotice={(kind, text) => setNotice({ kind, text })} />

      <Card title="Preguntas frecuentes (generales)">
        {faqs.map((f, i) => (
          <div key={f.id ?? `n${i}`} className="space-y-2 rounded-xl border border-line p-3">
            <Field label="Pregunta">
              <input className={input} value={f.question} onChange={(e) => patchFaq(f, { question: e.target.value })} />
            </Field>
            <Field label="Respuesta">
              <textarea className={input} rows={3} value={f.answer} onChange={(e) => patchFaq(f, { answer: e.target.value })} />
            </Field>
            <div className="flex items-center gap-2">
              <input className={`${input} !w-20`} aria-label="Orden" inputMode="numeric" value={f.sort_order} onChange={(e) => patchFaq(f, { sort_order: num(e.target.value) })} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={f.is_active} onChange={(e) => patchFaq(f, { is_active: e.target.checked })} /> Visible
              </label>
              <span className="ml-auto flex gap-1">
                <Button onClick={() => saveFaq(f)} busyText="Guardando…">Guardar</Button>
                <Button variant="ghost" onClick={() => delFaq(f)}>Eliminar</Button>
              </span>
            </div>
          </div>
        ))}
        <button className={btnGhost} onClick={() => setFaqs([...faqs, { question: '', answer: '', sort_order: faqs.length + 1, is_active: true }])}>
          + Nueva pregunta
        </button>
      </Card>
      <NoticeBar notice={notice} />
    </div>
  );
}
