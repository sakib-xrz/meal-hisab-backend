import httpStatus from 'http-status';
import { MemberStatus, Prisma } from '@prisma/client';

import AppError from '@/errors/app-error';
import prisma from '@/lib/prisma';
import {
  assertMessAccess,
  assertMessManagerOrAbove,
  MessAccessContext,
} from '@/modules/mess/mess.utils';
import { MESS_ROLE_KEYS } from '@/modules/mess/mess-role.constant';
import {
  formatDateOnly,
  parseDateOnly,
} from '@/utils/date';
import { roundToScale, sumDecimals } from '@/utils/decimal';
import { assertTenantScope } from '@/utils/request-context';

import { MEAL_CONSTANTS } from './meal.constant';
import {
  DailyMealsQuery,
  MealsRangeQuery,
  MealsSummaryQuery,
  UpdateMealEntryInput,
  UpsertDailyMealsInput,
} from './meal.validation';

type MealCounts = {
  breakfast: number;
  lunch: number;
  dinner: number;
  total: number;
};

type DailyMemberRow = {
  memberId: string;
  fullName: string;
  roomNo: string | null;
  mealEntryId: string | null;
  breakfast: number;
  lunch: number;
  dinner: number;
  total: number;
  note: string | null;
};

type MealEntryRecord = {
  id: string;
  memberId: string;
  mealDate: Date;
  breakfast: Prisma.Decimal;
  lunch: Prisma.Decimal;
  dinner: Prisma.Decimal;
  note: string | null;
  member: {
    fullName: string;
    roomNo: string | null;
  };
};

const mealEntrySelect = {
  id: true,
  memberId: true,
  mealDate: true,
  breakfast: true,
  lunch: true,
  dinner: true,
  note: true,
  member: {
    select: {
      fullName: true,
      roomNo: true,
    },
  },
} satisfies Prisma.MealEntrySelect;

const isManagerOrAbove = (access: MessAccessContext): boolean =>
  access.isSuperAdmin ||
  access.roleKey === MESS_ROLE_KEYS.OWNER ||
  access.roleKey === MESS_ROLE_KEYS.MANAGER;

const toMealCounts = (entry: {
  breakfast: Prisma.Decimal | number;
  lunch: Prisma.Decimal | number;
  dinner: Prisma.Decimal | number;
}): MealCounts => {
  const breakfast = roundToScale(Number(entry.breakfast), MEAL_CONSTANTS.MEAL_COUNT_SCALE);
  const lunch = roundToScale(Number(entry.lunch), MEAL_CONSTANTS.MEAL_COUNT_SCALE);
  const dinner = roundToScale(Number(entry.dinner), MEAL_CONSTANTS.MEAL_COUNT_SCALE);

  return {
    breakfast,
    lunch,
    dinner,
    total: sumDecimals([breakfast, lunch, dinner], MEAL_CONSTANTS.MEAL_COUNT_SCALE),
  };
};

const isEmptyMealEntry = (
  breakfast: number,
  lunch: number,
  dinner: number,
  note?: string | null,
): boolean =>
  breakfast === 0 &&
  lunch === 0 &&
  dinner === 0 &&
  (!note || note.trim() === '');

const resolveLinkedMemberId = (access: MessAccessContext): string => {
  const memberId = access.messUser?.memberId;

  if (!memberId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Your account is not linked to a member profile in this mess',
    );
  }

  return memberId;
};

const resolveReadMemberScope = (
  access: MessAccessContext,
  requestedMemberId?: string,
): string | null => {
  if (isManagerOrAbove(access)) {
    return requestedMemberId ?? null;
  }

  const ownMemberId = resolveLinkedMemberId(access);

  if (requestedMemberId && requestedMemberId !== ownMemberId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You can only view your own meal records',
    );
  }

  return ownMemberId;
};

const buildDailySummary = (rows: DailyMemberRow[]) => {
  const totals = rows.reduce(
    (acc, row) => {
      acc.totalBreakfast += row.breakfast;
      acc.totalLunch += row.lunch;
      acc.totalDinner += row.dinner;
      acc.totalMeals += row.total;
      return acc;
    },
    {
      totalBreakfast: 0,
      totalLunch: 0,
      totalDinner: 0,
      totalMeals: 0,
    },
  );

  return {
    totalBreakfast: roundToScale(
      totals.totalBreakfast,
      MEAL_CONSTANTS.MEAL_COUNT_SCALE,
    ),
    totalLunch: roundToScale(totals.totalLunch, MEAL_CONSTANTS.MEAL_COUNT_SCALE),
    totalDinner: roundToScale(
      totals.totalDinner,
      MEAL_CONSTANTS.MEAL_COUNT_SCALE,
    ),
    totalMeals: roundToScale(totals.totalMeals, MEAL_CONSTANTS.MEAL_COUNT_SCALE),
  };
};

const formatMealEntry = (entry: MealEntryRecord) => {
  const counts = toMealCounts(entry);

  return {
    id: entry.id,
    memberId: entry.memberId,
    mealDate: formatDateOnly(entry.mealDate),
    breakfast: counts.breakfast,
    lunch: counts.lunch,
    dinner: counts.dinner,
    total: counts.total,
    note: entry.note,
    member: {
      fullName: entry.member.fullName,
      roomNo: entry.member.roomNo,
    },
  };
};

const assertActiveMembersInMess = async (
  messId: string,
  memberIds: string[],
): Promise<void> => {
  const uniqueMemberIds = [...new Set(memberIds)];

  const members = await prisma.member.findMany({
    where: {
      messId,
      id: { in: uniqueMemberIds },
      status: MemberStatus.ACTIVE,
    },
    select: { id: true },
  });

  if (members.length !== uniqueMemberIds.length) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Every memberId must belong to this mess and be ACTIVE',
    );
  }
};

/**
 * GET /messes/meals/daily
 */
const getDailyMeals = async (
  callerUserId: string,
  messId: string,
  query: DailyMealsQuery,
) => {
  const access = await assertMessAccess(messId, callerUserId);
  const mealDate = parseDateOnly(query.date ?? formatDateOnly(new Date()));
  const scopedMemberId = resolveReadMemberScope(access);

  const members = await prisma.member.findMany({
    where: {
      messId,
      status: MemberStatus.ACTIVE,
      ...(scopedMemberId ? { id: scopedMemberId } : {}),
    },
    select: {
      id: true,
      fullName: true,
      roomNo: true,
    },
    orderBy: { fullName: 'asc' },
  });

  const mealEntries = await prisma.mealEntry.findMany({
    where: {
      messId,
      mealDate,
      ...(scopedMemberId ? { memberId: scopedMemberId } : {}),
    },
    select: {
      id: true,
      memberId: true,
      breakfast: true,
      lunch: true,
      dinner: true,
      note: true,
    },
  });

  const entryByMemberId = new Map(mealEntries.map((entry) => [entry.memberId, entry]));

  const rows: DailyMemberRow[] = members.map((member) => {
    const entry = entryByMemberId.get(member.id);
    const counts = entry
      ? toMealCounts(entry)
      : { breakfast: 0, lunch: 0, dinner: 0, total: 0 };

    return {
      memberId: member.id,
      fullName: member.fullName,
      roomNo: member.roomNo,
      mealEntryId: entry?.id ?? null,
      breakfast: counts.breakfast,
      lunch: counts.lunch,
      dinner: counts.dinner,
      total: counts.total,
      note: entry?.note ?? null,
    };
  });

  return {
    date: formatDateOnly(mealDate),
    members: rows,
    summary: buildDailySummary(rows),
  };
};

/**
 * PUT /messes/meals/daily
 */
const upsertDailyMeals = async (
  callerUserId: string,
  messId: string,
  payload: UpsertDailyMealsInput,
) => {
  await assertMessManagerOrAbove(messId, callerUserId);

  const mealDate = parseDateOnly(payload.date);
  const memberIds = payload.entries.map((entry) => entry.memberId);

  if (memberIds.length !== new Set(memberIds).size) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Duplicate memberId values are not allowed in entries',
    );
  }

  await assertActiveMembersInMess(messId, memberIds);

  await prisma.$transaction(async (tx) => {
    for (const entry of payload.entries) {
      const breakfast = entry.breakfast ?? 0;
      const lunch = entry.lunch ?? 0;
      const dinner = entry.dinner ?? 0;
      const note = entry.note?.trim() ? entry.note.trim() : null;

      if (isEmptyMealEntry(breakfast, lunch, dinner, note)) {
        await tx.mealEntry.deleteMany({
          where: {
            messId,
            memberId: entry.memberId,
            mealDate,
          },
        });
        continue;
      }

      await tx.mealEntry.upsert({
        where: {
          messId_memberId_mealDate: {
            messId,
            memberId: entry.memberId,
            mealDate,
          },
        },
        create: {
          messId,
          memberId: entry.memberId,
          mealDate,
          breakfast,
          lunch,
          dinner,
          note,
        },
        update: {
          breakfast,
          lunch,
          dinner,
          note,
        },
      });
    }
  });

  return getDailyMeals(callerUserId, messId, { date: payload.date });
};

/**
 * GET /messes/meals
 */
const listMeals = async (
  callerUserId: string,
  messId: string,
  query: MealsRangeQuery,
) => {
  const access = await assertMessAccess(messId, callerUserId);
  const from = parseDateOnly(query.from);
  const to = parseDateOnly(query.to);

  const scopedMemberId = resolveReadMemberScope(access, query.memberId);

  const entries = await prisma.mealEntry.findMany({
    where: {
      messId,
      mealDate: { gte: from, lte: to },
      ...(scopedMemberId ? { memberId: scopedMemberId } : {}),
    },
    select: mealEntrySelect,
    orderBy: [{ mealDate: 'asc' }, { member: { fullName: 'asc' } }],
  });

  return {
    from: formatDateOnly(from),
    to: formatDateOnly(to),
    entries: entries.map(formatMealEntry),
  };
};

/**
 * GET /messes/meals/summary
 */
const getMealsSummary = async (
  callerUserId: string,
  messId: string,
  query: MealsSummaryQuery,
) => {
  const access = await assertMessAccess(messId, callerUserId);
  const from = parseDateOnly(query.from);
  const to = parseDateOnly(query.to);

  const scopedMemberId = resolveReadMemberScope(access);

  const where: Prisma.MealEntryWhereInput = {
    messId,
    mealDate: { gte: from, lte: to },
    ...(scopedMemberId ? { memberId: scopedMemberId } : {}),
  };

  const [aggregate, entries] = await prisma.$transaction([
    prisma.mealEntry.aggregate({
      where,
      _sum: { breakfast: true, lunch: true, dinner: true },
    }),
    prisma.mealEntry.findMany({
      where,
      select: {
        mealDate: true,
        breakfast: true,
        lunch: true,
        dinner: true,
        memberId: true,
        member: {
          select: { fullName: true },
        },
      },
      orderBy: [{ mealDate: 'asc' }, { member: { fullName: 'asc' } }],
    }),
  ]);

  const totalBreakfast = roundToScale(
    Number(aggregate._sum.breakfast ?? 0),
    MEAL_CONSTANTS.MEAL_COUNT_SCALE,
  );
  const totalLunch = roundToScale(
    Number(aggregate._sum.lunch ?? 0),
    MEAL_CONSTANTS.MEAL_COUNT_SCALE,
  );
  const totalDinner = roundToScale(
    Number(aggregate._sum.dinner ?? 0),
    MEAL_CONSTANTS.MEAL_COUNT_SCALE,
  );
  const totalMeals = sumDecimals(
    [totalBreakfast, totalLunch, totalDinner],
    MEAL_CONSTANTS.MEAL_COUNT_SCALE,
  );

  const byMemberMap = new Map<
    string,
    { memberId: string; fullName: string; totalMeals: number }
  >();
  const byDateMap = new Map<string, number>();

  for (const entry of entries) {
    const rowTotal = sumDecimals(
      [Number(entry.breakfast), Number(entry.lunch), Number(entry.dinner)],
      MEAL_CONSTANTS.MEAL_COUNT_SCALE,
    );
    const dateKey = formatDateOnly(entry.mealDate);

    byDateMap.set(dateKey, roundToScale((byDateMap.get(dateKey) ?? 0) + rowTotal, MEAL_CONSTANTS.MEAL_COUNT_SCALE));

    const existing = byMemberMap.get(entry.memberId);
    if (existing) {
      existing.totalMeals = roundToScale(
        existing.totalMeals + rowTotal,
        MEAL_CONSTANTS.MEAL_COUNT_SCALE,
      );
    } else {
      byMemberMap.set(entry.memberId, {
        memberId: entry.memberId,
        fullName: entry.member.fullName,
        totalMeals: rowTotal,
      });
    }
  }

  return {
    from: formatDateOnly(from),
    to: formatDateOnly(to),
    totalBreakfast,
    totalLunch,
    totalDinner,
    totalMeals,
    byMember: [...byMemberMap.values()].sort((a, b) =>
      a.fullName.localeCompare(b.fullName),
    ),
    byDate: [...byDateMap.entries()]
      .map(([date, dateTotalMeals]) => ({ date, totalMeals: dateTotalMeals }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
};

/**
 * PATCH /messes/meals/:mealEntryId
 */
const updateMealEntry = async (
  callerUserId: string,
  messId: string,
  mealEntryId: string,
  payload: UpdateMealEntryInput,
) => {
  await assertMessManagerOrAbove(messId, callerUserId);

  const existing = await prisma.mealEntry.findUnique({
    where: { id: mealEntryId },
    select: {
      id: true,
      messId: true,
      memberId: true,
      mealDate: true,
      breakfast: true,
      lunch: true,
      dinner: true,
      note: true,
    },
  });

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, 'Meal entry not found');
  }

  assertTenantScope(existing.messId, messId, 'Meal entry');

  const breakfast =
    payload.breakfast !== undefined
      ? payload.breakfast
      : roundToScale(Number(existing.breakfast), MEAL_CONSTANTS.MEAL_COUNT_SCALE);
  const lunch =
    payload.lunch !== undefined
      ? payload.lunch
      : roundToScale(Number(existing.lunch), MEAL_CONSTANTS.MEAL_COUNT_SCALE);
  const dinner =
    payload.dinner !== undefined
      ? payload.dinner
      : roundToScale(Number(existing.dinner), MEAL_CONSTANTS.MEAL_COUNT_SCALE);
  const note =
    payload.note !== undefined
      ? payload.note?.trim()
        ? payload.note.trim()
        : null
      : existing.note;

  if (isEmptyMealEntry(breakfast, lunch, dinner, note)) {
    await prisma.mealEntry.delete({ where: { id: mealEntryId } });

    return {
      id: mealEntryId,
      memberId: existing.memberId,
      mealDate: formatDateOnly(existing.mealDate),
      deleted: true,
    };
  }

  const updated = await prisma.mealEntry.update({
    where: { id: mealEntryId },
    data: {
      ...(payload.breakfast !== undefined ? { breakfast } : {}),
      ...(payload.lunch !== undefined ? { lunch } : {}),
      ...(payload.dinner !== undefined ? { dinner } : {}),
      ...(payload.note !== undefined ? { note } : {}),
    },
    select: mealEntrySelect,
  });

  return formatMealEntry(updated);
};

/**
 * DELETE /messes/meals/:mealEntryId
 */
const deleteMealEntry = async (
  callerUserId: string,
  messId: string,
  mealEntryId: string,
) => {
  await assertMessManagerOrAbove(messId, callerUserId);

  const existing = await prisma.mealEntry.findUnique({
    where: { id: mealEntryId },
    select: {
      id: true,
      messId: true,
      memberId: true,
      mealDate: true,
    },
  });

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, 'Meal entry not found');
  }

  assertTenantScope(existing.messId, messId, 'Meal entry');

  await prisma.mealEntry.delete({ where: { id: mealEntryId } });

  return {
    id: existing.id,
    memberId: existing.memberId,
    mealDate: formatDateOnly(existing.mealDate),
    deleted: true,
  };
};

const MealService = {
  getDailyMeals,
  upsertDailyMeals,
  listMeals,
  getMealsSummary,
  updateMealEntry,
  deleteMealEntry,
};

export default MealService;
