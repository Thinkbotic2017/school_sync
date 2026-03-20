import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { BCRYPT_SALT_ROUNDS } from '../../utils/constants';
import {
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
} from '../../utils/errors';
import type {
  LoginPayload,
  TokenPair,
  JwtAccessPayload,
  JwtRefreshPayload,
  ChangePasswordPayload,
} from './auth.types';

type DbClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export class AuthService {
  // db must be req.db (the RLS-scoped transaction client) — User table has FORCE ROW LEVEL SECURITY
  async login(tenantId: string, payload: LoginPayload, db: DbClient): Promise<TokenPair> {
    const user = await db.user.findUnique({
      where: { tenantId_email: { tenantId, email: payload.email } },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.generateTokenPair(user.id, tenantId, user.role);
  }

  async refreshTokens(refreshToken: string, db: DbClient): Promise<TokenPair> {
    let payload: JwtRefreshPayload;

    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as JwtRefreshPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedError('Invalid token type');
    }

    // RefreshToken has no RLS — use global prisma for the token lookup itself
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      // Do NOT include user here — User has FORCE RLS and we need db for that
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token expired or revoked');
    }

    // Fetch the user via the RLS-scoped client (User has FORCE RLS)
    const user = await db.user.findUnique({
      where: { id: storedToken.userId },
    });

    if (!user) {
      throw new UnauthorizedError('User not found or access denied');
    }

    // Rotate: delete old token (RefreshToken has no RLS — global prisma is fine)
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    return this.generateTokenPair(user.id, user.tenantId, user.role);
  }

  async getMe(userId: string, db: DbClient) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            primaryColor: true,
            secondaryColor: true,
            plan: true,
            locale: true,
            calendarType: true,
            timezone: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  async changePassword(userId: string, payload: ChangePasswordPayload, db: DbClient): Promise<void> {
    const user = await db.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isValid = await bcrypt.compare(payload.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new BadRequestError('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(payload.newPassword, BCRYPT_SALT_ROUNDS);
    await db.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Revoke all refresh tokens on password change
    await prisma.refreshToken.deleteMany({ where: { userId } });
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { userId, token: refreshToken },
      });
    } else {
      // Logout from all sessions
      await prisma.refreshToken.deleteMany({ where: { userId } });
    }
  }

  private async generateTokenPair(
    userId: string,
    tenantId: string,
    role: string,
  ): Promise<TokenPair> {
    const accessPayload: JwtAccessPayload = {
      userId,
      tenantId,
      role,
      type: 'access',
    };

    const tokenId = uuidv4();
    const refreshPayload: JwtRefreshPayload = {
      tokenId,
      userId,
      type: 'refresh',
    };

    const accessToken = jwt.sign(accessPayload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(refreshPayload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    } as jwt.SignOptions);

    // Persist refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.refreshToken.create({
      data: {
        id: tokenId,
        token: refreshToken,
        userId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}

export const authService = new AuthService();
