import { Request, Response } from 'express';
import httpStatus from 'http-status';

import catchAsync from '@/utils/catch-async';
import sendResponse from '@/utils/send-response';
import AppError from '@/errors/app-error';

import AuthService from './auth.services';

/**
 * POST /auth/register
 */
const register = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.register(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Account created successfully',
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

/**
 * POST /auth/login
 */
const login = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.login(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Login successful',
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

/**
 * POST /auth/logout
 *
 * With pure-JWT access tokens, logout is a client-side concern (drop the
 * token). We expose the endpoint for parity and clear any auth cookie
 * we might be using on the client.
 */
const logout = catchAsync(async (_req: Request, res: Response) => {
  res.clearCookie('accessToken');

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Logged out successfully',
    data: null,
  });
});

/**
 * GET /auth/me
 */
const getMe = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const user = await AuthService.getMe(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User profile fetched successfully',
    data: user,
  });
});

/**
 * PATCH /auth/change-password
 */
const changePassword = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const result = await AuthService.changePassword(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password changed successfully',
    data: result,
  });
});

/**
 * PATCH /auth/profile
 */
const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const user = await AuthService.updateProfile(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Profile updated successfully',
    data: user,
  });
});

/**
 * PATCH /auth/avatar
 *
 * Multipart upload — expects field `avatar`.
 */
const updateAvatar = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const user = await AuthService.updateAvatar(userId, req.file);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Avatar updated successfully',
    data: user,
  });
});

/**
 * DELETE /auth/avatar
 */
const deleteAvatar = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const user = await AuthService.deleteAvatar(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Avatar removed successfully',
    data: user,
  });
});

const AuthController = {
  register,
  login,
  logout,
  getMe,
  changePassword,
  updateProfile,
  updateAvatar,
  deleteAvatar,
};

export default AuthController;
