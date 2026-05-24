export type TErrorSources = {
  path: string | number;
  message: string;
}[];

export type TGenericErrorResponse = {
  statusCode: number;
  message: string;
  errorSources: TErrorSources;
};

export interface ApiErrorResponse {
  success: boolean;
  statusCode: number;
  message: string;
  errors?: string[] | Record<string, string[]>;
  timestamp: string;
  path?: string;
  stack?: string;
}
