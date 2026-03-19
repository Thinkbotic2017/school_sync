export interface LoginPayload {
  email: string;
  password: string;
}

export interface RefreshTokenPayload {
  refreshToken: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtAccessPayload {
  userId: string;
  tenantId: string;
  role: string;
  type: 'access';
}

export interface JwtRefreshPayload {
  tokenId: string;
  userId: string;
  type: 'refresh';
}
