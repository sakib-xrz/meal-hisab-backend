import httpStatus from 'http-status';
import { MembershipStatus, Prisma } from '@prisma/client';

import AppError from '@/errors/app-error';
import prisma from '@/lib/prisma';

import { MESS_MEMBERSHIP_ERRORS } from './mess.constant';

/** Statuses that count as a current (non-historical) mess membership. */
export const CURRENT_MEMBERSHIP_STATUSES: MembershipStatus[] = [
  MembershipStatus.ACTIVE,
  MembershipStatus.INVITED,
];

const isSuperAdminUser = async (userId: string): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  });

  return user?.isSuperAdmin ?? false;
};

export const findUserCurrentMembership = async (
  userId: string,
  excludeMessId?: string,
) => {
  return prisma.messUser.findFirst({
    where: {
      userId,
      status: { in: CURRENT_MEMBERSHIP_STATUSES },
      ...(excludeMessId ? { messId: { not: excludeMessId } } : {}),
    },
    select: { id: true, messId: true, status: true },
  });
};

/**
 * Ensures the user has no ACTIVE/INVITED membership in another mess.
 * Super admins are exempt from the one-mess rule.
 */
export const assertUserHasNoCurrentMembership = async (
  userId: string,
  options?: { excludeMessId?: string },
): Promise<void> => {
  if (await isSuperAdminUser(userId)) {
    return;
  }

  const existing = await findUserCurrentMembership(
    userId,
    options?.excludeMessId,
  );

  if (existing) {
    throw new AppError(
      httpStatus.CONFLICT,
      MESS_MEMBERSHIP_ERRORS.SELF_CONFLICT,
    );
  }
};

/**
 * Same as {@link assertUserHasNoCurrentMembership} but with admin-facing copy
 * when blocking auto-link flows for another user.
 */
export const assertTargetUserHasNoCurrentMembership = async (
  targetUserId: string,
  options?: { excludeMessId?: string },
): Promise<void> => {
  if (await isSuperAdminUser(targetUserId)) {
    return;
  }

  const existing = await findUserCurrentMembership(
    targetUserId,
    options?.excludeMessId,
  );

  if (existing) {
    throw new AppError(
      httpStatus.CONFLICT,
      MESS_MEMBERSHIP_ERRORS.TARGET_CONFLICT,
    );
  }
};

/** Maps DB unique-index violations to a friendly membership conflict error. */
export const isMessUserMembershipUniqueViolation = (
  error: unknown,
): boolean => {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }

  const target = error.meta?.target;
  const constraint = error.meta?.constraint;

  if (constraint === 'MessUser_one_current_membership_per_user') {
    return true;
  }

  return (
    Array.isArray(target) &&
    target.length === 1 &&
    target[0] === 'userId'
  );
};

export const throwMembershipConflictFromDbError = (error: unknown): never => {
  if (isMessUserMembershipUniqueViolation(error)) {
    throw new AppError(
      httpStatus.CONFLICT,
      MESS_MEMBERSHIP_ERRORS.SELF_CONFLICT,
    );
  }

  throw error;
};
