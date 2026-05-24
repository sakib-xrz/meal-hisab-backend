import { z } from 'zod';

import { BD_PHONE_REGEX } from '@/modules/auth/auth.constant';

import { MESS_CONSTANTS } from './mess.constant';

const nameField = z
  .string({ required_error: 'Mess name is required' })
  .trim()
  .min(MESS_CONSTANTS.MIN_NAME_LENGTH, 'Name must be at least 2 characters')
  .max(MESS_CONSTANTS.MAX_NAME_LENGTH, 'Name must be at most 80 characters');

const addressField = z
  .string()
  .trim()
  .max(
    MESS_CONSTANTS.MAX_ADDRESS_LENGTH,
    'Address must be at most 255 characters',
  );

const phoneField = z
  .string()
  .trim()
  .regex(BD_PHONE_REGEX, 'Invalid Bangladeshi phone number');

/**
 * POST /messes
 */
export const createMessSchema = z.object({
  body: z.object({
    name: nameField,
    address: addressField.optional(),
    phone: phoneField.optional(),
  }),
});

/**
 * PATCH /messes/current
 */
export const updateMessSchema = z.object({
  body: z
    .object({
      name: nameField.optional(),
      address: addressField.nullable().optional(),
      phone: phoneField.nullable().optional(),
      isActive: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});

/**
 * GET /messes
 */
export const listMessesQuerySchema = z.object({
  query: z.object({
    isActive: z
      .union([z.literal('true'), z.literal('false')])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    role: z.enum(['OWNER', 'MEMBER', 'ANY']).optional().default('ANY'),
    scope: z.enum(['mine', 'system']).optional().default('mine'),
    search: z.string().trim().max(80).optional(),
    page: z
      .string()
      .optional()
      .transform((v) => (v === undefined ? undefined : Number(v)))
      .refine((v) => v === undefined || (Number.isFinite(v) && v >= 1), {
        message: 'page must be a positive number',
      }),
    limit: z
      .string()
      .optional()
      .transform((v) => (v === undefined ? undefined : Number(v)))
      .refine(
        (v) => v === undefined || (Number.isFinite(v) && v >= 1 && v <= 100),
        { message: 'limit must be between 1 and 100' },
      ),
    sort_by: z
      .enum(['createdAt', 'updatedAt', 'name'])
      .optional()
      .default('createdAt'),
    sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});

export const transferOwnershipSchema = z.object({
  body: z.object({
    newOwnerMemberId: z
      .string({ required_error: 'newOwnerMemberId is required' })
      .trim()
      .min(1, 'newOwnerMemberId is required'),
  }),
});

export type CreateMessInput = z.infer<typeof createMessSchema>['body'];
export type UpdateMessInput = z.infer<typeof updateMessSchema>['body'];
export type ListMessesQuery = z.infer<typeof listMessesQuerySchema>['query'];
export type TransferOwnershipInput = z.infer<
  typeof transferOwnershipSchema
>['body'];
