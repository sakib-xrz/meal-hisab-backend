/**
 * Bangladeshi mobile phone regex.
 *
 * Accepts:
 *   - 01XXXXXXXXX        (11 digits, local)
 *   - +8801XXXXXXXXX     (E.164 with +)
 *   - 8801XXXXXXXXX      (E.164 without +)
 */
export const BD_PHONE_REGEX = /^(?:\+?88)?01[3-9]\d{8}$/;

/**
 * Normalize any accepted BD phone to canonical E.164: +8801XXXXXXXXX
 */
export const normalizeBdPhone = (rawPhone: string): string => {
  const cleaned = rawPhone.trim().replace(/[\s-]/g, '');

  if (cleaned.startsWith('+880')) {
    return cleaned;
  }

  if (cleaned.startsWith('880')) {
    return `+${cleaned}`;
  }

  if (cleaned.startsWith('01')) {
    return `+88${cleaned}`;
  }

  throw new Error('Invalid Bangladeshi phone number');
};
