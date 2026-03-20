import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_TENANT', message: 'Tenant not resolved' },
        });
        return;
      }

      const tokens = await authService.login(req.tenant.id, req.body, req.db!);
      res.json({ success: true, data: tokens });
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tokens = await authService.refreshTokens(req.body.refreshToken, req.db!);
      res.json({ success: true, data: tokens });
    } catch (err) {
      next(err);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.getMe(req.auth!.userId, req.db!);
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.changePassword(req.auth!.userId, req.body, req.db!);
      res.json({ success: true, data: { message: 'Password changed successfully' } });
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      await authService.logout(req.auth!.userId, refreshToken);
      res.json({ success: true, data: { message: 'Logged out successfully' } });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
