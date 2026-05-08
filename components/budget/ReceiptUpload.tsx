'use client'

import { useState, useRef } from 'react'
import { Upload, X, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui'

interface Props {
  value: string | null
  onChange: (url: string | null) => void
}

export function ReceiptUpload({ value, onChange }: Props) {
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    const res  = await fetch('/api/uploads', { method: 'POST', body: form })
    const json = await res.json()
    setUploading(false)
    if (!res.ok) {
      toast('error', 'Upload failed', json.error ?? 'Could not upload file')
      return
    }
    onChange(json.data.url)
  }

  function handleFiles(files: FileList | null) {
    if (files?.length) uploadFile(files[0])
  }

  const isPdf = value?.toLowerCase().endsWith('.pdf')

  if (value) {
    return (
      <div className="flex items-center gap-3 p-3 bg-charcoal-800 border border-charcoal-700 rounded-lg">
        {isPdf ? (
          <a href={value} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-charcoal-300 hover:text-white">
            <FileText size={20} className="text-gold-400 shrink-0" />
            <span>View receipt (PDF)</span>
          </a>
        ) : (
          <a href={value} target="_blank" rel="noopener noreferrer">
            <img src={value} alt="Receipt" className="h-16 w-16 object-cover rounded" />
          </a>
        )}
        <button onClick={() => onChange(null)} className="ml-auto text-charcoal-400 hover:text-red-400">
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors',
          dragging ? 'border-gold-400 bg-gold-400/5' : 'border-charcoal-700 hover:border-charcoal-500',
        )}
      >
        <Upload size={24} className="text-charcoal-400" />
        <span className="text-sm text-charcoal-400 text-center">
          {uploading ? 'Uploading…' : 'Drop receipt here or click to browse'}
        </span>
        <span className="text-xs text-charcoal-600">JPG, PNG, WEBP, PDF · max 10 MB</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        capture={"environment" as any}
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  )
}
