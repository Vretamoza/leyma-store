import { createClient } from '@supabase/supabase-js';

/** Cliente anónimo para islas: solo lectura pública (stock y precio en vivo). */
export function createPublicClient() {
  return createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
