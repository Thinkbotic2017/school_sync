import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

declare global {
  namespace Express {
    interface Request {
      // The transactional Prisma client scoped to this request's RLS context.
      // All service-layer queries MUST use req.db instead of the global prisma
      // client to guarantee RLS is enforced on the same connection.
      db?: PrismaTransactionClient;
    }
  }
}

/**
 * Set PostgreSQL RLS context for the current request using an interactive
 * transaction. This keeps the connection alive for the duration of the request
 * and attaches a transaction-scoped Prisma client to req.db.
 *
 * IMPORTANT: Route handlers MUST use req.db (not the global prisma) so all
 * queries share the same physical connection where set_config was called.
 *
 * set_config(..., true) makes the setting transaction-local so it is scoped
 * to this connection only and automatically reset when the transaction ends.
 *
 * Must be called after resolveTenant middleware.
 */
export function setRLSContext(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.tenant) {
    next();
    return;
  }

  const tenantId = req.tenant.id;

  // We open an interactive transaction so set_config and all subsequent
  // queries in the request share the same physical connection.
  // The transaction is committed when the response finishes.
  prisma.$transaction(async (tx) => {
    // transaction-local (true) — reset automatically when tx ends
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_tenant_id', $1, true)`,
      tenantId,
    );

    req.db = tx;

    // Hold the transaction open until the response is sent.
    await new Promise<void>((resolve, reject) => {
      res.on('finish', resolve);
      res.on('close', resolve);
      res.on('error', reject);
      next();
    });
  }).catch((err) => {
    logger.error('RLS transaction error', { tenantId, error: err });
    if (!res.headersSent) {
      next(err);
    }
  });
}
