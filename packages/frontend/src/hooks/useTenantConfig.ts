import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { configApi } from '@/services/config.service';
import type { ConfigCategory, TenantConfigMap } from '@/types/config';

const STALE_TIME = 300_000; // 5 minutes

/**
 * Fetches all tenant config entries and returns them indexed by category.
 * Only runs when the user is authenticated.
 *
 * Usage:
 *   const { configs, isLoading, getConfig, currency, calendarType } = useTenantConfig();
 */
export function useTenantConfig() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: entries, isLoading, refetch } = useQuery({
    queryKey: ['tenant-config'],
    queryFn: configApi.getAll,
    staleTime: STALE_TIME,
    enabled: isAuthenticated,
  });

  // Transform array → map keyed by category
  const configs: TenantConfigMap = {};
  if (entries) {
    for (const entry of entries) {
      // Each entry.config is Record<string, unknown>; cast to the typed shape.
      // The runtime shape must match what the backend sends — validated server-side.
      (configs as Record<string, unknown>)[entry.category] = entry.config;
    }
  }

  /**
   * Type-safe getter for a single config category.
   * Example: getConfig<GradingConfig>('grading')
   */
  function getConfig<T>(category: ConfigCategory): T | undefined {
    return (configs as Record<string, unknown>)[category] as T | undefined;
  }

  /** Resolved currency code — fees config takes priority, then general, then default. */
  const currency: string =
    configs.fees?.currency ?? configs.general?.currency ?? 'USD';

  /** Resolved calendar type — falls back to GREGORIAN if not configured. */
  const calendarType: string =
    configs.general?.calendarType ?? 'GREGORIAN';

  return {
    configs,
    isLoading,
    getConfig,
    currency,
    calendarType,
    refetch,
  };
}
