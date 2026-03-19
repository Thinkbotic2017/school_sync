import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

/**
 * Set PostgreSQL RLS context for the current request.
 * Must be called after resolveTenant middleware.
 */
export async function setRLSContext(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.tenant) {
    next();
    return;
  }

  try {
    await prisma.$executeRawUnsafe(
      `SELECT set_config('app.current_tenant_id', $1, false)`,
      req.tenant.id,
    );
    next();
  } catch (err) {
    logger.error('Failed to set RLS context', { tenantId: req.tenant.id });
    next(err);
  }
}
