export * from './crm'
export * from './real-estate'
export * from './ai'

export type ApiResponse<T> = {
  data?: T
  error?: string
  message?: string
}

export type PaginatedResponse<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type SortDirection = 'asc' | 'desc'

export type PaginationParams = {
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: SortDirection
}
