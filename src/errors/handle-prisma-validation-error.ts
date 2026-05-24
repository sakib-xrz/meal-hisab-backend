import httpStatus from 'http-status';
import { TGenericErrorResponse } from '../interfaces/error';
import { Prisma } from '@prisma/client';
import { PrismaClientValidationError } from '@prisma/client/runtime/library';

/**
 * Extracts field names from Prisma validation error messages
 */
const extractFieldFromMessage = (message: string): string => {
  // Common patterns in Prisma validation errors
  const patterns = [
    /Argument `(\w+)`/i, // Argument `fieldName`
    /Unknown argument `(\w+)`/i, // Unknown argument `fieldName`
    /Invalid value for argument `(\w+)`/i, // Invalid value for argument `fieldName`
    /Field `(\w+)`/i, // Field `fieldName`
    /model `(\w+)`/i, // model `ModelName`
    /relation `(\w+)`/i, // relation `RelationName`
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return '';
};

/**
 * Parses Prisma validation error to extract actionable information
 */
const parseValidationError = (
  message: string,
): { field: string; issue: string } => {
  const field = extractFieldFromMessage(message);

  // Identify common validation issues
  let issue = message;

  if (message.includes('Unknown argument')) {
    issue = 'An unknown or invalid argument was provided.';
  } else if (message.includes('Invalid value')) {
    issue = 'The provided value is invalid for this field.';
  } else if (message.includes('Missing required argument')) {
    issue = 'A required argument is missing.';
  } else if (message.includes('Type mismatch')) {
    issue = 'The value type does not match the expected type.';
  } else if (message.includes('Cannot find')) {
    issue = 'The specified resource cannot be found.';
  } else if (message.includes('Invalid enum value')) {
    issue = 'The provided value is not a valid option for this field.';
  } else if (message.includes('Expected')) {
    // Extract expected value from message
    const expectedMatch = message.match(/Expected (\w+), provided (\w+)/i);
    if (expectedMatch) {
      issue = `Expected ${expectedMatch[1]}, but received ${expectedMatch[2]}.`;
    }
  }

  // Truncate very long messages but preserve important info
  if (issue.length > 200) {
    issue = issue.substring(0, 197) + '...';
  }

  return { field, issue };
};

const handlePrismaValidationError = (
  err: PrismaClientValidationError,
): TGenericErrorResponse => {
  const statusCode = httpStatus.BAD_REQUEST as number;
  const { field, issue } = parseValidationError(err.message);

  // If we extracted a field, provide more specific error
  if (field) {
    return {
      statusCode,
      message: 'Validation Error',
      errorSources: [
        {
          path: field,
          message: issue || err.message.substring(0, 200),
        },
      ],
    };
  }

  // Fallback to generic error with truncated message
  return {
    statusCode,
    message: 'Validation Error',
    errorSources: [
      {
        path: '',
        message:
          issue ||
          err.message.substring(0, 200) +
            (err.message.length > 200 ? '...' : ''),
      },
    ],
  };
};

export default handlePrismaValidationError;
