'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Paperclip, Upload, Search, FileText, Image, File } from 'lucide-react'

export interface PickedFile {
  url:  string  // e.g. /uploads/uuid.pdf
  name: string  // original display name
}

interface Props {
  multiple?:  boolean
  onSelect:   (files: PickedFile[]) => void
  onClose:    () => void
}

interface UploadedFile {
  filename:   string
  url:        string
  size:       number
  ext:        string
  mimeType:   string
  uploadedAt: string
}

const DOC_EXTS   = ['.pdf', '.doc', '.docx']
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']

function FileIcon({ ext, mimeType }: { ext: string; mimeType: string }) {
  if (mimeType.startsWith('image/')) return <Image size={16} className="text-blue-400 shrink-0" />
  if (ext === '.pdf') return <FileText size={16} className="text-red-400 shrink-0" />
  return <File size={16} className="text-charcoal-400 shrink-0" />
}

function fmtSize(bytes: number) {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FilePicker({ multiple = false, onSelect, onClose }: Props) {
  const [files,      setFiles]      = useState<UploadedFile[]>([])
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState<'docs' | 'images' | 'all'>('docs')
  const [query,      setQuery]      = useState('')
  const [selected,   setSelected]   = useState<Set<string>>(new Set())
  const [uploading,  setUploading]  = useState(false)
  const [uploadErr,  setUploadErr]  = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/uploads')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(json => setFiles(json.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const visible = files.filter(f => {
    if (tab === 'docs'   && !DOC_EXTS.includes(f.ext))   return false
    if (tab === 'images' && !IMAGE_EXTS.includes(f.ext)) return false
    if (query.trim() && !f.filename.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  function toggle(url: string) {
    if (multiple) {
      setSelected(prev => {
        const next = new Set(prev)
        next.has(url) ? next.delete(url) : next.add(url)
        return next
      })
    } else {
      setSelected(new Set([url]))
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    setUploadErr('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch('/api/uploads', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      const { url, originalName } = json.data
      const ext = url.slice(url.lastIndexOf('.')).toLowerCase()
      const newFile: UploadedFile = {
        filename:   url.split('/').pop()!,
        url,
        size:       file.size,
        ext,
        mimeType:   file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
      }
      setFiles(prev => [newFile, ...prev])
      // Auto-select the just-uploaded file
      setSelected(prev => multiple ? new Set([...prev, url]) : new Set([url]))
      setTab('all')
      setQuery(originalName ?? '')
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleConfirm() {
    const picked = files
      .filter(f => selected.has(f.url))
      .map(f => ({ url: f.url, name: f.filename }))
    onSelect(picked)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-charcoal-100">
          <div className="flex items-center gap-2">
            <Paperclip size={16} className="text-charcoal-500" />
            <h2 className="text-base font-semibold text-charcoal-900">Attach Files</h2>
          </div>
          <button type="button" onClick={onClose} className="text-charcoal-400 hover:text-charcoal-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs + search */}
        <div className="px-5 pt-3 pb-2 border-b border-charcoal-100 space-y-2">
          <div className="flex gap-1">
            {(['docs', 'images', 'all'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                  tab === t ? 'bg-charcoal-900 text-white' : 'text-charcoal-500 hover:bg-charcoal-50'
                }`}
              >
                {t === 'docs' ? 'Documents' : t === 'images' ? 'Images' : 'All files'}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by filename…"
              className="w-full rounded-lg border border-charcoal-200 pl-8 pr-3 py-1.5 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
            />
          </div>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
          {loading ? (
            <p className="text-sm text-charcoal-400 text-center py-8">Loading files…</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-charcoal-400 text-center py-8">
              {files.length === 0 ? 'No files uploaded yet.' : 'No files match your filter.'}
            </p>
          ) : (
            <ul className="divide-y divide-charcoal-50">
              {visible.map(f => {
                const isSelected = selected.has(f.url)
                return (
                  <li
                    key={f.url}
                    onClick={() => toggle(f.url)}
                    className={`flex items-center gap-3 py-2.5 px-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? 'bg-gold-50' : 'hover:bg-charcoal-50'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-gold-500 border-gold-500' : 'border-charcoal-300'
                    }`}>
                      {isSelected && <span className="text-white text-[9px] font-bold">✓</span>}
                    </div>
                    <FileIcon ext={f.ext} mimeType={f.mimeType} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-charcoal-900 truncate">{f.filename}</p>
                      <p className="text-xs text-charcoal-400">{fmtSize(f.size)} · {new Date(f.uploadedAt).toLocaleDateString('en-CA')}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer: upload new + confirm */}
        <div className="px-5 py-4 border-t border-charcoal-100 space-y-3">
          {uploadErr && <p className="text-xs text-red-500">{uploadErr}</p>}

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.svg"
            onChange={handleUpload}
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-medium text-charcoal-600 hover:text-charcoal-900 border border-charcoal-200 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
            >
              <Upload size={13} />
              {uploading ? 'Uploading…' : 'Upload new file'}
            </button>

            <button
              type="button"
              disabled={selected.size === 0}
              onClick={handleConfirm}
              className="flex-1 bg-charcoal-900 hover:bg-charcoal-700 text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {selected.size === 0
                ? 'Select a file'
                : `Attach ${selected.size} file${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
