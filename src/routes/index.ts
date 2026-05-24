import express from 'express';
import { AuthRoutes } from '../modules/auth/auth.routes';
import { MessRoutes } from '../modules/mess/mess.routes';

const router = express.Router();

type Route = { path: string; route: express.Router };

const routes: Route[] = [
  {
    path: '/auth',
    route: AuthRoutes,
  },
  {
    path: '/messes',
    route: MessRoutes,
  },
];

routes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
