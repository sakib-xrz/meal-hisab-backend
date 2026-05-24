import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';

import AppError from '@/errors/app-error';
import { resolveMessAccess } from '@/modules/mess/mess.utils';

export const MESS_ID_HEADER = 'x-messid';

const readHeaderMessId = (req: Request): string | undefined => {
  const raw = req.headers[MESS_ID_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim() || undefined;
};

/**
 * Tenant middleware for all mess-scoped routes.
 *
 * Per project rules, every tenant-level request must send `X-MessID`.
 */
const resolveTenant = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication is required');
    }

    const messId = readHeaderMessId(req);

    if (!messId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'X-MessID header is required for tenant-level requests',
      );
    }
    const access = await resolveMessAccess(messId, req.user.id);

    if (!access.mess.isActive && !access.isSuperAdmin) {
      throw new AppError(httpStatus.FORBIDDEN, 'This mess is inactive');
    }

    if (!access.isSuperAdmin && !access.messUser) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You do not have access to this mess',
      );
    }

    req.messId = messId;
    req.tenant = {
      messId,
      mess: access.mess,
      roleKey: access.roleKey,
      isOwner: access.isOwner,
      isSuperAdmin: access.isSuperAdmin,
      messUserId: access.messUser?.id ?? null,
      memberId: access.messUser?.memberId ?? null,
      role: access.messUser?.role ?? null,
      permissions:
        (access.messUser?.role.permissions as Record<string, string[]> | null) ??
        null,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export default resolveTenant;
