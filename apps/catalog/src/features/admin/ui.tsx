import { useEffect, useState, type ReactNode } from 'react';

export const input =
  'w-full rounded-xl border border-outline bg-surface px-3 py-3 text-base text-ink placeholder:text-muted';
const base =
  'inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
export const btn = `${base} bg-primary text-surface hover:bg-primary-dark active:bg-primary-dark`;
export const btnGhost = `${base} border border-outline bg-transparent text-ink hover:bg-tint active:bg-line`;

export function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Botón con estado de carga automático: si `onClick` devuelve una promesa, se deshabilita
 * y muestra un spinner hasta que termine. `busy` fuerza el estado desde afuera.
 */
export function Button({
  variant = 'primary',
  onClick,
  busy = false,
  busyText,
  className = '',
  children,
  ...rest
}: {
  variant?: 'primary' | 'ghost';
  onClick?: () => void | Promise<unknown>;
  busy?: boolean;
  busyText?: ReactNode;
  className?: string;
  children: ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'className' | 'children'>) {
  const [pending, setPending] = useState(false);
  const loading = busy || pending;

  async function handle() {
    if (loading || !onClick) return;
    const r = onClick();
    if (r && typeof (r as Promise<unknown>).then === 'function') {
      setPending(true);
      try {
        await r;
      } finally {
        setPending(false);
      }
    }
  }

  return (
    <button
      type="button"
      {...rest}
      aria-busy={loading || undefined}
      disabled={rest.disabled || loading}
      onClick={handle}
      className={`${variant === 'primary' ? btn : btnGhost} ${className}`}
    >
      {loading && <Spinner />}
      {loading && busyText ? busyText : children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      {title && <h2 className="mb-3 font-serif text-xl font-semibold text-primary">{title}</h2>}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export type Notice = { kind: 'ok' | 'error'; text: string } | null;

export function useNotice() {
  const [notice, setNotice] = useState<Notice>(null);
  useEffect(() => {
    if (!notice || notice.kind === 'error') return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);
  return [notice, setNotice] as const;
}

export function NoticeBar({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <div
      role={notice.kind === 'error' ? 'alert' : 'status'}
      className={`fixed inset-x-4 bottom-4 z-20 mx-auto max-w-md rounded-xl px-4 py-3 text-sm shadow-lg ${
        notice.kind === 'error' ? 'bg-red-800 text-white' : 'bg-primary text-surface'
      }`}
    >
      {notice.text}
    </div>
  );
}

/** Ejecuta una Astro Action y devuelve el error como texto en vez de lanzar. */
export async function run<T>(
  p: Promise<{ data: T; error: undefined } | { data: undefined; error: { message: string } }>,
): Promise<{ data: T } | { error: string }> {
  const r = await p;
  if (r.error) return { error: r.error.message };
  return { data: r.data as T };
}
