import httpStatus from 'http-status';
import { MembershipStatus } from '@prisma/client';

import AppError from '@/errors/app-error';
import prisma from '@/lib/prisma';

import { MESS_ROLE_KEYS, MessRoleKey } from './mess-role.constant';

const messUserAccessSelect = {
  id: true,
  messId: true,
  userId: true,
  memberId: true,
  status: true,
  role: {
    select: {
      id: true,
      key: true,
      name: true,
      permissions: true,
    },
  },
  member: {
    select: {
      id: true,
      fullName: true,
      status: true,
    },
  },
} as const;

export type MessAccessContext = {
  mess: { id: string; isActive: boolean };
  messUser: {
    id: string;
    messId: string;
    userId: string;
    memberId: string | null;
    status: MembershipStatus;
    role: {
      id: string;
      key: string;
      name: string;
      permissions: unknown;
    };
    member: {
      id: string;
      fullName: string;
      status: string;
    } | null;
  } | null;
  isSuperAdmin: boolean;
  roleKey: MessRoleKey | null;
  isOwner: boolean;
  member: MessAccessContext['messUser'] extends infer U
    ? U extends { member: infer M }
      ? M
      : null
    : null;
};

const isElevatedRole = (roleKey: string | null | undefined): boolean =>
  roleKey === MESS_ROLE_KEYS.OWNER || roleKey === MESS_ROLE_KEYS.MANAGER;

const isOwnerRole = (roleKey: string | null | undefined): boolean =>
  roleKey === MESS_ROLE_KEYS.OWNER;

/**
 * Resolves a user's relationship to a mess via MessUser.
 * Super admins bypass membership checks but still receive mess metadata.
 */
export const resolveMessAccess = async (
  messId: string,
  userId: string,
): Promise<MessAccessContext> => {
  const [mess, user, messUser] = await Promise.all([
    prisma.mess.findUnique({
      where: { id: messId },
      select: { id: true, isActive: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    }),
    prisma.messUser.findFirst({
      where: { messId, userId, status: MembershipStatus.ACTIVE },
      select: messUserAccessSelect,
    }),
  ]);

  if (!mess) {
    throw new AppError(httpStatus.NOT_FOUND, 'Mess not found');
  }

  const isSuperAdmin = user?.isSuperAdmin ?? false;
  const roleKey = (messUser?.role.key as MessRoleKey | undefined) ?? null;

  return {
    mess,
    messUser,
    isSuperAdmin,
    roleKey,
    isOwner: isOwnerRole(roleKey),
    member: messUser?.member ?? null,
  };
};

export const assertMessActive = (access: MessAccessContext): void => {
  if (!access.mess.isActive && !access.isSuperAdmin) {
    throw new AppError(httpStatus.FORBIDDEN, 'This mess is inactive');
  }
};

/**
 * Throws 403 if the user is not the mess owner (or super admin).
 */
export const assertMessOwner = async (messId: string, userId: string) => {
  const access = await resolveMessAccess(messId, userId);
  assertMessActive(access);

  if (!access.isSuperAdmin && !access.isOwner) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only the mess owner can perform this action',
    );
  }

  return access;
};

/**
 * Allows owner, manager, or super admin.
 */
export const assertMessAdminOrOwner = async (
  messId: string,
  userId: string,
) => {
  const access = await resolveMessAccess(messId, userId);
  assertMessActive(access);

  if (!access.isSuperAdmin && !isElevatedRole(access.roleKey)) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only the mess owner or a manager can perform this action',
    );
  }

  return access;
};

/**
 * Allows any active mess member or super admin.
 */
export const assertMessAccess = async (messId: string, userId: string) => {
  const access = await resolveMessAccess(messId, userId);
  assertMessActive(access);

  if (!access.isSuperAdmin && !access.messUser) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You do not have access to this mess',
    );
  }

  return access;
};

/**
 * Allows owner, manager, or super admin for day-to-day write operations.
 */
export const assertMessManagerOrAbove = async (
  messId: string,
  userId: string,
) => {
  const access = await resolveMessAccess(messId, userId);
  assertMessActive(access);

  if (!access.isSuperAdmin && !isElevatedRole(access.roleKey)) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only the mess owner, a manager, or a super admin can perform this action',
    );
  }

  return access;
};

const MessUtils = {
  assertMessOwner,
  assertMessAdminOrOwner,
  assertMessManagerOrAbove,
  assertMessAccess,
  resolveMessAccess,
};

export default MessUtils;
