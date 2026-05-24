import httpStatus from 'http-status';
import { NextFunction, Request, Response } from 'express';

const notFound = (req: Request, res: Response, next: NextFunction) => {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: 'API Not Found!',
    errorMessages: [
      {
        path: req.originalUrl,
        message: `The requested API route ${req.originalUrl} was not found`,
      },
    ],
  });
  next();
};

export default notFound;
