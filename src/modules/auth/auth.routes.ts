import express from 'express';

import authenticate from '@/middlewares/auth';
import { authRateLimiter } from '@/middlewares/rate-limiter';
import validateRequest from '@/middlewares/validate-request';
import { upload } from '@/utils/handle-cloudflare-r2-file';

import AuthController from './auth.controller';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from './auth.validation';

const router = express.Router();

/**
 * Public routes
 */
router.post(
  '/register',
  authRateLimiter,
  validateRequest(registerSchema),
  AuthController.register,
);

router.post(
  '/login',
  authRateLimiter,
  validateRequest(loginSchema),
  AuthController.login,
);

router.post('/logout', AuthController.logout);

/**
 * Protected routes
 */
router.get('/me', authenticate, AuthController.getMe);

router.patch(
  '/profile',
  authenticate,
  validateRequest(updateProfileSchema),
  AuthController.updateProfile,
);

router.patch(
  '/avatar',
  authenticate,
  upload.single('avatar'),
  AuthController.updateAvatar,
);

router.delete('/avatar', authenticate, AuthController.deleteAvatar);

router.patch(
  '/change-password',
  authenticate,
  validateRequest(changePasswordSchema),
  AuthController.changePassword,
);

export const AuthRoutes = router;
