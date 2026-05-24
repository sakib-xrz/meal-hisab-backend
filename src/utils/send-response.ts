import { Response } from 'express';

type ApiResponse<T> = {
  statusCode: number;
  success: boolean;
  message?: string | null;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
  data?: T | null;
  timestamp?: string;
};

const sendResponse = <T>(res: Response, data: ApiResponse<T>): void => {
  const responseData: ApiResponse<T> = {
    statusCode: data.statusCode,
    success: data.success,
    message: data.message || null,
    meta: data.meta || null || undefined,
    data: data.data || null || undefined,
    timestamp: new Date().toISOString(),
  };

  res.status(data.statusCode).json(responseData);
};

export default sendResponse;
