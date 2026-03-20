import { Request, Response, NextFunction } from 'express';
import { setupService } from './setup.service';
import type { SetupWizardInput } from './setup.types';

export class SetupController {
  /**
   * POST /v1/setup/initialize
   * Run the one-time school setup wizard.
   * Body is pre-validated by the `validate` middleware (setupWizardSchema).
   * Requires SCHOOL_ADMIN role.
   */
  async initialize(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const userId = req.auth!.userId;
      const input = req.body as SetupWizardInput;

      const result = await setupService.initializeSchool(tenantId, input, userId, req.db!);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /v1/setup/status
   * Returns whether the current tenant has completed setup.
   * Available to any authenticated user in the tenant.
   */
  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;

      const data = await setupService.getSetupStatus(tenantId);

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const setupController = new SetupController();
