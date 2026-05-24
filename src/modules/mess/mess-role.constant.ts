/**
 * Tenant-scoped role keys. Each mess seeds these on creation.
 */
export const MESS_ROLE_KEYS = {
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  MEMBER: 'MEMBER',
} as const;

export type MessRoleKey =
  (typeof MESS_ROLE_KEYS)[keyof typeof MESS_ROLE_KEYS];

export type MessPermissions = Record<string, string[]>;

export const DEFAULT_MESS_PERMISSIONS: Record<MessRoleKey, MessPermissions> = {
  OWNER: {
    members: ['create', 'read', 'update', 'delete'],
    meals: ['create', 'read', 'update', 'delete'],
    bazaars: ['create', 'read', 'update', 'delete'],
    payments: ['create', 'read', 'update', 'delete'],
    expenses: ['create', 'read', 'update', 'delete'],
    reports: ['read'],
    settings: ['read', 'update'],
    roles: ['read', 'update'],
  },
  MANAGER: {
    members: ['create', 'read', 'update'],
    meals: ['create', 'read', 'update', 'delete'],
    bazaars: ['create', 'read', 'update', 'delete'],
    payments: ['create', 'read', 'update'],
    expenses: ['create', 'read', 'update', 'delete'],
    reports: ['read'],
    settings: ['read'],
    roles: [],
  },
  MEMBER: {
    members: ['read'],
    meals: ['read'],
    bazaars: ['read'],
    payments: ['read'],
    expenses: ['read'],
    reports: ['read'],
    settings: [],
    roles: [],
  },
};

export const DEFAULT_MESS_ROLES: Array<{
  key: MessRoleKey;
  name: string;
  description: string;
  isDefault: boolean;
  permissions: MessPermissions;
}> = [
  {
    key: MESS_ROLE_KEYS.OWNER,
    name: 'Owner',
    description: 'Full control over the mess',
    isDefault: false,
    permissions: DEFAULT_MESS_PERMISSIONS.OWNER,
  },
  {
    key: MESS_ROLE_KEYS.MANAGER,
    name: 'Manager',
    description: 'Day-to-day mess operations',
    isDefault: false,
    permissions: DEFAULT_MESS_PERMISSIONS.MANAGER,
  },
  {
    key: MESS_ROLE_KEYS.MEMBER,
    name: 'Member',
    description: 'Read-only access to mess data',
    isDefault: true,
    permissions: DEFAULT_MESS_PERMISSIONS.MEMBER,
  },
];
