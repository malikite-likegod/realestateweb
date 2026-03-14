'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { Upload, ArrowLeft, ArrowRight, CheckCircle, Users } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { Button } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { CsvImportTable } from '@/components/admin/CsvImportTable'
import { parseCsv } from '@/lib/csv'
import type { ParsedContactRow, BulkImportResult } from '@/types/csv'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const CSV_TEMPLATE = `firstName,lastName,email,phone,company,jobTitle,source,status,tags,birthday
Jane,Smith,jane@example.com,555-1234,Acme Corp,Realtor,referral,lead,"buyer,downtown",1985-06-15`

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'contacts-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function validateRows(raw: Record<string, string>[]): ParsedContactRow[] {
  return raw.map((r, i) => {
    const mapped = mapRawRow(r)
    const rowIndex = i + 1

    if (!mapped.firstName) {
      return { ...mapped, rowIndex, rowStatus: 'error', errorMessage: 'Missing first name' }
    }
    if (!mapped.lastName) {
      return { ...mapped, rowIndex, rowStatus: 'error', errorMessage: 'Missing last name' }
    }
    if (!mapped.email) {
      return { ...mapped, rowIndex, rowStatus: 'error', errorMessage: 'Missing email' }
    }
    if (!EMAIL_REGEX.test(mapped.email)) {
      return { ...mapped, rowIndex, rowStatus: 'error', errorMessage: 'Invalid email format' }
    }
    return { ...mapped, rowIndex, rowStatus: 'ready' }
  })
}

function mapRawRow(r: Record<string, string>) {
  return {
    firstName: r['firstname'] ?? '',
    lastName:  r['lastname']  ?? '',
    email:     r['email']     ?? '',
    phone:     r['phone']     ?? '',
    company:   r['company']   ?? '',
    jobTitle:  r['jobtitle']  ?? '',
    source:    r['source']    ?? '',
    status:    r['status']    ?? '',
    tags:      r['tags']      ?? '',
    birthday:  r['birthday']  ?? '',
  }
}

export default function ImportContactsPage() {
  const { toast }                         = useToast()
  const [step, setStep]                   = useState<1 | 2 | 3>(1)
  const [rows, setRows]                   = useState<ParsedContactRow[]>([])
  const [results, setResults]             = useState<BulkImportResult | null>(null)
  const [loading, setLoading]             = useState(false)
  const [fileError, setFileError]         = useState<string | null>(null)
  const [isDragging, setIsDragging]       = useState(false)
  const fileInputRef                      = useRef<HTMLInputElement>(null)

  const readyCount = rows.filter(r => r.rowStatus === 'ready').length
  const errorCount = rows.filter(r => r.rowStatus === 'error').length

  function handleFile(file: File) {
    setFileError(null)
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setFileError('Please upload a .csv file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError('File is too large. Maximum size is 5 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const text      = e.target?.result as string
        const rawRows   = parseCsv(text)
        const validated = validateRows(rawRows)
        setRows(validated)
        setStep(2)
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

  async function handleImport() {
    const readyRows = rows.filter(r => r.rowStatus === 'ready')
    setLoading(true)
    try {
      const res = await fetch('/api/contacts/bulk', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: readyRows.map(r => ({
            firstName: r.firstName || undefined,
            lastName:  r.lastName  || undefined,
            email:     r.email,
            phone:     r.phone     || undefined,
            company:   r.company   || undefined,
            jobTitle:  r.jobTitle  || undefined,
            source:    r.source    || undefined,
            status:    r.status    || undefined,
            tags:      r.tags ? r.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
            birthday:  r.birthday || undefined,
            rowIndex:  r.rowIndex,
          })),
        }),
      })
      if (!res.ok) {
        toast('error', 'Import failed', 'Please try again.')
        return
      }
      const data: BulkImportResult = await res.json()
      setResults(data)
      setStep(3)
    } catch {
      toast('error', 'Import failed', 'Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function resetImport() {
    setStep(1)
    setRows([])
    setResults(null)
    setFileError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Minimal layout wrapper — DashboardLayout requires a server session,
  // so we use a lightweight div wrapper for this client component page.
  return (
    <div className="min-h-screen bg-charcoal-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <PageHeader
          title="Import Contacts"
          subtitle="Upload a CSV file to create contacts in bulk"
          breadcrumbs={[
            { label: 'Dashboard', href: '/admin/dashboard' },
            { label: 'Contacts',  href: '/admin/contacts' },
            { label: 'Import' },
          ]}
        />

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[
            { n: 1, label: 'Upload File' },
            { n: 2, label: 'Preview & Validate' },
            { n: 3, label: 'Results' },
          ].map(({ n, label }, idx, arr) => (
            <div key={n} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                step >= n ? 'bg-charcoal-900 text-white' : 'bg-charcoal-200 text-charcoal-500'
              }`}>
                {n}
              </div>
              <span className={`text-sm font-medium ${step >= n ? 'text-charcoal-900' : 'text-charcoal-400'}`}>
                {label}
              </span>
              {idx < arr.length - 1 && <div className="flex-1 h-px bg-charcoal-200 mx-2" />}
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-charcoal-200 p-8 space-y-4">
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                isDragging ? 'border-charcoal-500 bg-charcoal-50' : 'border-charcoal-300 hover:border-charcoal-400'
              }`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto mb-3 text-charcoal-400" size={32} />
              <p className="font-medium text-charcoal-800 text-base">Drop your CSV here or click to browse</p>
              <p className="text-sm text-charcoal-500 mt-1">Accepts .csv files up to 5 MB</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}>
                Choose File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>

            {fileError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                {fileError}
              </p>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
              <span className="font-medium">Expected columns:</span>{' '}
              firstName, lastName, email*, phone, company, jobTitle, source, status, tags, birthday
              <br />
              <button
                className="text-blue-600 underline mt-1 inline-block"
                onClick={downloadTemplate}
              >
                ⬇ Download CSV template
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-charcoal-200 p-6 space-y-4">
            <div className="flex gap-3 flex-wrap">
              <span className="text-sm font-medium text-green-700 bg-green-100 border border-green-200 rounded-full px-3 py-1">
                {readyCount} ready to import
              </span>
              {errorCount > 0 && (
                <span className="text-sm font-medium text-red-700 bg-red-100 border border-red-200 rounded-full px-3 py-1">
                  {errorCount} error{errorCount !== 1 ? 's' : ''} (will be skipped)
                </span>
              )}
            </div>

            {rows.length === 0 ? (
              <p className="text-sm text-charcoal-500 py-4 text-center">
                No data rows found. The CSV may contain only a header row.
              </p>
            ) : (
              <CsvImportTable rows={rows} />
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" leftIcon={<ArrowLeft size={16} />} onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                variant="primary"
                rightIcon={<ArrowRight size={16} />}
                disabled={readyCount === 0}
                loading={loading}
                onClick={handleImport}
              >
                Import {readyCount} Contact{readyCount !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 3 && results && (
          <div className="bg-white rounded-2xl border border-charcoal-200 p-10 text-center space-y-6">
            <CheckCircle className="mx-auto text-green-500" size={56} />
            <h2 className="text-2xl font-bold text-charcoal-900">Import Complete</h2>
            <div className="flex justify-center gap-10">
              <div>
                <div className="text-3xl font-bold text-green-600">{results.imported}</div>
                <div className="text-sm text-charcoal-500 mt-1">Imported</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-amber-500">{results.skipped}</div>
                <div className="text-sm text-charcoal-500 mt-1">Skipped (duplicate)</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-red-500">{results.failed}</div>
                <div className="text-sm text-charcoal-500 mt-1">Failed</div>
              </div>
            </div>

            {results.errors.length > 0 && (
              <div className="text-left bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 max-h-40 overflow-y-auto">
                <p className="font-medium mb-2">Row errors:</p>
                {results.errors.map(e => (
                  <div key={e.row}>Row {e.row}: {e.email || '(no email)'} — {e.reason}</div>
                ))}
              </div>
            )}

            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={resetImport}>
                Import Another
              </Button>
              <Button variant="primary" leftIcon={<Users size={16} />} asChild>
                <Link href="/admin/contacts">View Contacts</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
