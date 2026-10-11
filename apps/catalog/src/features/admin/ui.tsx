import { useEffect, useState, type ReactNode } from 'react';

export const input =
  'w-full rounded-xl border border-outline bg-surface px-3 py-3 text-base text-ink placeholder:text-muted';
export const btn =
  'inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-surface disabled:opacity-50';
export const btnGhost =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-outline px-5 py-2 text-sm text-ink disabled:opacity-50';

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
