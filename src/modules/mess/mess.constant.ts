/**
 * Sensible defaults & limits for the Mess module.
 */
export const MESS_CONSTANTS = {
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 80,
  MAX_ADDRESS_LENGTH: 255,
} as const;

export const MESS_MEMBERSHIP_ERRORS = {
  SELF_CONFLICT:
    'You are already a member of another mess. Leave your current mess before joining or creating a new one.',
  TARGET_CONFLICT:
    'This user is already a member of another mess. They must leave their current mess before joining this one.',
  OWNER_CANNOT_LEAVE:
    'You cannot leave as the mess owner. Transfer ownership first.',
} as const;
