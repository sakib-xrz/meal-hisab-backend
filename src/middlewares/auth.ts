import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';

import AppError from '@/errors/app-error';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/modules/auth/auth.utils';

/**
 * Authenticates the request via `Authorization: Bearer <token>` (or
 * `accessToken` cookie) and attaches `req.user`.
 *
 * Tenant roles are resolved separately by `tenant.middleware.ts` using
 * `X-MessID` + `MessUser`.
 */
const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice('Bearer '.length).trim();
    } else if (req.cookies?.accessToken) {
      token = String(req.cookies.accessToken);
    }

    if (!token) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        'Authentication token is required',
      );
    }

    let decoded: { id: string; phone: string };
    try {
      decoded = verifyAccessToken(token);
    } catch {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid or expired token');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        phone: true,
        isActive: true,
        isSuperAdmin: true,
      },
    });

    if (!user) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        'User not found or account has been deleted',
      );
    }

    if (!user.isActive) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        'Your account has been deactivated.',
      );
    }

    req.user = {
      id: user.id,
      name: user.name,
      phone: user.phone,
      isSuperAdmin: user.isSuperAdmin,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export default authenticate;
