// DELETE /api/uploads/[filename] — remove a file from public/uploads

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { unlink, access } from 'fs/promises'
import { join, basename } from 'path'

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads')

type Props = { params: Promise<{ filename: string }> }

export async function DELETE(_: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { filename } = await params

  // Prevent path traversal — only allow plain filenames with no separators
  const safe = basename(filename)
  if (!safe || safe !== filename || safe.startsWith('.')) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
  }

  const filepath = join(UPLOAD_DIR, safe)

  try {
    await access(filepath)
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  try {
    await unlink(filepath)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/uploads]', err)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}
