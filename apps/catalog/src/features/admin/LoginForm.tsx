import { useState } from 'react';
import { actions } from 'astro:actions';
import { btn, Field, input, run } from './ui';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await run(actions.login({ email, password }));
    if ('error' in r) {
      setError(r.error);
      setBusy(false);
    } else {
      window.location.href = '/admin/productos';
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-10 max-w-sm space-y-4 rounded-2xl border border-line bg-surface p-6">
      <h1 className="font-serif text-3xl font-semibold text-primary">Panel de Leyma Shop</h1>
      <Field label="Correo">
        <input className={input} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Contraseña">
        <input className={input} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      <button className={`${btn} w-full`} disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
    </form>
  );
}
