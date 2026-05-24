import httpStatus from 'http-status';
import { AssetType, Prisma } from '@prisma/client';

import AppError from '@/errors/app-error';
import prisma from '@/lib/prisma';
import { deleteFromR2, uploadToR2 } from '@/utils/handle-cloudflare-r2-file';
import { logger } from '@/utils/logger';

import { normalizeBdPhone } from './auth.constant';
import {
  comparePassword,
  generateAccessToken,
  hashPassword,
} from './auth.utils';
import {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from './auth.validation';

/**
 * Common public-safe selection for User.
 */
const publicUserSelect = {
  id: true,
  name: true,
  phone: true,
  avatarUrl: true,
  isPhoneVerified: true,
  isActive: true,
  isSuperAdmin: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

/**
 * POST /auth/register
 *
 * Creates a new user account with phone + password.
 */
const register = async (
  payload: RegisterInput,
): Promise<{ user: PublicUser; accessToken: string }> => {
  const phone = normalizeBdPhone(payload.phone);

  const existing = await prisma.user.findUnique({
    where: { phone },
    select: { id: true },
  });

  if (existing) {
    throw new AppError(
      httpStatus.CONFLICT,
      'An account with this phone number already exists',
    );
  }

  const passwordHash = await hashPassword(payload.password);

  const user = await prisma.user.create({
    data: {
      name: payload.name.trim(),
      phone,
      passwordHash,
      avatarUrl: payload.avatarUrl,
    },
    select: publicUserSelect,
  });

  const accessToken = generateAccessToken({
    id: user.id,
    phone: user.phone,
  });

  return { user, accessToken };
};

/**
 * POST /auth/login
 *
 * Authenticates a user by phone + password.
 */
const login = async (
  payload: LoginInput,
): Promise<{ user: PublicUser; accessToken: string }> => {
  const phone = normalizeBdPhone(payload.phone);

  const user = await prisma.user.findUnique({
    where: { phone },
    include: {
      memberships: {
        where: { status: { not: 'REMOVED' } },
        select: {
          id: true,
          messId: true,
          memberId: true,
          status: true,
          joinedAt: true,
          role: {
            select: { id: true, key: true, name: true },
          },
          member: {
            select: {
              id: true,
              fullName: true,
              status: true,
            },
          },
          mess: {
            select: {
              id: true,
              name: true,
              phone: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Invalid phone number or password',
    );
  }

  if (!user.isActive) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Your account has been deactivated. Please contact support.',
    );
  }

  const passwordOk = await comparePassword(payload.password, user.passwordHash);
  if (!passwordOk) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Invalid phone number or password',
    );
  }

  const accessToken = generateAccessToken({
    id: user.id,
    phone: user.phone,
  });

  const publicUser: PublicUser = {
    id: user.id,
    name: user.name,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    isPhoneVerified: user.isPhoneVerified,
    isActive: user.isActive,
    isSuperAdmin: user.isSuperAdmin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  const publicUserWithMemberships = {
    ...publicUser,
    memberships: user.memberships,
  };

  return {
    user: publicUserWithMemberships,
    accessToken,
  };
};

/**
 * GET /auth/me
 *
 * Returns the authenticated user profile and its memberships.
 */
const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...publicUserSelect,
      memberships: {
        where: { status: { not: 'REMOVED' } },
        select: {
          id: true,
          messId: true,
          memberId: true,
          status: true,
          joinedAt: true,
          role: {
            select: { id: true, key: true, name: true },
          },
          member: {
            select: {
              id: true,
              fullName: true,
              status: true,
            },
          },
          mess: {
            select: {
              id: true,
              name: true,
              phone: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!user.isActive) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Your account has been deactivated.',
    );
  }

  return user;
};

/**
 * PATCH /auth/change-password
 */
const changePassword = async (
  userId: string,
  payload: ChangePasswordInput,
): Promise<{ id: string; phone: string }> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!user.isActive) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Your account has been deactivated.',
    );
  }

  const ok = await comparePassword(payload.currentPassword, user.passwordHash);
  if (!ok) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Current password is incorrect',
    );
  }

  if (payload.currentPassword === payload.newPassword) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'New password must be different from current password',
    );
  }

  const passwordHash = await hashPassword(payload.newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return { id: user.id, phone: user.phone };
};

/**
 * PATCH /auth/profile
 *
 * Updates non-file profile fields (currently just `name`). Avatar uploads
 * are handled by `updateAvatar` below.
 */
const updateProfile = async (
  userId: string,
  payload: UpdateProfileInput,
): Promise<PublicUser> => {
  const exists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true },
  });

  if (!exists) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!exists.isActive) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Your account has been deactivated.',
    );
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(payload.name !== undefined && { name: payload.name.trim() }),
    },
    select: publicUserSelect,
  });

  return user;
};

/**
 * PATCH /auth/avatar
 *
 * Uploads a new avatar file to Cloudflare R2, persists an Asset row tied
 * to the user, and updates the user's `avatarUrl` + `avatarAssetId`.
 *
 * If the user previously had an avatar, the old Asset row is removed and
 * we best-effort delete the object from R2 as well (failures there are
 * logged but do not fail the request — the row is the source of truth).
 */
const updateAvatar = async (
  userId: string,
  file: Express.Multer.File | undefined,
): Promise<PublicUser> => {
  if (!file) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Avatar file is required');
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isActive: true,
      avatarAssetId: true,
      avatarAsset: { select: { id: true, key: true } },
    },
  });

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!existing.isActive) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Your account has been deactivated.',
    );
  }

  const uploaded = await uploadToR2(file, { folder: 'avatars' });

  // Persist the new asset and switch the user's avatar to it in one tx so
  // we never end up with a dangling FK or an orphaned asset row.
  const { user, previousAsset } = await prisma.$transaction(async (tx) => {
    const asset = await tx.asset.create({
      data: {
        key: uploaded.key,
        url: uploaded.url,
        mimetype: file.mimetype,
        sizeBytes: file.size,
        originalName: file.originalname,
        type: AssetType.AVATAR,
        ownerUserId: userId,
      },
    });

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        avatarUrl: asset.url,
        avatarAssetId: asset.id,
      },
      select: publicUserSelect,
    });

    let prev: { id: string; key: string } | null = null;
    if (existing.avatarAsset) {
      prev = existing.avatarAsset;
      await tx.asset.delete({ where: { id: existing.avatarAsset.id } });
    }

    return { user: updatedUser, previousAsset: prev };
  });

  if (previousAsset) {
    try {
      await deleteFromR2(previousAsset.key);
    } catch (err) {
      logger.error(
        `Failed to delete previous avatar from R2 (key=${previousAsset.key}):`,
        err,
      );
    }
  }

  return user;
};

/**
 * DELETE /auth/avatar
 *
 * Removes the user's current avatar: clears the user fields, deletes the
 * Asset row, and best-effort removes the underlying R2 object.
 */
const deleteAvatar = async (userId: string): Promise<PublicUser> => {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isActive: true,
      avatarAsset: { select: { id: true, key: true } },
    },
  });

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!existing.isActive) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Your account has been deactivated.',
    );
  }

  if (!existing.avatarAsset) {
    // Nothing to remove — just return current profile.
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: publicUserSelect,
    });
    return user;
  }

  const { user, removedKey } = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        avatarUrl: null,
        avatarAssetId: null,
      },
      select: publicUserSelect,
    });

    await tx.asset.delete({ where: { id: existing.avatarAsset!.id } });

    return { user: updatedUser, removedKey: existing.avatarAsset!.key };
  });

  try {
    await deleteFromR2(removedKey);
  } catch (err) {
    logger.error(
      `Failed to delete avatar object from R2 (key=${removedKey}):`,
      err,
    );
  }

  return user;
};

const AuthService = {
  register,
  login,
  getMe,
  changePassword,
  updateProfile,
  updateAvatar,
  deleteAvatar,
};

export default AuthService;
