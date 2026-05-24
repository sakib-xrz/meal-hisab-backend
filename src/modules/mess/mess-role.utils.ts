import { Prisma } from '@prisma/client';

import prisma from '@/lib/prisma';

import {
  DEFAULT_MESS_ROLES,
  MessRoleKey,
} from './mess-role.constant';

/**
 * Seeds the three system roles for a newly created mess.
 * Returns a map of role key → role id for convenient lookups.
 */
export const seedDefaultMessRoles = async (
  tx: Prisma.TransactionClient,
  messId: string,
): Promise<Map<MessRoleKey, string>> => {
  const roleMap = new Map<MessRoleKey, string>();

  for (const role of DEFAULT_MESS_ROLES) {
    const created = await tx.messRole.create({
      data: {
        messId,
        key: role.key,
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        isDefault: role.isDefault,
        isSystem: true,
      },
      select: { id: true, key: true },
    });

    roleMap.set(created.key as MessRoleKey, created.id);
  }

  return roleMap;
};

export const getMessRoleIdByKey = async (
  messId: string,
  key: MessRoleKey,
): Promise<string> => {
  const role = await prisma.messRole.findUnique({
    where: { messId_key: { messId, key } },
    select: { id: true },
  });

  if (!role) {
    throw new Error(`Role ${key} not found for mess ${messId}`);
  }

  return role.id;
};
