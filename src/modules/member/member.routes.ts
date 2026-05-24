import express from 'express';

import validateRequest from '@/middlewares/validate-request';

import MemberController from './member.controller';
import {
  createMemberSchema,
  listMembersQuerySchema,
  memberIdParamsSchema,
  updateMemberSchema,
} from './member.validation';

const router = express.Router({ mergeParams: true });

router.post('/', validateRequest(createMemberSchema), MemberController.create);
router.get('/', validateRequest(listMembersQuerySchema), MemberController.list);
router.patch(
  '/:memberId',
  validateRequest(updateMemberSchema),
  MemberController.update,
);
router.delete(
  '/:memberId',
  validateRequest(memberIdParamsSchema),
  MemberController.remove,
);

export const MemberRoutes = router;
