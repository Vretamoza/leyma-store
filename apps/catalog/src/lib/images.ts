/** Seguro para el navegador: no importa nada del servidor. */
export function imageUrl(path: string): string {
  return `${import.meta.env.PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${path}`;
}
