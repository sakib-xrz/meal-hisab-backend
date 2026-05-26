import { Request, Response } from 'express';
import httpStatus from 'http-status';

import catchAsync from '@/utils/catch-async';
import { requireMessId, requireUserId } from '@/utils/request-context';
import sendResponse from '@/utils/send-response';

import MealService from './meal.services';

const getDaily = catchAsync(async (req: Request, res: Response) => {
  const data = await MealService.getDailyMeals(
    requireUserId(req),
    requireMessId(req),
    req.query as never,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Daily meal sheet fetched successfully',
    data,
  });
});

const upsertDaily = catchAsync(async (req: Request, res: Response) => {
  const data = await MealService.upsertDailyMeals(
    requireUserId(req),
    requireMessId(req),
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Daily meal sheet saved successfully',
    data,
  });
});

const list = catchAsync(async (req: Request, res: Response) => {
  const data = await MealService.listMeals(
    requireUserId(req),
    requireMessId(req),
    req.query as never,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Meal entries fetched successfully',
    data,
  });
});

const summary = catchAsync(async (req: Request, res: Response) => {
  const data = await MealService.getMealsSummary(
    requireUserId(req),
    requireMessId(req),
    req.query as never,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Meal summary fetched successfully',
    data,
  });
});

const update = catchAsync(async (req: Request, res: Response) => {
  const data = await MealService.updateMealEntry(
    requireUserId(req),
    requireMessId(req),
    req.params.mealEntryId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Meal entry updated successfully',
    data,
  });
});

const remove = catchAsync(async (req: Request, res: Response) => {
  const data = await MealService.deleteMealEntry(
    requireUserId(req),
    requireMessId(req),
    req.params.mealEntryId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Meal entry deleted successfully',
    data,
  });
});

const MealController = {
  getDaily,
  upsertDaily,
  list,
  summary,
  update,
  remove,
};

export default MealController;
