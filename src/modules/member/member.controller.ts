import { Request, Response } from 'express';
import httpStatus from 'http-status';

import catchAsync from '@/utils/catch-async';
import { requireMessId, requireUserId } from '@/utils/request-context';
import sendResponse from '@/utils/send-response';

import MemberService from './member.services';

const create = catchAsync(async (req: Request, res: Response) => {
  const member = await MemberService.createMember(
    requireUserId(req),
    requireMessId(req),
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Member added successfully',
    data: member,
  });
});

const list = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await MemberService.listMembers(
    requireUserId(req),
    requireMessId(req),
    req.query as never,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Members fetched successfully',
    meta,
    data,
  });
});

const update = catchAsync(async (req: Request, res: Response) => {
  const member = await MemberService.updateMember(
    requireUserId(req),
    requireMessId(req),
    req.params.memberId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Member updated successfully',
    data: member,
  });
});

const remove = catchAsync(async (req: Request, res: Response) => {
  const member = await MemberService.removeMember(
    requireUserId(req),
    requireMessId(req),
    req.params.memberId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Member removed from mess',
    data: member,
  });
});

const MemberController = {
  create,
  list,
  update,
  remove,
};

export default MemberController;
