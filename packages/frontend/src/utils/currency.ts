/**
 * Formats a number as Ethiopian Birr currency.
 * Always displays as "ETB X,XXX.XX"
 */
export function formatETB(amount: number | string | null | undefined): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  if (isNaN(n)) return 'ETB 0.00';
  return `ETB ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
