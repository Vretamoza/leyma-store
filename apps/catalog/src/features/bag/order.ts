import { buildOrderMessage, generateRef, orderItems, bagTotal, whatsappUrl, type BagLine, type Customer } from '@leyma/core';

/** Guarda el pedido para saber qué se pide más. No bloquea ni rompe el envío si falla. */
function logOrder(ref: string, lines: BagLine[]) {
  const base = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  try {
    void fetch(`${base}/rest/v1/order_requests`, {
      method: 'POST',
      keepalive: true,
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ ref, items: orderItems(lines), total: bagTotal(lines) }),
    }).catch(() => {});
  } catch {
    /* sin conexión: el pedido igual se envía por WhatsApp */
  }
}

export interface OrderInput {
  storeName: string;
  whatsapp: string;
  lines: BagLine[];
  customer?: Customer;
  ref: string;
}

export function orderUrl({ storeName, whatsapp, lines, customer, ref }: OrderInput): string | null {
  return whatsappUrl(whatsapp, buildOrderMessage({ storeName, lines, ref, customer }));
}

/** Abre WhatsApp con el pedido ya escrito. Debe llamarse dentro de un clic para que no lo bloquee el navegador. */
export function sendOrder(input: Omit<OrderInput, 'ref'> & { ref?: string }): boolean {
  const ref = input.ref ?? generateRef();
  const url = orderUrl({ ...input, ref });
  if (!url || input.lines.length === 0) return false;
  window.open(url, '_blank', 'noopener');
  logOrder(ref, input.lines);
  return true;
}
