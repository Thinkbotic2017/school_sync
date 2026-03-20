import { apiClient } from './api';
import type { ApiResponse } from '@/types';
import type {
  SetupWizardInput,
  SetupStatusResponse,
  SetupInitializeResponse,
} from '@/types/setup';

export const setupApi = {
  /**
   * Check whether setup has been completed for the current tenant.
   * GET /v1/setup/status
   */
  getStatus: async (): Promise<SetupStatusResponse> => {
    const { data } = await apiClient.get<ApiResponse<SetupStatusResponse>>('/setup/status');
    return data.data;
  },

  /**
   * Submit all wizard data and initialize the school.
   * POST /v1/setup/initialize
   */
  initialize: async (payload: SetupWizardInput): Promise<SetupInitializeResponse> => {
    const { data } = await apiClient.post<ApiResponse<SetupInitializeResponse>>(
      '/setup/initialize',
      payload,
    );
    return data.data;
  },
};
