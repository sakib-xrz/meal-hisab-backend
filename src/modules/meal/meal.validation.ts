import { z } from 'zod';

import { roundToScale, toFiniteNumber } from '@/utils/decimal';
import { isDateOnlyString } from '@/utils/date';

import { MEAL_CONSTANTS } from './meal.constant';

const memberIdField = z
  .string({ required_error: 'Member id is required' })
  .trim()
  .min(1, 'Member id is required');

const mealEntryIdParam = z
  .string({ required_error: 'Meal entry id is required' })
  .trim()
  .min(1, 'Meal entry id is required');

const dateOnlyField = z
  .string({ required_error: 'Date is required' })
  .trim()
  .refine((value) => isDateOnlyString(value), {
    message: 'Invalid date — expected YYYY-MM-DD',
  });

const optionalDateOnlyField = z
  .string()
  .trim()
  .optional()
  .refine((value) => value === undefined || isDateOnlyString(value), {
    message: 'Invalid date — expected YYYY-MM-DD',
  });

const mealCountField = z
  .union([z.number(), z.string()])
  .transform((value, ctx) => {
    const parsed = toFiniteNumber(value);

    if (parsed === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Meal count must be a valid number',
      });
      return z.NEVER;
    }

    if (parsed < 0 || parsed > MEAL_CONSTANTS.MAX_COUNT_PER_SLOT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Meal count must be between 0 and ${MEAL_CONSTANTS.MAX_COUNT_PER_SLOT}`,
      });
      return z.NEVER;
    }

    return roundToScale(parsed, MEAL_CONSTANTS.MEAL_COUNT_SCALE);
  });

const noteField = z
  .string()
  .trim()
  .max(MEAL_CONSTANTS.MAX_NOTE_LENGTH, 'Note is too long')
  .nullable()
  .optional();

const dailyEntryField = z.object({
  memberId: memberIdField,
  breakfast: mealCountField.optional().default(0),
  lunch: mealCountField.optional().default(0),
  dinner: mealCountField.optional().default(0),
  note: noteField,
});

export const dailyMealsQuerySchema = z.object({
  query: z.object({
    date: optionalDateOnlyField,
  }),
});

export const upsertDailyMealsSchema = z.object({
  body: z.object({
    date: dateOnlyField,
    entries: z
      .array(dailyEntryField)
      .min(1, 'At least one meal entry is required'),
  }),
});

export const mealsRangeQuerySchema = z.object({
  query: z
    .object({
      from: dateOnlyField,
      to: dateOnlyField,
      memberId: memberIdField.optional(),
    })
    .superRefine((data, ctx) => {
      if (data.from > data.to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '`from` must be on or before `to`',
          path: ['from'],
        });
      }
    }),
});

export const mealsSummaryQuerySchema = z.object({
  query: z
    .object({
      from: dateOnlyField,
      to: dateOnlyField,
    })
    .superRefine((data, ctx) => {
      if (data.from > data.to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '`from` must be on or before `to`',
          path: ['from'],
        });
      }
    }),
});

export const updateMealEntrySchema = z.object({
  params: z.object({ mealEntryId: mealEntryIdParam }),
  body: z
    .object({
      breakfast: mealCountField.optional(),
      lunch: mealCountField.optional(),
      dinner: mealCountField.optional(),
      note: noteField,
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});

export const mealEntryIdParamsSchema = z.object({
  params: z.object({ mealEntryId: mealEntryIdParam }),
});

export type DailyMealsQuery = z.infer<typeof dailyMealsQuerySchema>['query'];
export type UpsertDailyMealsInput = z.infer<
  typeof upsertDailyMealsSchema
>['body'];
export type MealsRangeQuery = z.infer<typeof mealsRangeQuerySchema>['query'];
export type MealsSummaryQuery = z.infer<typeof mealsSummaryQuerySchema>['query'];
export type UpdateMealEntryInput = z.infer<
  typeof updateMealEntrySchema
>['body'];
