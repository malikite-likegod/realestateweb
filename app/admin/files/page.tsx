'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Button } from '@/components/ui'
import { useToast } from '@/components/ui'
import { Upload, Trash2, Copy, FileText, Image as ImageIcon, File } from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from 'next/image'

interface UploadedFile {
  filename:   string
  url:        string
  size:       number
  ext:        string
  mimeType:   string
  uploadedAt: string
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImage(mimeType: string) {
  return mimeType.startsWith('image/')
}

type Filter = 'all' | 'images' | 'documents'

export default function FilesPage() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles]       = useState<UploadedFile[]>([])
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [filter, setFilter]     = useState<Filter>('all')
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const user = { name: 'Admin', email: '', avatarUrl: null }

  async function loadFiles() {
    try {
      const res = await fetch('/api/uploads')
      if (!res.ok) throw new Error()
      const json = await res.json()
      setFiles(json.data)
    } catch {
      toast('error', 'Failed to load files')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadFiles() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setUploading(true)
    let successCount = 0
    for (const file of Array.from(fileList)) {
      const fd = new FormData()
      fd.append('file', file)
      try {
        const res = await fetch('/api/uploads', { method: 'POST', body: fd })
        if (!res.ok) throw new Error()
        successCount++
      } catch {
        toast('error', `Failed to upload ${file.name}`)
      }
    }
    if (successCount > 0) {
      toast('success', `${successCount} file${successCount > 1 ? 's' : ''} uploaded`)
      await loadFiles()
    }
    setUploading(false)
  }

  async function handleDelete(filename: string) {
    setDeleting(filename)
    setConfirmDelete(null)
    try {
      const res = await fetch(`/api/uploads/${encodeURIComponent(filename)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setFiles(f => f.filter(x => x.filename !== filename))
      toast('success', 'File deleted')
    } catch {
      toast('error', 'Failed to delete file')
    } finally {
      setDeleting(null)
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(window.location.origin + url)
    toast('success', 'URL copied')
  }

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true) }, [])
  const onDragLeave = useCallback(() => setDragging(false), [])
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    uploadFiles(e.dataTransfer.files)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = files.filter(f => {
    if (filter === 'images')    return isImage(f.mimeType)
    if (filter === 'documents') return !isImage(f.mimeType)
    return true
  })

  const counts = {
    all:       files.length,
    images:    files.filter(f => isImage(f.mimeType)).length,
    documents: files.filter(f => !isImage(f.mimeType)).length,
  }

  return (
    <DashboardLayout user={user}>
      <PageHeader
        title="File Manager"
        subtitle={`${files.length} file${files.length !== 1 ? 's' : ''}`}
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Files' }]}
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,.pdf,.doc,.docx"
              onChange={e => uploadFiles(e.target.files)}
            />
            <Button
              variant="primary"
              leftIcon={<Upload size={16} />}
              loading={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload Files
            </Button>
          </>
        }
      />

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'mb-6 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
          dragging
            ? 'border-gold-500 bg-gold-50'
            : 'border-charcoal-200 bg-charcoal-50 hover:border-charcoal-300',
        )}
      >
        <Upload size={24} className={cn('mx-auto mb-2', dragging ? 'text-gold-600' : 'text-charcoal-400')} />
        <p className="text-sm text-charcoal-600 font-medium">
          {dragging ? 'Drop to upload' : 'Drag & drop files here'}
        </p>
        <p className="text-xs text-charcoal-400 mt-1">Images, PDFs, and Word documents supported</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 border-b border-charcoal-100">
        {(['all', 'images', 'documents'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
              filter === f
                ? 'border-charcoal-900 text-charcoal-900'
                : 'border-transparent text-charcoal-500 hover:text-charcoal-700',
            )}
          >
            {f} <span className="ml-1 text-xs text-charcoal-400">({counts[f]})</span>
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-charcoal-100 bg-charcoal-50 animate-pulse aspect-square" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-charcoal-400">
          <File size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No files yet. Upload something above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map(file => (
            <div
              key={file.filename}
              className="group relative rounded-xl border border-charcoal-100 bg-white overflow-hidden hover:border-charcoal-300 hover:shadow-sm transition-all"
            >
              {/* Thumbnail */}
              <div className="relative aspect-square bg-charcoal-50 flex items-center justify-center overflow-hidden">
                {isImage(file.mimeType) ? (
                  <Image
                    src={file.url}
                    alt={file.filename}
                    fill
                    className="object-cover"
                    sizes="200px"
                  />
                ) : file.mimeType === 'application/pdf' ? (
                  <FileText size={36} className="text-red-400" />
                ) : (
                  <ImageIcon size={36} className="text-blue-400" />
                )}
              </div>

              {/* Info */}
              <div className="p-2">
                <p className="text-xs font-medium text-charcoal-800 truncate" title={file.filename}>
                  {file.filename}
                </p>
                <p className="text-xs text-charcoal-400 mt-0.5">{formatBytes(file.size)}</p>
              </div>

              {/* Hover actions */}
              {confirmDelete === file.filename ? (
                <div className="absolute inset-0 bg-charcoal-900/80 flex flex-col items-center justify-center gap-2 p-3">
                  <p className="text-xs text-white font-medium text-center">Delete this file?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(file.filename)}
                      disabled={deleting === file.filename}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-charcoal-100 text-charcoal-800 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 bg-charcoal-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => copyUrl(file.url)}
                    title="Copy URL"
                    className="p-2 rounded-lg bg-white text-charcoal-800 hover:bg-charcoal-100 transition-colors"
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(file.filename)}
                    disabled={deleting === file.filename}
                    title="Delete"
                    className="p-2 rounded-lg bg-white text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
