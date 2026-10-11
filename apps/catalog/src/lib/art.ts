import type { Category, Product } from '@leyma/core';

export type ArtKind = 'bottle' | 'lip' | 'kit' | 'compact' | 'garment' | 'gems';

/** Forma de la ilustración mientras un producto no tiene foto, según su categoría. */
export function artKind(product: Pick<Product, 'category_id'>, categories: Category[]): ArtKind {
  const cat = categories.find((c) => c.id === product.category_id);
  const root = cat?.parent_id ? categories.find((c) => c.id === cat.parent_id) : cat;
  const slugs = [cat?.slug, root?.slug];
  if (slugs.includes('kits')) return 'kit';
  if (slugs.includes('ropa')) return 'garment';
  if (slugs.includes('accesorios-faciales')) return 'gems';
  if (slugs.includes('labiales')) return 'lip';
  if (slugs.includes('bases') || slugs.includes('correctores')) return 'bottle';
  return 'compact';
}
