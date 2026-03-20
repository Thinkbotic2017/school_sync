import { Request, Response, NextFunction } from 'express';
import { configService } from './config.service';
import type { ConfigCategory } from './config.types';

export class ConfigController {
  /**
   * GET /v1/config
   * Returns all config categories for the current tenant.
   */
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const data = await configService.getAllConfigs(tenantId, req.db!);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /v1/config/:category
   * Returns a single config category for the current tenant.
   */
  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const category = req.params.category as ConfigCategory;
      const data = await configService.getConfig(tenantId, category, req.db!);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /v1/config/:category
   * Update a single config category. SCHOOL_ADMIN only.
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const userId = req.auth!.userId;
      const category = req.params.category as ConfigCategory;
      const data = await configService.updateConfig(tenantId, category, req.body, userId, req.db!);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /v1/config/initialize
   * Initialize all default configs for a new tenant. SCHOOL_ADMIN only.
   */
  async initialize(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const userId = req.auth!.userId;
      const { country } = req.body as { country: string };
      const data = await configService.initializeDefaults(tenantId, country, userId, req.db!);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const configController = new ConfigController();
