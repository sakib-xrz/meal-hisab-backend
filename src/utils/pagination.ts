export interface IPaginationOptions {
  page?: number;
  limit?: number;
  sort_order?: string;
  sort_by?: string;
}

export interface IPaginationResult {
  page: number;
  limit: number;
  skip: number;
  sort_by: string;
  sort_order: string;
}

export const calculatePagination = (
  options: IPaginationOptions,
): IPaginationResult => {
  const page: number = Number(options.page) || 1;
  const limit: number = Number(options.limit) || 10;
  const skip: number = (Number(page) - 1) * limit;

  const sort_by: string = options.sort_by || 'created_at';
  const sort_order: string = options.sort_order || 'desc';

  return {
    page,
    limit,
    skip,
    sort_by,
    sort_order,
  };
};
