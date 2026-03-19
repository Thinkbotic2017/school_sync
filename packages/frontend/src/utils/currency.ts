/**
 * Formats a number as Ethiopian Birr currency.
 * Always displays as "ETB X,XXX.XX"
 */
export function formatETB(amount: number | string | null | undefined): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  if (isNaN(n)) return 'ETB 0.00';
  return `ETB ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Compact format: "ETB 12.3K", "ETB 1.2M", etc.
 */
export function formatETBCompact(amount: number | string | null | undefined): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  if (isNaN(n)) return 'ETB 0';
  if (Math.abs(n) >= 1_000_000) return `ETB ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `ETB ${(n / 1_000).toFixed(1)}K`;
  return `ETB ${n.toFixed(0)}`;
}
