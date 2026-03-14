export type ParsedContactRow = {
  // Raw CSV values
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  jobTitle: string
  source: string
  status: string
  tags: string          // raw comma-separated string, e.g. "buyer,downtown"
  birthday: string      // ISO date string, e.g. "1990-01-15"

  // Client-side validation result
  rowStatus: 'ready' | 'error'
  errorMessage?: string // e.g. "Missing email", "Invalid email format"
  rowIndex: number      // 1-based data row number (row 1 = first data row after header)
}

export type BulkImportResult = {
  imported: number
  skipped: number
  failed: number
  errors: Array<{ row: number; email: string; reason: string }>
}
