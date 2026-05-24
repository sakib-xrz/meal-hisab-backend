import { z } from 'zod';
import { BD_PHONE_REGEX } from './auth.constant';

const phoneField = z
  .string({ required_error: 'Phone is required' })
  .trim()
  .min(11, 'Phone must be at least 11 digits')
  .max(15, 'Phone must be at most 15 digits')
  .regex(BD_PHONE_REGEX, 'Invalid Bangladeshi phone number');

const passwordField = z
  .string({ required_error: 'Password is required' })
  .min(6, 'Password must be at least 6 characters')
  .max(72, 'Password must be at most 72 characters');

/**
 * POST /auth/register
 */
export const registerSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: 'Name is required' })
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(80, 'Name must be at most 80 characters'),
    phone: phoneField,
    password: passwordField,
    avatarUrl: z.string().url('Invalid avatar URL').optional(),
  }),
});

/**
 * POST /auth/login
 */
export const loginSchema = z.object({
  body: z.object({
    phone: phoneField,
    password: z
      .string({ required_error: 'Password is required' })
      .min(1, 'Password is required'),
  }),
});

/**
 * PATCH /auth/change-password
 */
export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z
      .string({ required_error: 'Current password is required' })
      .min(1, 'Current password is required'),
    newPassword: passwordField,
  }),
});

/**
 * PATCH /auth/profile
 *
 * Updates non-file profile fields. Avatar has its own endpoint that handles
 * the actual file upload (PATCH /auth/avatar).
 */
export const updateProfileSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(2, 'Name must be at least 2 characters')
        .max(80, 'Name must be at most 80 characters')
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
