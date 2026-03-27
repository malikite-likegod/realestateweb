'use client'

import { useState, useRef } from 'react'
import { Upload, Download } from 'lucide-react'
import { isValidIpv4, normalizeIpv4 } from '@/lib/ip-utils'

const TEMPLATE = 'ip\n192.168.1.1\n10.0.0.5\n'
const MAX_PREVIEW_ROWS = 500
const MAX_FILE_BYTES   = 4 * 1024 * 1024

interface ParsedIpRow {
  raw: string
  normalized: string | null
  valid: boolean
  error?: string
}

interface UploadResult {
  added:   number
  updated: number
  skipped: number
  invalid: string[]
}

interface Props {
  onUploaded: () => void
}

function downloadTemplate() {
  const blob = new Blob([TEMPLATE], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'blocked-ips-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function parseRows(csvText: string): { rows: ParsedIpRow[]; total: number } {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  // Find header row — case-insensitive match for 'ip'
  const headerIdx = lines.findIndex(l => l.split(',')[0].trim().toLowerCase() === 'ip')
  const dataLines = headerIdx >= 0 ? lines.slice(headerIdx + 1) : lines
  const total = dataLines.length
  const slice = dataLines.slice(0, MAX_PREVIEW_ROWS)
  const rows: ParsedIpRow[] = slice.map(raw => {
    if (!raw)              return { raw, normalized: null, valid: false, error: 'Empty' }
    if (!isValidIpv4(raw)) return { raw, normalized: null, valid: false, error: 'Invalid IPv4' }
    return { raw, normalized: normalizeIpv4(raw), valid: true }
  })
  return { rows, total }
}

export function BlockedIpsUpload({ onUploaded }: Props) {
  const [rows, setRows]             = useState<ParsedIpRow[]>([])
  const [totalRows, setTotalRows]   = useState(0)
  const [rawCsv, setRawCsv]         = useState('')
  const [fileError, setFileError]   = useState<string | null>(null)
  const [result, setResult]         = useState<UploadResult | null>(null)
  const [loading, setLoading]       = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef                = useRef<HTMLInputElement>(null)

  const validCount = rows.filter(r => r.valid).length

  function handleFile(file: File) {
    setFileError(null)
    setResult(null)
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setFileError('Please upload a .csv file.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError('File is too large. Maximum size is 4 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const text = e.target?.result as string
        const { rows: r, total } = parseRows(text)
        setRows(r)
        setTotalRows(total)
        setRawCsv(text)
      } catch {
        setFileError('Could not parse this file. Make sure it is a valid CSV.')
      }
    }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function handleUpload() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/blocked-ips', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ csv: rawCsv }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        setFileError(err.error ?? 'Upload failed. Please try again.')
        return
      }
      const data: UploadResult = await res.json()
      setResult(data)
      setRows([])
      setRawCsv('')
      setTotalRows(0)
      onUploaded()
    } catch {
      setFileError('Upload failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setRows([])
    setRawCsv('')
    setTotalRows(0)
    setResult(null)
    setFileError(null)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900">Upload Blocked IPs</h2>

      {rows.length === 0 && !result && (
        <>
          <div
            className={`border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-colors ${
              isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mx-auto mb-2 text-gray-400" size={28} />
            <p className="font-medium text-gray-800">Drop your CSV here or click to browse</p>
            <p className="text-sm text-gray-500 mt-1">Accepts .csv files up to 4 MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-4 py-2">
            <span>Single column CSV with header <code className="font-mono bg-blue-100 px-1 rounded">ip</code>. IPv4 addresses only.</span>
            <button className="ml-auto flex items-center gap-1 underline whitespace-nowrap" onClick={e => { e.stopPropagation(); downloadTemplate() }}>
              <Download size={14} /> Template
            </button>
          </div>
        </>
      )}

      {fileError && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-2">{fileError}</p>
      )}

      {rows.length > 0 && (
        <div className="space-y-3">
          {totalRows > MAX_PREVIEW_ROWS && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-4 py-2">
              Showing first {MAX_PREVIEW_ROWS} of {totalRows} rows — all valid IPs will be uploaded.
            </p>
          )}
          <div className="overflow-x-auto rounded-md border border-gray-200 max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 border-b border-gray-200">IP Address</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 border-b border-gray-200">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={row.valid ? 'bg-green-50' : 'bg-red-50'}>
                    <td className="px-3 py-1.5 font-mono text-gray-900">{row.raw || '(empty)'}</td>
                    <td className="px-3 py-1.5">
                      {row.valid ? (
                        <span className="text-xs font-medium text-green-700 bg-green-100 rounded-full px-2 py-0.5">Valid</span>
                      ) : (
                        <span className="text-xs font-medium text-red-700 bg-red-100 rounded-full px-2 py-0.5">{row.error ?? 'Invalid'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              onClick={reset}
            >
              Cancel
            </button>
            <button
              className={`px-3 py-2 text-sm rounded-md text-white transition-colors ${
                validCount === 0 || loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gray-900 hover:bg-gray-700'
              }`}
              disabled={validCount === 0 || loading}
              onClick={handleUpload}
            >
              {loading ? 'Uploading…' : totalRows > MAX_PREVIEW_ROWS
                ? `Block ${validCount}+ IPs (full file)`
                : `Block ${validCount} IP${validCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-md px-4 py-3 text-sm text-green-800 space-y-1">
          <p className="font-medium">Upload complete</p>
          <p>{result.added} added · {result.updated} updated (expiry reset) · {result.skipped} invalid (skipped)</p>
          {result.invalid.length > 0 && (
            <p className="text-xs text-red-700 mt-1">
              Invalid: {result.invalid.slice(0, 10).join(', ')}{result.invalid.length > 10 ? ` + ${result.invalid.length - 10} more` : ''}
            </p>
          )}
          <button className="underline text-green-700 text-xs mt-1" onClick={reset}>Upload another</button>
        </div>
      )}
    </div>
  )
}
