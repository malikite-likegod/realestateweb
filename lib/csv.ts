/**
 * Parse a CSV string into an array of row objects keyed by lowercased header name.
 * Handles quoted fields (including fields containing commas or newlines).
 *
 * @param csvText  Raw CSV file contents as a string
 * @returns        Array of objects, one per data row. Keys are trimmed, lowercased header names.
 */
export function parseCsv(csvText: string): Record<string, string>[] {
  const lines = splitCsvLines(csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n'))
  if (lines.length === 0) return []

  const headers = parseRow(lines[0]).map(h => h.trim().toLowerCase())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseRow(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = (values[idx] ?? '').trim() })
    rows.push(row)
  }

  return rows
}

/** Split CSV text into logical lines, respecting quoted fields that span lines. */
function splitCsvLines(text: string): string[] {
  const lines: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      // Handle escaped quote ("")
      if (inQuotes && text[i + 1] === '"') { current += '"'; i++; continue }
      inQuotes = !inQuotes
      current += ch
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current) lines.push(current)
  return lines
}

/** Parse a single CSV row into an array of field values. */
function parseRow(line: string): string[] {
  const fields: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++; continue }
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(field)
      field = ''
    } else {
      field += ch
    }
  }
  fields.push(field)
  return fields
}
