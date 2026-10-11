/** Pesos colombianos como en el diseño: `$45.000` (sin espacio ni decimales). */
export function formatCOP(value: number): string {
  const grouped = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(value));
  return `$${grouped}`;
}
