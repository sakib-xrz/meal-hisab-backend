import { Request, Response } from 'express';
import httpStatus from 'http-status';

import catchAsync from '@/utils/catch-async';
import { requireMessId, requireUserId } from '@/utils/request-context';
import sendResponse from '@/utils/send-response';

import MessService from './mess.services';

const create = catchAsync(async (req: Request, res: Response) => {
  const mess = await MessService.createMess(requireUserId(req), req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Mess created successfully',
    data: mess,
  });
});

const getById = catchAsync(async (req: Request, res: Response) => {
  const mess = await MessService.getMess(
    requireUserId(req),
    requireMessId(req),
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Mess fetched successfully',
    data: mess,
  });
});

const update = catchAsync(async (req: Request, res: Response) => {
  const mess = await MessService.updateMess(
    requireUserId(req),
    requireMessId(req),
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Mess updated successfully',
    data: mess,
  });
});

const remove = catchAsync(async (req: Request, res: Response) => {
  const result = await MessService.deleteMess(
    requireUserId(req),
    requireMessId(req),
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Mess deleted successfully',
    data: result,
  });
});

const transferOwnership = catchAsync(async (req: Request, res: Response) => {
  const mess = await MessService.transferOwnership(
    requireUserId(req),
    requireMessId(req),
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Mess ownership transferred successfully',
    data: mess,
  });
});

const stats = catchAsync(async (req: Request, res: Response) => {
  const result = await MessService.getMessStats(
    requireUserId(req),
    requireMessId(req),
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Mess stats fetched successfully',
    data: result,
  });
});

const leave = catchAsync(async (req: Request, res: Response) => {
  const result = await MessService.leaveMess(
    requireUserId(req),
    requireMessId(req),
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'You have left the mess successfully',
    data: result,
  });
});

const MessController = {
  create,
  getById,
  update,
  remove,
  transferOwnership,
  stats,
  leave,
};

export default MessController;
