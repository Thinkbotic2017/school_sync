import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/services/api';
import type { User, TokenPair, ApiResponse } from '@/types';

export function useAuth() {
  const navigate = useNavigate();
  const { user, isAuthenticated, setAuth, clearAuth } = useAuthStore();

  const login = async (email: string, password: string) => {
    const { data } = await apiClient.post<ApiResponse<TokenPair>>('/auth/login', {
      email,
      password,
    });

    const { accessToken, refreshToken } = data.data;

    // Fetch user profile
    const { data: meData } = await apiClient.get<ApiResponse<User>>('/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    setAuth(meData.data, accessToken, refreshToken);
    return meData.data;
  };

  const logout = async () => {
    const refreshToken = useAuthStore.getState().refreshToken;
    try {
      await apiClient.post('/auth/logout', { refreshToken });
    } catch {
      // Ignore errors on logout
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

  return { user, isAuthenticated, login, logout };
}
