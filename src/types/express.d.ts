import 'express';

import { MessRoleKey } from '@/modules/mess/mess-role.constant';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        phone: string;
        isSuperAdmin: boolean;
      };
      messId?: string;
      tenant?: {
        messId: string;
        mess: {
          id: string;
          isActive: boolean;
        };
        roleKey: MessRoleKey | null;
        isOwner: boolean;
        isSuperAdmin: boolean;
        messUserId: string | null;
        memberId: string | null;
        role: {
          id: string;
          key: string;
          name: string;
          permissions: unknown;
        } | null;
        permissions: Record<string, string[]> | null;
      };
    }
  }
}

export {};
