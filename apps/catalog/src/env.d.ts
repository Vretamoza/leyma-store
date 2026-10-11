/// <reference path="../.astro/types.d.ts" />
interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
declare namespace App {
  interface Locals {
    /** Solo definido en /admin y /_actions. */
    supabase?: import('@supabase/supabase-js').SupabaseClient;
    userId?: string;
  }
}
