import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validator';
import { resolveTenant } from '../../middleware/tenant';
import { setRLSContext } from '../../middleware/rls';
import { loginSchema, refreshTokenSchema, changePasswordSchema } from './auth.validator';

const router: import("express").Router = Router();

// Public routes (tenant resolved from header/subdomain)
// setRLSContext is required because User table has FORCE ROW LEVEL SECURITY
router.post('/login', resolveTenant, setRLSContext, validate(loginSchema), authController.login.bind(authController));
// refresh: include resolveTenant+setRLSContext because the User join is RLS-filtered
router.post('/refresh', resolveTenant, setRLSContext, validate(refreshTokenSchema), authController.refresh.bind(authController));

// Authenticated routes — resolveTenant+setRLSContext required for User table queries
router.get('/me', authenticate, resolveTenant, setRLSContext, authController.me.bind(authController));
router.post('/change-password', authenticate, resolveTenant, setRLSContext, validate(changePasswordSchema), authController.changePassword.bind(authController));
router.post('/logout', authenticate, authController.logout.bind(authController));

export { router as authRouter };
