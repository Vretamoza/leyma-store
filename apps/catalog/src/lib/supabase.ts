import type { AstroCookies } from 'astro';
import { createBrowserClient, createServerClient, parseCookieHeader, type CookieOptions } from '@supabase/ssr';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export function createBrowser() {
  return createBrowserClient(url, key);
}

export function createServer(cookies: { name: string; value: string }[] = []) {
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookies,
      setAll: () => {},
    },
  });
}

/** Cliente con sesión: lee/escribe las cookies de Supabase. Solo para /admin y /_actions. */
export function createSessionClient(request: Request, cookies: AstroCookies) {
  return createServerClient(url, key, {
    cookies: {
      getAll: () => parseCookieHeader(request.headers.get('Cookie') ?? ''),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        for (const { name, value, options } of list) cookies.set(name, value, options);
      },
    },
  });
}
