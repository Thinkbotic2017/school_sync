import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { setupController } from './setup.controller';
import { requireRoles } from '../../middleware/rbac';
import { validate } from '../../middleware/validator';
import { setupWizardSchema } from './setup.validator';

// authenticate → resolveTenant → setRLSContext are applied globally in index.ts
// before this router is reached.

const router: Router = Router();

// GET /v1/setup/status
// Any authenticated tenant user can check whether setup has been completed.
router.get('/status', setupController.getStatus.bind(setupController));

// POST /v1/setup/initialize
// SCHOOL_ADMIN only. Validates the full wizard payload then runs the
// one-time initialization transaction.
router.post(
  '/initialize',
  requireRoles(UserRole.SCHOOL_ADMIN),
  validate(setupWizardSchema),
  setupController.initialize.bind(setupController),
);

export { router as setupRouter };
