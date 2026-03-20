import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { configController } from './config.controller';
import { requireRoles } from '../../middleware/rbac';
import { validate } from '../../middleware/validator';
import { categoryParamSchema, initializeDefaultsSchema } from './config.validator';

// Authentication, tenant resolution, and RLS context are applied globally
// in index.ts before this router is reached.

const router: Router = Router();

// GET /v1/config — all configs for the current tenant (any authenticated role)
router.get('/', configController.getAll.bind(configController));

// POST /v1/config/initialize — initialize defaults for a new tenant (SCHOOL_ADMIN only)
// Declared before /:category parameterized routes to avoid param capture on POST.
router.post(
  '/initialize',
  requireRoles(UserRole.SCHOOL_ADMIN),
  validate(initializeDefaultsSchema),
  configController.initialize.bind(configController),
);

// GET /v1/config/:category — single config category
router.get(
  '/:category',
  validate(categoryParamSchema, 'params'),
  configController.getOne.bind(configController),
);

// PUT /v1/config/:category — update a config category (SCHOOL_ADMIN only)
router.put(
  '/:category',
  requireRoles(UserRole.SCHOOL_ADMIN),
  validate(categoryParamSchema, 'params'),
  configController.update.bind(configController),
);

export { router as configRouter };
