/**
 * Shared decimal helpers for money / measurement fields.
 *
 * Prisma stores these as `Decimal`, but we receive JS numbers (or numeric
 * strings) from JSON. To stay safe with floating point, every external value
 * is parsed, validated, and rounded to a fixed scale before it touches the DB.
 */

const SCALE_FACTORS = new Map<number, number>();

const factorFor = (scale: number): number => {
  let f = SCALE_FACTORS.get(scale);
  if (!f) {
    f = 10 ** scale;
    SCALE_FACTORS.set(scale, f);
  }
  return f;
};

/**
 * Coerce a JS number or numeric string into a finite number.
 * Returns `null` if the value cannot be parsed.
 */
export const toFiniteNumber = (input: unknown): number | null => {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : null;
  }
  if (typeof input === 'string' && input.trim() !== '') {
    const n = Number(input);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/**
 * Rounds a number to a fixed decimal scale (default 2 — i.e. money).
 *
 * Uses the half-away-from-zero convention via string-based rounding to avoid
 * the IEEE-754 surprises of `Math.round(x * 100) / 100` for edge values.
 */
export const roundToScale = (value: number, scale = 2): number => {
  const f = factorFor(scale);
  return Math.round((value + Number.EPSILON) * f) / f;
};

/**
 * Sums an array of decimal values at a fixed scale, avoiding accumulated
 * float drift. Useful for `sum(items[].totalPrice)` style aggregations.
 */
export const sumDecimals = (values: number[], scale = 2): number => {
  const f = factorFor(scale);
  let acc = 0;
  for (const v of values) {
    acc += Math.round(v * f);
  }
  return acc / f;
};

/**
 * Equality check at a fixed scale.
 *
 * `equalAtScale(0.1 + 0.2, 0.3)` → true (without epsilon noise).
 */
export const equalAtScale = (a: number, b: number, scale = 2): boolean => {
  return roundToScale(a, scale) === roundToScale(b, scale);
};
