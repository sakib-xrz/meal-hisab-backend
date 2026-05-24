import httpStatus from 'http-status';
import { MemberStatus, MembershipStatus, Prisma } from '@prisma/client';

import AppError from '@/errors/app-error';
import prisma from '@/lib/prisma';
import { calculatePagination } from '@/utils/pagination';

import { MESS_CONSTANTS } from './mess.constant';
import { MESS_ROLE_KEYS } from './mess-role.constant';
import {
  assertUserHasNoCurrentMembership,
  throwMembershipConflictFromDbError,
} from './mess-membership.utils';
import { seedDefaultMessRoles } from './mess-role.utils';
import {
  assertMessAccess,
  assertMessAdminOrOwner,
  assertMessOwner,
} from './mess.utils';
import { MESS_MEMBERSHIP_ERRORS } from './mess.constant';
import {
  CreateMessInput,
  ListMessesQuery,
  TransferOwnershipInput,
  UpdateMessInput,
} from './mess.validation';

const publicMessSelect = {
  id: true,
  name: true,
  address: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MessSelect;

type PublicMess = Prisma.MessGetPayload<{ select: typeof publicMessSelect }>;

/**
 * POST /messes
 *
 * Creates a new mess, seeds default roles, registers the creator as a
 * member profile, and links them as OWNER via MessUser.
 */
const createMess = async (
  userId: string,
  payload: CreateMessInput,
): Promise<PublicMess> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, phone: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Your account is not active. Please contact support.',
    );
  }

  await assertUserHasNoCurrentMembership(userId);

  const mess = await prisma
    .$transaction(async (tx) => {
      const created = await tx.mess.create({
        data: {
          name: payload.name.trim(),
          address: payload.address?.trim() || null,
          phone: payload.phone?.trim() || null,
        },
        select: publicMessSelect,
      });

      const roleMap = await seedDefaultMessRoles(tx, created.id);

      const member = await tx.member.create({
        data: {
          messId: created.id,
          fullName: user.name,
          phone: user.phone,
          status: MemberStatus.ACTIVE,
          joiningDate: new Date(),
        },
        select: { id: true },
      });

      await tx.messUser.create({
        data: {
          messId: created.id,
          userId: user.id,
          roleId: roleMap.get(MESS_ROLE_KEYS.OWNER)!,
          memberId: member.id,
          status: MembershipStatus.ACTIVE,
        },
      });

      return created;
    })
    .catch(throwMembershipConflictFromDbError);

  return mess;
};

/**
 * GET /messes
 */
const getMess = async (userId: string, messId: string) => {
  const access = await assertMessAccess(messId, userId);

  const mess = await prisma.mess.findUnique({
    where: { id: messId },
    select: {
      ...publicMessSelect,
      users: {
        where: {
          status: MembershipStatus.ACTIVE,
          role: { key: MESS_ROLE_KEYS.OWNER },
        },
        select: {
          user: {
            select: { id: true, name: true, phone: true, avatarUrl: true },
          },
        },
        take: 1,
      },
      _count: {
        select: {
          members: { where: { status: MemberStatus.ACTIVE } },
        },
      },
    },
  });

  if (!mess) {
    throw new AppError(httpStatus.NOT_FOUND, 'Mess not found');
  }

  const { _count, users, ...rest } = mess;

  return {
    ...rest,
    activeMemberCount: _count.members,
    owner: users[0]?.user ?? null,
    isOwner: access.isOwner,
    myRole: access.messUser?.role ?? null,
    myMemberId: access.messUser?.memberId ?? null,
  };
};

/**
 * PATCH /messes
 */
const updateMess = async (
  userId: string,
  messId: string,
  payload: UpdateMessInput,
): Promise<PublicMess> => {
  await assertMessAdminOrOwner(messId, userId);

  const data: Prisma.MessUpdateInput = {};

  if (payload.name !== undefined) data.name = payload.name.trim();
  if (payload.address !== undefined) {
    data.address = payload.address === null ? null : payload.address.trim();
  }
  if (payload.phone !== undefined) {
    data.phone = payload.phone === null ? null : payload.phone.trim();
  }
  if (payload.isActive !== undefined) data.isActive = payload.isActive;

  const updated = await prisma.mess.update({
    where: { id: messId },
    data,
    select: publicMessSelect,
  });

  return updated;
};

/**
 * DELETE /messes
 */
const deleteMess = async (
  userId: string,
  messId: string,
): Promise<{ id: string }> => {
  await assertMessOwner(messId, userId);

  await prisma.mess.delete({ where: { id: messId } });

  return { id: messId };
};

/**
 * PATCH /messes/transfer-ownership
 *
 * Promotes another active MessUser to OWNER and demotes the current owner
 * to MANAGER.
 */
const transferOwnership = async (
  userId: string,
  messId: string,
  payload: TransferOwnershipInput,
): Promise<PublicMess> => {
  await assertMessOwner(messId, userId);

  const [newOwnerMember, currentOwnerMembership, roles] = await Promise.all([
    prisma.member.findFirst({
      where: {
        id: payload.newOwnerMemberId,
        messId,
        status: MemberStatus.ACTIVE,
      },
      select: {
        id: true,
        messUsers: {
          where: { status: MembershipStatus.ACTIVE },
          select: { id: true, userId: true },
          take: 1,
        },
      },
    }),
    prisma.messUser.findFirst({
      where: {
        messId,
        userId,
        status: MembershipStatus.ACTIVE,
        role: { key: MESS_ROLE_KEYS.OWNER },
      },
      select: { id: true, memberId: true },
    }),
    prisma.messRole.findMany({
      where: {
        messId,
        key: { in: [MESS_ROLE_KEYS.OWNER, MESS_ROLE_KEYS.MANAGER] },
      },
      select: { id: true, key: true },
    }),
  ]);

  if (!newOwnerMember) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'The selected member was not found or is not active',
    );
  }

  const newOwnerMembership = newOwnerMember.messUsers[0];

  if (!newOwnerMembership) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'The selected member must have an active app account linked before becoming the owner',
    );
  }

  if (
    newOwnerMembership.userId === userId ||
    currentOwnerMembership?.memberId === newOwnerMember.id
  ) {
    throw new AppError(httpStatus.BAD_REQUEST, 'You already own this mess');
  }

  if (!currentOwnerMembership) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Current owner membership could not be resolved',
    );
  }

  const ownerRoleId = roles.find((r) => r.key === MESS_ROLE_KEYS.OWNER)?.id;
  const managerRoleId = roles.find((r) => r.key === MESS_ROLE_KEYS.MANAGER)?.id;

  if (!ownerRoleId || !managerRoleId) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Required mess roles are missing',
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.messUser.update({
      where: { id: currentOwnerMembership.id },
      data: { roleId: managerRoleId },
    });

    await tx.messUser.update({
      where: { id: newOwnerMembership.id },
      data: { roleId: ownerRoleId },
    });

    return tx.mess.findUniqueOrThrow({
      where: { id: messId },
      select: publicMessSelect,
    });
  });

  return updated;
};

/**
 * GET /messes/stats
 */
const getMessStats = async (userId: string, messId: string) => {
  await assertMessAccess(messId, userId);

  const [activeMemberCount, mealAgg, bazaarAgg, expenseAgg, paymentAgg] =
    await prisma.$transaction([
      prisma.member.count({
        where: { messId, status: MemberStatus.ACTIVE },
      }),
      prisma.mealEntry.aggregate({
        where: { messId },
        _sum: { breakfast: true, lunch: true, dinner: true },
      }),
      prisma.bazaarEntry.aggregate({
        where: { messId },
        _sum: { totalAmount: true },
      }),
      prisma.expense.aggregate({
        where: { messId },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { messId },
        _sum: { amount: true },
      }),
    ]);

  const totalMealsDecimal =
    Number(mealAgg._sum.breakfast ?? 0) +
    Number(mealAgg._sum.lunch ?? 0) +
    Number(mealAgg._sum.dinner ?? 0);
  const totalBazaar = Number(bazaarAgg._sum.totalAmount ?? 0);
  const totalExtraExpense = Number(expenseAgg._sum.amount ?? 0);
  const totalPayments = Number(paymentAgg._sum.amount ?? 0);

  const mealRate =
    totalMealsDecimal > 0
      ? Number((totalBazaar / totalMealsDecimal).toFixed(4))
      : 0;

  return {
    activeMemberCount,
    totalMeals: totalMealsDecimal,
    totalBazaarCost: totalBazaar,
    totalExtraExpense,
    totalPayments,
    mealRate,
  };
};

/**
 * POST /messes/leave
 *
 * Lets the authenticated user leave their current mess membership.
 * Owners must transfer ownership before leaving.
 */
const leaveMess = async (
  userId: string,
  messId: string,
): Promise<{ messId: string; leftAt: Date }> => {
  const access = await assertMessAccess(messId, userId);

  if (!access.messUser) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You do not have access to this mess',
    );
  }

  if (access.isOwner) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      MESS_MEMBERSHIP_ERRORS.OWNER_CANNOT_LEAVE,
    );
  }

  const { messUser } = access;
  const leftAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.messUser.update({
      where: { id: messUser.id },
      data: {
        status: MembershipStatus.REMOVED,
        removedAt: leftAt,
      },
    });

    if (messUser.memberId) {
      await tx.member.update({
        where: { id: messUser.memberId },
        data: {
          status: MemberStatus.LEFT,
          leavingDate: leftAt,
        },
      });
    }
  });

  return { messId, leftAt };
};

const MessService = {
  createMess,
  getMess,
  updateMess,
  deleteMess,
  transferOwnership,
  getMessStats,
  leaveMess,
};

export default MessService;
