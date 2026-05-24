import httpStatus from 'http-status';
import { ZodError } from 'zod';
import { TErrorSources, TGenericErrorResponse } from '../interfaces/error';

const handelZodError = (err: ZodError): TGenericErrorResponse => {
  const errorSources: TErrorSources = err.issues.map((issue) => {
    return {
      message: issue.message,
      path: issue?.path[issue.path.length - 1] as string,
    };
  });

  return {
    statusCode: httpStatus.BAD_REQUEST,
    message: 'Validation Error!',
    errorSources,
  };
};

export default handelZodError;
