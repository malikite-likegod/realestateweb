// GET  /api/uploads — list all uploaded files
// POST /api/uploads — save a file to disk, return its public URL

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { writeFile, mkdir, readdir, stat } from 'fs/promises'
import { join, extname } from 'path'

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads')

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif',  '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await mkdir(UPLOAD_DIR, { recursive: true })
    const entries = await readdir(UPLOAD_DIR)

    const statsEntries = await Promise.all(
      entries.map(async (filename) => {
        const info = await stat(join(UPLOAD_DIR, filename))
        return { filename, info }
      })
    )

    const files = statsEntries
      .filter(({ info }) => info.isFile())
      .map(({ filename, info }) => {
        const ext = extname(filename).toLowerCase()
        return {
          filename,
          url:        `/uploads/${filename}`,
          size:       info.size,
          ext,
          mimeType:   MIME[ext] ?? 'application/octet-stream',
          uploadedAt: info.mtime.toISOString(),
        }
      })

    files.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    return NextResponse.json({ data: files })
  } catch (err) {
    console.error('[GET /api/uploads]', err)
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch (err) {
    console.error('[POST /api/uploads] Failed to parse formData:', err)
    return NextResponse.json({ error: 'Could not parse request body' }, { status: 400 })
  }

  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  try {
    await mkdir(UPLOAD_DIR, { recursive: true })

    const ext      = file.name.includes('.') ? '.' + file.name.split('.').pop() : ''
    const filename = `${globalThis.crypto.randomUUID()}${ext}`
    const buffer   = Buffer.from(await file.arrayBuffer())

    await writeFile(join(UPLOAD_DIR, filename), buffer)

    return NextResponse.json({
      data: {
        url:          `/uploads/${filename}`,
        originalName: file.name,
        size:         file.size,
      },
    }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/uploads]', err)
    return NextResponse.json({ error: 'Failed to save file' }, { status: 500 })
  }
}
