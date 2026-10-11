import { z } from 'zod';
import { formatCOP } from './format';

export const bagLineSchema = z.object({
  variantId: z.string().min(1),
  productId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  /** "Tono", "Talla", "Color" o null cuando el producto no tiene variantes visibles. */
  variantLabel: z.enum(['Tono', 'Talla', 'Color']).nullable(),
  variantName: z.string().nullable(),
  hex: z.string().nullable(),
  /** Ruta de la foto en el bucket, para mostrarla en la bolsa. */
  image: z.string().nullable().default(null),
  /** Ilustración de respaldo mientras no hay foto. */
  art: z.enum(['bottle', 'lip', 'kit', 'compact', 'garment', 'gems']).default('compact'),
  unitPrice: z.number().nonnegative(),
  quantity: z.number().int().positive(),
});
export type BagLine = z.output<typeof bagLineSchema>;

/** Lee la bolsa guardada en el navegador; descarta lo que esté corrupto o mal formado. */
export function parseBag(raw: unknown): BagLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const parsed = bagLineSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

/** `stock` desconocido = sin límite (la bolsa se valida al abrirla). */
function clamp(quantity: number, stock: number | undefined): number {
  return stock === undefined ? quantity : Math.min(quantity, Math.max(0, stock));
}

export interface AddResult {
  lines: BagLine[];
  /** Unidades que realmente quedaron agregadas (0 si no hay stock). */
  added: number;
}

export function addLine(lines: BagLine[], line: Omit<BagLine, 'quantity'>, quantity: number, stock?: number): AddResult {
  const existing = lines.find((l) => l.variantId === line.variantId);
  const current = existing?.quantity ?? 0;
  const next = clamp(current + Math.max(1, Math.floor(quantity)), stock);
  if (next <= current) return { lines, added: 0 };
  if (existing) {
    return {
      lines: lines.map((l) => (l.variantId === line.variantId ? { ...l, ...line, quantity: next } : l)),
      added: next - current,
    };
  }
  return { lines: [...lines, { ...line, quantity: next }], added: next };
}

export function setQuantity(lines: BagLine[], variantId: string, quantity: number, stock?: number): BagLine[] {
  const next = clamp(Math.max(1, Math.floor(quantity)), stock);
  return lines.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.max(1, next) } : l));
}

export function removeLine(lines: BagLine[], variantId: string): BagLine[] {
  return lines.filter((l) => l.variantId !== variantId);
}

export const bagUnits = (lines: BagLine[]) => lines.reduce((sum, l) => sum + l.quantity, 0);
export const lineTotal = (line: BagLine) => line.unitPrice * line.quantity;
export const bagTotal = (lines: BagLine[]) => lines.reduce((sum, l) => sum + lineTotal(l), 0);

/** Estado actual de una variante en la base de datos. */
export interface LiveVariant {
  variantId: string;
  stock: number;
  unitPrice: number;
}

export type BagIssue =
  | { type: 'out'; variantId: string }
  | { type: 'unavailable'; variantId: string }
  | { type: 'reduced'; variantId: string; from: number; to: number }
  | { type: 'price'; variantId: string; from: number; to: number };

export interface BagCheck {
  lines: BagLine[];
  issues: BagIssue[];
  /** Stock vigente por variante (0 si ya no existe). */
  stock: Record<string, number>;
}

/** Valida la bolsa contra el stock y los precios actuales. */
export function reconcileBag(lines: BagLine[], live: LiveVariant[]): BagCheck {
  const byId = new Map(live.map((l) => [l.variantId, l]));
  const issues: BagIssue[] = [];
  const stock: Record<string, number> = {};
  const next = lines.map((line) => {
    const current = byId.get(line.variantId);
    if (!current) {
      stock[line.variantId] = 0;
      issues.push({ type: 'unavailable', variantId: line.variantId });
      return line;
    }
    stock[line.variantId] = current.stock;
    let updated = line;
    if (current.unitPrice !== line.unitPrice) {
      issues.push({ type: 'price', variantId: line.variantId, from: line.unitPrice, to: current.unitPrice });
      updated = { ...updated, unitPrice: current.unitPrice };
    }
    if (current.stock <= 0) {
      issues.push({ type: 'out', variantId: line.variantId });
    } else if (line.quantity > current.stock) {
      issues.push({ type: 'reduced', variantId: line.variantId, from: line.quantity, to: current.stock });
      updated = { ...updated, quantity: current.stock };
    }
    return updated;
  });
  return { lines: next, issues, stock };
}

/** Líneas que sí se pueden pedir (con stock). Sin información de stock, todas. */
export function orderableLines(lines: BagLine[], stock: Record<string, number>): BagLine[] {
  return lines.filter((l) => (stock[l.variantId] ?? Infinity) > 0);
}

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I
export function generateRef(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < 4; i++) code += REF_ALPHABET[Math.floor(random() * REF_ALPHABET.length)];
  return `LS-${code}`;
}

/** "Base Matte Glow, tono 03 Beige cálido". */
export function lineLabel(line: Pick<BagLine, 'name' | 'variantLabel' | 'variantName'>): string {
  if (!line.variantName) return line.name;
  return line.variantLabel
    ? `${line.name}, ${line.variantLabel.toLowerCase()} ${line.variantName}`
    : `${line.name}, ${line.variantName}`;
}

export interface Customer {
  name?: string;
  city?: string;
}

export function buildOrderMessage(input: { storeName: string; lines: BagLine[]; ref: string; customer?: Customer }): string {
  const { storeName, lines, ref, customer } = input;
  const items = lines.map((l) => `• ${lineLabel(l)} x${l.quantity} — ${formatCOP(lineTotal(l))}`);
  const parts = [`Hola ${storeName}, quiero hacer este pedido:`, '', ...items, '', `Total estimado: ${formatCOP(bagTotal(lines))}`];
  const name = customer?.name?.trim();
  const city = customer?.city?.trim();
  if (name) parts.push(`Nombre: ${name}`);
  if (city) parts.push(`Ciudad: ${city}`);
  parts.push(`Ref: ${ref}`);
  return parts.join('\n');
}

/** Forma en que se guarda cada ítem en `order_requests.items` (la usa "Más pedidos"). */
export function orderItems(lines: BagLine[]) {
  return lines.map((l) => ({
    product_id: l.productId,
    variant_id: l.variantId,
    name: l.name,
    variant_name: l.variantName,
    quantity: l.quantity,
    unit_price: l.unitPrice,
  }));
}
