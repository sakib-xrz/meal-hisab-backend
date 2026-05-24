import express from 'express';

import authenticate from '@/middlewares/auth';
import resolveTenant from '@/middlewares/tenant.middleware';
import validateRequest from '@/middlewares/validate-request';
import { MemberRoutes } from '@/modules/member/member.routes';

import MessController from './mess.controller';
import {
  createMessSchema,
  listMessesQuerySchema,
  transferOwnershipSchema,
  updateMessSchema,
} from './mess.validation';

const router = express.Router();

router.use(authenticate);

router.post('/', validateRequest(createMessSchema), MessController.create);

const tenantRouter = express.Router();
tenantRouter.use(resolveTenant);

tenantRouter.use('/members', MemberRoutes);

tenantRouter.get('/current', MessController.getById);
tenantRouter.patch(
  '/current',
  validateRequest(updateMessSchema),
  MessController.update,
);
tenantRouter.delete('/current', MessController.remove);
tenantRouter.patch(
  '/transfer-ownership',
  validateRequest(transferOwnershipSchema),
  MessController.transferOwnership,
);
tenantRouter.get('/stats', MessController.stats);
tenantRouter.post('/leave', MessController.leave);

router.use(tenantRouter);

export const MessRoutes = router;
