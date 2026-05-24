/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-unused-vars */
import httpStatus from 'http-status';
import { ErrorRequestHandler, Request } from 'express';
import { ZodError } from 'zod';

import config from '@/config';
import AppError from '@/errors/app-error';
import handelZodError from '@/errors/handle-zod-error';
import handlePrismaError from '@/errors/handle-prisma-error';
import handlePrismaValidationError from '@/errors/handle-prisma-validation-error';
import { Prisma } from '@prisma/client';
import { ApiErrorResponse } from '@/interfaces/error';
import { logger } from '@/utils/logger';

const isProduction = config.nodeEnv === 'production';

/**
 * Sensitive fields to redact from logs
 */
const SENSITIVE_FIELDS = [
  'password',
  'confirmPassword',
  'currentPassword',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'creditCard',
  'cvv',
  'ssn',
];

/**
 * Sanitizes request body by redacting sensitive fields
 */
const sanitizeBody = (
  body: Record<string, unknown>,
): Record<string, unknown> => {
  const sanitized = { ...body };

  for (const field of SENSITIVE_FIELDS) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
};

/**
 * Logs error with appropriate level based on status code
 */
const logError = (
  exception: unknown,
  request: Request,
  statusCode: number,
): void => {
  const errorLog = {
    statusCode,
    path: request.url,
    method: request.method,
    timestamp: new Date().toISOString(),
    ...(request.body &&
      Object.keys(request.body).length > 0 && {
        body: sanitizeBody(request.body),
      }),
  };

  if (statusCode >= 500) {
    logger.error(
      `${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
      JSON.stringify(errorLog),
    );
  } else if (statusCode >= 400) {
    logger.warn(
      `${request.method} ${request.url} - ${statusCode}`,
      JSON.stringify(errorLog),
    );
  }
};

/**
 * Handles JWT-related errors
 */
const handleJwtError = (
  err: Error,
): { statusCode: number; message: string } | null => {
  switch (err.name) {
    case 'JsonWebTokenError':
      return {
        statusCode: httpStatus.UNAUTHORIZED,
        message: 'Invalid token',
      };
    case 'TokenExpiredError':
      return {
        statusCode: httpStatus.UNAUTHORIZED,
        message: 'Token has expired',
      };
    case 'NotBeforeError':
      return {
        statusCode: httpStatus.UNAUTHORIZED,
        message: 'Token not active yet',
      };
    default:
      return null;
  }
};

/**
 * Converts error sources array to errors format
 */
const convertToErrors = (
  errorSources: { path: string | number; message: string }[],
): string[] => {
  return errorSources.map((source) => {
    if (source.path) {
      return `${source.path}: ${source.message}`;
    }
    return source.message;
  });
};

const globalErrorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Default values
  let statusCode = httpStatus.INTERNAL_SERVER_ERROR as number;
  let message = isProduction ? 'An unexpected error occurred' : 'Unknown error';
  let errors: string[] | undefined;

  // 1. Zod Validation Errors
  if (err instanceof ZodError) {
    const simplifiedError = handelZodError(err);
    statusCode = simplifiedError.statusCode;
    message =
      simplifiedError.errorSources[0]?.message.charAt(0).toUpperCase() +
        simplifiedError.errorSources[0]?.message.slice(1) ||
      'Validation failed';
    errors = convertToErrors(simplifiedError.errorSources);
  }
  // 2. Prisma Known Request Errors
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const simplifiedError = handlePrismaError(err);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
    errors = convertToErrors(simplifiedError.errorSources);
  }
  // 3. Prisma Validation Errors (Type mismatches)
  else if (err instanceof Prisma.PrismaClientValidationError) {
    const simplifiedError = handlePrismaValidationError(err);
    statusCode = simplifiedError.statusCode;
    message = isProduction ? 'Invalid data provided' : simplifiedError.message;
    errors = convertToErrors(simplifiedError.errorSources);
  }
  // 4. Prisma Initialization Errors (Connection issues)
  else if (err instanceof Prisma.PrismaClientInitializationError) {
    statusCode = httpStatus.SERVICE_UNAVAILABLE;
    message = 'Database connection failed. Please try again later.';
  }
  // 5. Prisma Rust Panic Errors (Critical database errors)
  else if (err instanceof Prisma.PrismaClientRustPanicError) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = isProduction
      ? 'A critical database error occurred. Please contact support.'
      : 'Database error occurred';
  }
  // 6. JSON Syntax Errors (Malformed request body)
  else if (err instanceof SyntaxError && 'body' in err) {
    statusCode = httpStatus.BAD_REQUEST;
    message = 'Invalid JSON payload';
  }
  // 7. Custom App Errors
  else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message || message;
    if (err.errors) {
      errors = Array.isArray(err.errors)
        ? err.errors
        : Object.entries(err.errors).flatMap(([key, msgs]) =>
            msgs.map((msg) => `${key}: ${msg}`),
          );
    }
  }
  // 8. JWT and Generic Errors
  else if (err instanceof Error) {
    const jwtError = handleJwtError(err);
    if (jwtError) {
      statusCode = jwtError.statusCode;
      message = jwtError.message;
    } else if (err.name === 'SyntaxError') {
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Invalid JSON payload';
    } else if (err.name === 'TypeError') {
      statusCode = httpStatus.INTERNAL_SERVER_ERROR;
      message = isProduction ? 'An unexpected error occurred' : err.message;
    } else {
      message = isProduction ? 'An unexpected error occurred' : err.message;
    }
  }

  // Log the error for debugging
  logError(err, req, statusCode);
  console.log('error stack', err.stack);

  // Build response matching NestJS ApiErrorResponse pattern
  const errorResponse: ApiErrorResponse = {
    success: false,
    statusCode,
    message,
    ...(errors && errors.length > 0 && { errors }),
    // Include path and stack trace only in development
    ...(!isProduction &&
      err instanceof Error && {
        path: req.url,
        stack: err.stack,
      }),
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(errorResponse);
};

export default globalErrorHandler;
