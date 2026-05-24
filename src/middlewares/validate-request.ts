import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';

const validateRequest =
  (schema: ZodType<any>) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        cookies: req.cookies,
      });
      // Only req.body is writable; req.query and req.params are read-only in Express
      if (parsed.body !== undefined) req.body = parsed.body;
      return next();
    } catch (error) {
      next(error);
    }
  };

export default validateRequest;
