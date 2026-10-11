import { defineMiddleware } from 'astro:middleware';
import { createSessionClient } from './lib/supabase';

/**
 * Las rutas públicas no tocan cookies (así el CDN las puede cachear).
 * /admin y /_actions crean el cliente con sesión y exigen ser admin.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const isAdmin = path === '/admin' || path.startsWith('/admin/');
  const isAction = path.startsWith('/_actions');
  if (!isAdmin && !isAction) return next();

  const supabase = createSessionClient(context.request, context.cookies);
  context.locals.supabase = supabase;

  const { data } = await supabase.auth.getUser();
  if (data.user) {
    const { data: ok } = await supabase.rpc('is_admin');
    if (ok === true) context.locals.userId = data.user.id;
  }

  if (isAdmin && path !== '/admin/login' && !context.locals.userId) {
    return context.redirect('/admin/login');
  }

  const response = await next();
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
});
