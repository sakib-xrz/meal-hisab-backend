class AppError extends Error {
  statusCode: number;
  errors?: string[] | Record<string, string[]>;

  constructor(
    statusCode: number,
    message: string | undefined,
    errors?: string[] | Record<string, string[]>,
    stack = '',
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default AppError;
