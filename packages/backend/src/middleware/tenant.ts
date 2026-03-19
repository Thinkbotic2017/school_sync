import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { Tenant } from '@prisma/client';
import { NotFoundError, LicenseExpiredError, LicenseInactiveError } from '../utils/errors';

declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
    }
  }
}

/**
 * Resolve tenant from X-Tenant-ID header or subdomain.
 * Sets req.tenant and validates license status.
 */
export async function resolveTenant(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    let tenantSlug: string | undefined;

    // 1. Try X-Tenant-ID header (slug or UUID)
    const headerTenant = req.headers['x-tenant-id'] as string | undefined;
    if (headerTenant) {
      tenantSlug = headerTenant;
    } else {
      // 2. Try subdomain extraction: {slug}.schoolsync.app
      const host = req.hostname;
      const parts = host.split('.');
      if (parts.length >= 3) {
        tenantSlug = parts[0];
      }
    }

    if (!tenantSlug) {
      throw new NotFoundError('Tenant not found. Provide X-Tenant-ID header or use subdomain URL.');
    }

    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundError(`Tenant '${tenantSlug}' not found`);
    }

    if (!tenant.isActive) {
      throw new LicenseInactiveError();
    }

    if (tenant.licenseExpiresAt < new Date()) {
      throw new LicenseExpiredError();
    }

    req.tenant = tenant;
    next();
  } catch (err) {
    next(err);
  }
}
