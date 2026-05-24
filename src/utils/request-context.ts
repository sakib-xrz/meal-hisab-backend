import { Request } from 'express';
import httpStatus from 'http-status';

import AppError from '@/errors/app-error';

export const requireUserId = (req: Request): string => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }
  return userId;
};

/**
 * Returns the tenant mess id resolved by `tenant.middleware.ts`.
 * Never falls back to URL params alone — tenant routes must pass middleware first.
 */
export const requireMessId = (req: Request): string => {
  const messId = req.messId;
  if (!messId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Tenant mess id is required (set X-MessID header)',
    );
  }
  return messId;
};

/**
 * Ensures a loaded record belongs to the current tenant.
 * Use after fetching by primary key to prevent cross-tenant data leakage.
 */
export const assertTenantScope = (
  recordMessId: string,
  tenantMessId: string,
  resourceLabel = 'Resource',
): void => {
  if (recordMessId !== tenantMessId) {
    throw new AppError(httpStatus.NOT_FOUND, `${resourceLabel} not found`);
  }
};

export const requireTenant = (req: Request) => {
  if (!req.tenant) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Tenant context is missing. Include a valid X-MessID header.',
    );
  }
  return req.tenant;
};
