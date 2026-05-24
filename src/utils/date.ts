/**
 * Date helpers for `@db.Date` columns.
 *
 * All Prisma date-only columns (mealDate, bazaarDate, expenseDate, paymentDate)
 * use `@db.Date`, which stores only year-month-day. To keep that contract
 * unambiguous across timezones, every date that enters or leaves the API is
 * normalized to UTC midnight here.
 */

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns `true` if `value` matches `YYYY-MM-DD` and represents a real date.
 */
export const isDateOnlyString = (value: string): boolean => {
  if (!DATE_ONLY_REGEX.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
};

/**
 * Parses a `YYYY-MM-DD` string into a `Date` at UTC midnight.
 *
 * Throws if the string is not in the expected format or represents an
 * invalid calendar date (e.g. `2026-02-30`).
 */
export const parseDateOnly = (value: string): Date => {
  if (!isDateOnlyString(value)) {
    throw new Error('Invalid date — expected YYYY-MM-DD');
  }
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/**
 * Formats a `Date` (or ISO string) as `YYYY-MM-DD` using UTC components.
 */
export const formatDateOnly = (value: Date | string): string => {
  const d = value instanceof Date ? value : new Date(value);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Returns `[from, to]` ensuring `from <= to`. Throws otherwise.
 */
export const ensureDateRange = (from: Date, to: Date): [Date, Date] => {
  if (from.getTime() > to.getTime()) {
    throw new Error('`from` must be on or before `to`');
  }
  return [from, to];
};
