import httpStatus from 'http-status';
import { TGenericErrorResponse } from '../interfaces/error';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

/**
 * Extracts field name from Prisma error target
 */
const extractFieldName = (target: unknown): string => {
  if (Array.isArray(target)) {
    // For composite unique constraints, return the last field or join them
    return target.length > 1
      ? `${target.slice(0, -1).join('.')}.${target[target.length - 1]}`
      : (target[target.length - 1] as string);
  }
  if (typeof target === 'string') {
    return target;
  }
  return 'unknown_field';
};

/**
 * Formats field name for user-friendly display
 */
const formatFieldName = (field: string): string => {
  // Convert snake_case to Title Case
  return field
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const handlePrismaError = (
  err: PrismaClientKnownRequestError,
): TGenericErrorResponse => {
  let statusCode = httpStatus.BAD_REQUEST as number;
  let message = 'Database Error';
  let errorSources = [
    {
      path: '',
      message: err.message,
    },
  ];

  switch (err.code) {
    case 'P2000': // Value too long for column
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Input value is too long';
      const fieldName2000 = (err.meta?.target as string) || 'field';
      errorSources = [
        {
          path: fieldName2000,
          message: `The value provided for ${formatFieldName(fieldName2000)} is too long.`,
        },
      ];
      break;

    case 'P2001': // Record does not exist (deprecated, use P2025)
      statusCode = httpStatus.NOT_FOUND;
      message = 'Record not found';
      errorSources = [
        {
          path: '',
          message: 'The requested record was not found in the database.',
        },
      ];
      break;

    case 'P2002': // Unique constraint violation
      statusCode = httpStatus.CONFLICT;
      message = 'Duplicate entry';
      const target = err.meta?.target;
      const field = extractFieldName(target);
      const formattedField = formatFieldName(field);

      errorSources = [
        {
          path: field,
          message: `${formattedField} already exists. Please use a different value.`,
        },
      ];
      break;

    case 'P2003': // Foreign key constraint violation
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Referential integrity violation';
      const fieldName2003 = (err.meta?.field_name as string) || 'field';
      errorSources = [
        {
          path: fieldName2003,
          message: `This ${formatFieldName(fieldName2003)} is linked to another record and cannot be modified or deleted.`,
        },
      ];
      break;

    case 'P2004': // Constraint violation on database
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Database constraint violation';
      errorSources = [
        {
          path: '',
          message: 'The operation violates a database constraint.',
        },
      ];
      break;

    case 'P2005': // Value out of range for column
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Value out of range';
      const fieldName2005 = (err.meta?.target as string) || 'field';
      errorSources = [
        {
          path: fieldName2005,
          message: `The value provided for ${formatFieldName(fieldName2005)} is out of the allowed range.`,
        },
      ];
      break;

    case 'P2006': // Invalid value for field type
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Invalid value type';
      const fieldName2006 = (err.meta?.target as string) || 'field';
      errorSources = [
        {
          path: fieldName2006,
          message: `The value provided for ${formatFieldName(fieldName2006)} has an invalid type.`,
        },
      ];
      break;

    case 'P2007': // Data validation error
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Data validation error';
      errorSources = [
        {
          path: '',
          message: err.message || 'The provided data failed validation.',
        },
      ];
      break;

    case 'P2008': // Query parsing error
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Invalid query';
      errorSources = [
        {
          path: '',
          message: 'The database query is invalid or malformed.',
        },
      ];
      break;

    case 'P2009': // Query validation error
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Query validation error';
      errorSources = [
        {
          path: '',
          message: 'The database query failed validation.',
        },
      ];
      break;

    case 'P2010': // Raw query error
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Raw query error';
      errorSources = [
        {
          path: '',
          message: 'An error occurred while executing a raw database query.',
        },
      ];
      break;

    case 'P2011': // Null constraint violation
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Required field missing';
      const fieldName2011 = (err.meta?.target as string) || 'field';
      errorSources = [
        {
          path: fieldName2011,
          message: `${formatFieldName(fieldName2011)} is required and cannot be empty.`,
        },
      ];
      break;

    case 'P2012': // Missing required value
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Missing required value';
      const fieldName2012 = (err.meta?.path as string) || 'field';
      errorSources = [
        {
          path: fieldName2012,
          message: `A required value is missing for ${formatFieldName(fieldName2012)}.`,
        },
      ];
      break;

    case 'P2013': // Missing required argument
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Missing required argument';
      const argumentName = (err.meta?.argument_name as string) || 'argument';
      errorSources = [
        {
          path: '',
          message: `Required argument '${argumentName}' is missing.`,
        },
      ];
      break;

    case 'P2014': // Relation violation
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Relation violation';
      const relationName = (err.meta?.relation_name as string) || 'relation';
      errorSources = [
        {
          path: relationName,
          message: `The change you are trying to make violates a required relation: ${relationName}.`,
        },
      ];
      break;

    case 'P2015': // Related record not found
      statusCode = httpStatus.NOT_FOUND;
      message = 'Related record not found';
      const relatedModel = (err.meta?.model_name as string) || 'record';
      errorSources = [
        {
          path: '',
          message: `The related ${relatedModel} record was not found.`,
        },
      ];
      break;

    case 'P2016': // Query interpretation error
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Query interpretation error';
      errorSources = [
        {
          path: '',
          message: 'The database query could not be interpreted correctly.',
        },
      ];
      break;

    case 'P2017': // Records for relation not connected
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Records not connected';
      const relationName2017 =
        (err.meta?.relation_name as string) || 'relation';
      errorSources = [
        {
          path: relationName2017,
          message: `The records for relation '${relationName2017}' are not properly connected.`,
        },
      ];
      break;

    case 'P2018': // Required connected records not found
      statusCode = httpStatus.NOT_FOUND;
      message = 'Required connected records not found';
      errorSources = [
        {
          path: '',
          message: 'Required connected records were not found.',
        },
      ];
      break;

    case 'P2019': // Input error
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Input error';
      errorSources = [
        {
          path: '',
          message: err.message || 'The provided input is invalid.',
        },
      ];
      break;

    case 'P2020': // Value out of range
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Value out of range';
      errorSources = [
        {
          path: '',
          message: 'The provided value is out of the allowed range.',
        },
      ];
      break;

    case 'P2021': // Table does not exist
      statusCode = httpStatus.INTERNAL_SERVER_ERROR;
      message = 'Database table not found';
      const tableName = (err.meta?.table as string) || 'table';
      errorSources = [
        {
          path: '',
          message: `The database table '${tableName}' does not exist.`,
        },
      ];
      break;

    case 'P2022': // Column does not exist
      statusCode = httpStatus.INTERNAL_SERVER_ERROR;
      message = 'Database column not found';
      const columnName = (err.meta?.column as string) || 'column';
      errorSources = [
        {
          path: columnName,
          message: `The database column '${columnName}' does not exist.`,
        },
      ];
      break;

    case 'P2023': // Inconsistent column data
      statusCode = httpStatus.INTERNAL_SERVER_ERROR;
      message = 'Inconsistent column data';
      errorSources = [
        {
          path: '',
          message: 'The database contains inconsistent column data.',
        },
      ];
      break;

    case 'P2024': // Connection timeout
      statusCode = httpStatus.REQUEST_TIMEOUT;
      message = 'Database connection timeout';
      errorSources = [
        {
          path: '',
          message: 'The database connection timed out. Please try again.',
        },
      ];
      break;

    case 'P2025': // Record not found
      statusCode = httpStatus.NOT_FOUND;
      message = 'Record not found';
      const modelName = (err.meta?.model_name as string) || 'record';
      const cause = (err.meta?.cause as string) || '';
      errorSources = [
        {
          path: '',
          message: `The requested ${modelName} was not found.${cause ? ` ${cause}` : ''}`,
        },
      ];
      break;

    case 'P2026': // Unsupported feature
      statusCode = httpStatus.NOT_IMPLEMENTED;
      message = 'Unsupported database feature';
      errorSources = [
        {
          path: '',
          message: 'The requested database feature is not supported.',
        },
      ];
      break;

    case 'P2027': // Multiple errors
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Multiple database errors';
      const errors = (err.meta?.errors as Array<{ message: string }>) || [];
      errorSources = errors.map((error) => ({
        path: '',
        message: error.message,
      }));
      break;

    case 'P2028': // Transaction API error
      statusCode = httpStatus.INTERNAL_SERVER_ERROR;
      message = 'Transaction error';
      errorSources = [
        {
          path: '',
          message: 'An error occurred during a database transaction.',
        },
      ];
      break;

    case 'P2030': // Fulltext index not found
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Fulltext index not found';
      errorSources = [
        {
          path: '',
          message: 'The requested fulltext index was not found.',
        },
      ];
      break;

    case 'P2031': // Unique constraint failed on update
      statusCode = httpStatus.CONFLICT;
      message = 'Unique constraint violation on update';
      const target2031 = err.meta?.target;
      const field2031 = extractFieldName(target2031);
      errorSources = [
        {
          path: field2031,
          message: `Cannot update: ${formatFieldName(field2031)} already exists.`,
        },
      ];
      break;

    case 'P2033': // Missing number value
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Missing number value';
      errorSources = [
        {
          path: '',
          message: 'A required number value is missing.',
        },
      ];
      break;

    case 'P2034': // Transaction failed due to constraint
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Transaction constraint violation';
      errorSources = [
        {
          path: '',
          message: 'The transaction failed due to a constraint violation.',
        },
      ];
      break;

    default:
      // Unknown Prisma error code
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Database operation failed';
      errorSources = [
        {
          path: '',
          message: err.message || 'An unexpected database error occurred.',
        },
      ];
      break;
  }

  return {
    statusCode,
    message,
    errorSources,
  };
};

export default handlePrismaError;
