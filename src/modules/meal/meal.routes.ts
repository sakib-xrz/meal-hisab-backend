import express from 'express';

import validateRequest from '@/middlewares/validate-request';

import MealController from './meal.controller';
import {
  dailyMealsQuerySchema,
  mealEntryIdParamsSchema,
  mealsRangeQuerySchema,
  mealsSummaryQuerySchema,
  updateMealEntrySchema,
  upsertDailyMealsSchema,
} from './meal.validation';

const router = express.Router({ mergeParams: true });

router.get(
  '/daily',
  validateRequest(dailyMealsQuerySchema),
  MealController.getDaily,
);
router.put(
  '/daily',
  validateRequest(upsertDailyMealsSchema),
  MealController.upsertDaily,
);
router.get(
  '/summary',
  validateRequest(mealsSummaryQuerySchema),
  MealController.summary,
);
router.get('/', validateRequest(mealsRangeQuerySchema), MealController.list);
router.patch(
  '/:mealEntryId',
  validateRequest(updateMealEntrySchema),
  MealController.update,
);
router.delete(
  '/:mealEntryId',
  validateRequest(mealEntryIdParamsSchema),
  MealController.remove,
);

export const MealRoutes = router;
