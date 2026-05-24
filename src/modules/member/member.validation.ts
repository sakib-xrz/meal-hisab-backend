import { MemberStatus } from '@prisma/client';
import { z } from 'zod';

import { BD_PHONE_REGEX } from '@/modules/auth/auth.constant';
import { MESS_ROLE_KEYS } from '@/modules/mess/mess-role.constant';

import { MEMBER_CONSTANTS } from './member.constant';

const memberIdParam = z
  .string({ required_error: 'Member id is required' })
  .trim()
  .min(1, 'Member id is required');

const fullNameField = z
  .string({ required_error: 'Full name is required' })
  .trim()
  .min(
    MEMBER_CONSTANTS.MIN_NAME_LENGTH,
    'Full name must be at least 2 characters',
  )
  .max(
    MEMBER_CONSTANTS.MAX_NAME_LENGTH,
    'Full name must be at most 80 characters',
  );

const phoneField = z
  .string({ required_error: 'Phone is required' })
  .trim()
  .regex(BD_PHONE_REGEX, 'Invalid Bangladeshi phone number');

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(MEMBER_CONSTANTS.MAX_EMAIL_LENGTH, 'Email is too long')
  .email('Invalid email address');

const roomNoField = z
  .string()
  .trim()
  .max(MEMBER_CONSTANTS.MAX_ROOM_NO_LENGTH, 'Room number is too long');

const dateField = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(new Date(v).valueOf()), {
    message: 'Invalid date',
  })
  .transform((v) => new Date(v));

const statusEnum = z.nativeEnum(MemberStatus);
const assignableRoleKeyEnum = z.enum([
  MESS_ROLE_KEYS.MANAGER,
  MESS_ROLE_KEYS.MEMBER,
]);
const roleKeyEnum = z.enum([
  MESS_ROLE_KEYS.OWNER,
  MESS_ROLE_KEYS.MANAGER,
  MESS_ROLE_KEYS.MEMBER,
]);

export const createMemberSchema = z.object({
  body: z.object({
    phone: phoneField,
    roleKey: assignableRoleKeyEnum.optional().default(MESS_ROLE_KEYS.MEMBER),
    joiningDate: dateField.optional(),
  }),
});

export const updateMemberSchema = z.object({
  params: z.object({ memberId: memberIdParam }),
  body: z
    .object({
      fullName: fullNameField.optional(),
      phone: phoneField.nullable().optional(),
      email: emailField.nullable().optional(),
      roomNo: roomNoField.nullable().optional(),
      roleKey: roleKeyEnum.optional(),
      status: statusEnum.optional(),
      joiningDate: dateField.optional(),
      leavingDate: dateField.nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});

export const memberIdParamsSchema = z.object({
  params: z.object({ memberId: memberIdParam }),
});

export const listMembersQuerySchema = z.object({
  query: z.object({
    status: statusEnum.optional(),
    roleKey: roleKeyEnum.optional(),
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
      .enum(['createdAt', 'updatedAt', 'fullName', 'joiningDate'])
      .optional()
      .default('createdAt'),
    sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>['body'];
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>['body'];
export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>['query'];
