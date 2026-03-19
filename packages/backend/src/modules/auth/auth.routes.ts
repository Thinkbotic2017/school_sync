import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validator';
import { resolveTenant } from '../../middleware/tenant';
import { loginSchema, refreshTokenSchema, changePasswordSchema } from './auth.validator';

const router = Router();

// Public routes (tenant resolved from header/subdomain)
router.post('/login', resolveTenant, validate(loginSchema), authController.login.bind(authController));
router.post('/refresh', validate(refreshTokenSchema), authController.refresh.bind(authController));

// Authenticated routes
router.get('/me', authenticate, authController.me.bind(authController));
router.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword.bind(authController));
router.post('/logout', authenticate, authController.logout.bind(authController));

export { router as authRouter };
