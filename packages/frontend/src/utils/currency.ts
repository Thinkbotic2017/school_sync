/**
 * Locale-aware currency formatter.
 *
 * The `currency` parameter should come from `useTenantConfig().currency` so
 * that each school sees its own currency code rather than the hardcoded 'ETB'.
 *
 * Examples:
 *   formatCurrency(1234.5, 'ETB') → 'ETB 1,234.50'
 *   formatCurrency(1234.5, 'USD') → 'USD 1,234.50'
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency = 'ETB',
): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  if (isNaN(n)) return `${currency} 0.00`;
  return `${currency} ${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Compact locale-aware currency formatter.
 *
 * Examples:
 *   formatCurrencyCompact(12345, 'ETB') → 'ETB 12.3K'
 *   formatCurrencyCompact(1200000, 'USD') → 'USD 1.2M'
 */
export function formatCurrencyCompact(
  amount: number | string | null | undefined,
  currency = 'ETB',
): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  if (isNaN(n)) return `${currency} 0`;
  if (Math.abs(n) >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${currency} ${(n / 1_000).toFixed(1)}K`;
  return `${currency} ${n.toFixed(0)}`;
}

// ─── Legacy aliases (backwards-compatible, hardcoded to ETB) ──────────────────
// Existing call sites continue to work. Migrate them to formatCurrency(amount, currency)
// once useTenantConfig is wired into those components.

/** @deprecated Use formatCurrency(amount, currency) with useTenantConfig().currency */
export function formatETB(amount: number | string | null | undefined): string {
  return formatCurrency(amount, 'ETB');
}

/** @deprecated Use formatCurrencyCompact(amount, currency) with useTenantConfig().currency */
export function formatETBCompact(amount: number | string | null | undefined): string {
  return formatCurrencyCompact(amount, 'ETB');
}
