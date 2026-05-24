import httpStatus from 'http-status';
import { MemberStatus, MembershipStatus, Prisma } from '@prisma/client';

import AppError from '@/errors/app-error';
import prisma from '@/lib/prisma';
import { normalizeBdPhone } from '@/modules/auth/auth.constant';
import {
  assertMessAccess,
  assertMessAdminOrOwner,
} from '@/modules/mess/mess.utils';
import { MESS_ROLE_KEYS, MessRoleKey } from '@/modules/mess/mess-role.constant';
import { getMessRoleIdByKey } from '@/modules/mess/mess-role.utils';
import {
  assertTargetUserHasNoCurrentMembership,
  CURRENT_MEMBERSHIP_STATUSES,
  throwMembershipConflictFromDbError,
} from '@/modules/mess/mess-membership.utils';
import { calculatePagination } from '@/utils/pagination';

import {
  CreateMemberInput,
  ListMembersQuery,
  UpdateMemberInput,
} from './member.validation';

const publicMemberSelect = {
  id: true,
  messId: true,
  fullName: true,
  phone: true,
  status: true,
  joiningDate: true,
  leavingDate: true,
} satisfies Prisma.MemberSelect;

type PublicMember = Prisma.MemberGetPayload<{
  select: typeof publicMemberSelect;
}>;

const memberWithLinksSelect = {
  ...publicMemberSelect,
  messUsers: {
    where: { status: MembershipStatus.ACTIVE },
    select: {
      id: true,
      userId: true,
      status: true,
      role: { select: { id: true, key: true, name: true } },
      user: {
        select: { id: true, name: true, phone: true, avatarUrl: true },
      },
    },
  },
} satisfies Prisma.MemberSelect;

type MemberWithLinks = Prisma.MemberGetPayload<{
  select: typeof memberWithLinksSelect;
}>;

type ListedMember = PublicMember & {
  role: MessRoleKey | null;
  avatarUrl: string | null;
};

const toListedMember = (member: MemberWithLinks): ListedMember => {
  const link = member.messUsers[0];
  const { messUsers: _, ...rest } = member;

  return {
    ...rest,
    role: (link?.role?.key as MessRoleKey) ?? null,
    avatarUrl: link?.user?.avatarUrl ?? null,
  };
};

const linkUserToMember = async (
  tx: Prisma.TransactionClient,
  messId: string,
  memberId: string,
  userId: string,
  roleKey: MessRoleKey,
): Promise<void> => {
  const existing = await tx.messUser.findUnique({
    where: { messId_userId: { messId, userId } },
    select: { id: true, status: true },
  });

  if (
    existing?.status &&
    CURRENT_MEMBERSHIP_STATUSES.includes(existing.status)
  ) {
    throw new AppError(
      httpStatus.CONFLICT,
      'This user already has active access to the mess',
    );
  }

  await assertTargetUserHasNoCurrentMembership(userId, {
    excludeMessId: messId,
  });

  const roleId = await getMessRoleIdByKey(messId, roleKey);

  if (existing) {
    try {
      await tx.messUser.update({
        where: { id: existing.id },
        data: {
          roleId,
          memberId,
          status: MembershipStatus.ACTIVE,
          removedAt: null,
        },
      });
    } catch (error) {
      throwMembershipConflictFromDbError(error);
    }
    return;
  }

  try {
    await tx.messUser.create({
      data: {
        messId,
        userId,
        roleId,
        memberId,
        status: MembershipStatus.ACTIVE,
      },
    });
  } catch (error) {
    throwMembershipConflictFromDbError(error);
  }
};

/**
 * POST /messes/members
 */
const createMember = async (
  callerUserId: string,
  messId: string,
  payload: CreateMemberInput,
): Promise<PublicMember> => {
  await assertMessAdminOrOwner(messId, callerUserId);

  const normalizedPhone = normalizeBdPhone(payload.phone);

  const existing = await prisma.member.findFirst({
    where: { messId, phone: normalizedPhone },
    select: { id: true },
  });

  if (existing) {
    throw new AppError(
      httpStatus.CONFLICT,
      'A member with this phone number already exists in this mess',
    );
  }

  const user = await prisma.user.findUnique({
    where: { phone: normalizedPhone },
    select: { id: true, name: true, phone: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  const roleKey = payload.roleKey ?? MESS_ROLE_KEYS.MEMBER;

  const member = await prisma.$transaction(async (tx) => {
    const created = await tx.member.create({
      data: {
        messId,
        fullName: user.name,
        phone: user.phone,
        status: MemberStatus.ACTIVE,
        joiningDate: payload.joiningDate ?? new Date(),
      },
      select: publicMemberSelect,
    });

    await linkUserToMember(tx, messId, created.id, user.id, roleKey);

    return created;
  });

  return member;
};

/**
 * GET /messes/members
 */
const listMembers = async (
  callerUserId: string,
  messId: string,
  query: ListMembersQuery,
) => {
  await assertMessAccess(messId, callerUserId);

  const { page, limit, skip, sort_by, sort_order } = calculatePagination({
    page: query.page,
    limit: query.limit,
    sort_by: query.sort_by,
    sort_order: query.sort_order,
  });

  const where: Prisma.MemberWhereInput = {
    messId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.roleKey
      ? {
          messUsers: {
            some: {
              status: MembershipStatus.ACTIVE,
              role: { key: query.roleKey },
            },
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            {
              fullName: {
                contains: query.search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            { phone: { contains: query.search } },
            {
              email: {
                contains: query.search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          ],
        }
      : {}),
  };

  const [total, members] = await prisma.$transaction([
    prisma.member.count({ where }),
    prisma.member.findMany({
      where,
      select: memberWithLinksSelect,
      orderBy: { [sort_by]: sort_order },
      skip,
      take: limit,
    }),
  ]);

  return {
    data: members.map(toListedMember),
    meta: { page, limit, total },
  };
};

/**
 * PATCH /messes/members/:memberId
 */
const updateMember = async (
  callerUserId: string,
  messId: string,
  memberId: string,
  payload: UpdateMemberInput,
): Promise<PublicMember> => {
  await assertMessAdminOrOwner(messId, callerUserId);

  const existing = await prisma.member.findFirst({
    where: { id: memberId, messId },
    select: {
      id: true,
      phone: true,
      status: true,
      messUsers: {
        where: {
          status: MembershipStatus.ACTIVE,
          role: { key: MESS_ROLE_KEYS.OWNER },
        },
        select: { id: true, userId: true },
      },
    },
  });

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, 'Member not found');
  }

  const isOwnerMember = existing.messUsers.length > 0;

  if (
    isOwnerMember &&
    payload.status !== undefined &&
    payload.status !== MemberStatus.ACTIVE
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You cannot deactivate the mess owner. Transfer ownership first.',
    );
  }

  const data: Prisma.MemberUpdateInput = {};

  if (payload.fullName !== undefined) data.fullName = payload.fullName.trim();

  if (payload.phone !== undefined) {
    if (payload.phone === null) {
      data.phone = null;
    } else {
      const normalized = normalizeBdPhone(payload.phone);

      if (normalized !== existing.phone) {
        const conflict = await prisma.member.findFirst({
          where: {
            messId,
            phone: normalized,
            NOT: { id: memberId },
          },
          select: { id: true },
        });

        if (conflict) {
          throw new AppError(
            httpStatus.CONFLICT,
            'Another member in this mess already uses this phone number',
          );
        }
      }

      data.phone = normalized;
    }
  }

  if (payload.email !== undefined) {
    data.email = payload.email === null ? null : payload.email;
  }

  if (payload.roomNo !== undefined) {
    data.roomNo = payload.roomNo === null ? null : payload.roomNo.trim();
  }

  if (payload.joiningDate !== undefined) data.joiningDate = payload.joiningDate;

  if (payload.status !== undefined) {
    data.status = payload.status;

    if (payload.status === MemberStatus.LEFT) {
      data.leavingDate = payload.leavingDate ?? new Date();
    } else if (payload.status === MemberStatus.ACTIVE) {
      data.leavingDate = null;
    }
  }

  if (
    payload.leavingDate !== undefined &&
    !(payload.status === MemberStatus.LEFT && payload.leavingDate)
  ) {
    data.leavingDate = payload.leavingDate;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const member = await tx.member.update({
      where: { id: memberId },
      data,
      select: publicMemberSelect,
    });

    if (payload.roleKey && !isOwnerMember) {
      const messUser = await tx.messUser.findFirst({
        where: { messId, memberId, status: MembershipStatus.ACTIVE },
        select: { id: true },
      });

      if (messUser) {
        const roleId = await getMessRoleIdByKey(messId, payload.roleKey);
        await tx.messUser.update({
          where: { id: messUser.id },
          data: { roleId },
        });
      }
    }

    if (payload.status === MemberStatus.LEFT) {
      await tx.messUser.updateMany({
        where: { messId, memberId, status: MembershipStatus.ACTIVE },
        data: {
          status: MembershipStatus.REMOVED,
          removedAt: new Date(),
        },
      });
    }

    return member;
  });

  return updated;
};

/**
 * DELETE /messes/members/:memberId
 */
const removeMember = async (
  callerUserId: string,
  messId: string,
  memberId: string,
): Promise<PublicMember> => {
  await assertMessAdminOrOwner(messId, callerUserId);

  const existing = await prisma.member.findFirst({
    where: { id: memberId, messId },
    select: {
      id: true,
      status: true,
      messUsers: {
        where: {
          status: MembershipStatus.ACTIVE,
          role: { key: MESS_ROLE_KEYS.OWNER },
        },
        select: { id: true },
      },
    },
  });

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, 'Member not found');
  }

  if (existing.messUsers.length > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You cannot remove the mess owner. Transfer ownership first.',
    );
  }

  if (existing.status === MemberStatus.LEFT) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This member has already left the mess',
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.messUser.updateMany({
      where: { messId, memberId, status: MembershipStatus.ACTIVE },
      data: {
        status: MembershipStatus.REMOVED,
        removedAt: new Date(),
      },
    });

    return tx.member.update({
      where: { id: memberId },
      data: {
        status: MemberStatus.LEFT,
        leavingDate: new Date(),
      },
      select: publicMemberSelect,
    });
  });

  return updated;
};

const MemberService = {
  createMember,
  listMembers,
  updateMember,
  removeMember,
};

export default MemberService;
