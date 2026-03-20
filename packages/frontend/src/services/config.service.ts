import { apiClient } from './api';
import type { ApiResponse } from '@/types';
import type { ConfigCategory, TenantConfigEntry } from '@/types/config';

export const configApi = {
  /**
   * Fetch all tenant config entries for the current tenant.
   * GET /v1/config
   */
  getAll: async (): Promise<TenantConfigEntry[]> => {
    const { data } = await apiClient.get<ApiResponse<TenantConfigEntry[]>>('/config');
    return data.data;
  },

  /**
   * Fetch a single category config.
   * GET /v1/config/:category
   */
  getCategory: async (category: ConfigCategory): Promise<TenantConfigEntry> => {
    const { data } = await apiClient.get<ApiResponse<TenantConfigEntry>>(`/config/${category}`);
    return data.data;
  },

  /**
   * Update or create a category config.
   * PUT /v1/config/:category
   */
  updateCategory: async (
    category: ConfigCategory,
    config: Record<string, unknown>,
  ): Promise<TenantConfigEntry> => {
    const { data } = await apiClient.put<ApiResponse<TenantConfigEntry>>(`/config/${category}`, {
      config,
    });
    return data.data;
  },

  /**
   * Seed default config for a country.
   * POST /v1/config/initialize
   */
  initialize: async (country: string): Promise<TenantConfigEntry[]> => {
    const { data } = await apiClient.post<ApiResponse<TenantConfigEntry[]>>('/config/initialize', {
      country,
    });
    return data.data;
  },
};
