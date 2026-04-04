// GET  /api/uploads — list all uploaded files
// POST /api/uploads — save a file to disk, return its public URL

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { writeFile, mkdir, readdir, stat } from 'fs/promises'
import { join, extname } from 'path'
import { fileTypeFromBuffer } from 'file-type'

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads')

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif',  '.webp': 'image/webp',
  // .svg excluded — SVG files can embed <script> tags and execute as JavaScript
  // when served from this origin, making them an XSS vector
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

    const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 })
    }

    const ext = file.name.includes('.') ? ('.' + file.name.split('.').pop()!.toLowerCase()) : ''
    if (!Object.prototype.hasOwnProperty.call(MIME, ext)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // Validate actual file content against declared extension (magic bytes check).
    // This catches renamed files (e.g. a PHP file saved as .jpg).
    // PDFs and Office docs are excluded from this check because their magic bytes
    // vary across versions and the file-type library may not detect all variants.
    const imageMimes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
    const declaredMime = MIME[ext]
    if (imageMimes.has(declaredMime)) {
      const detected = await fileTypeFromBuffer(buffer)
      if (!detected || detected.mime !== declaredMime) {
        return NextResponse.json({ error: 'File content does not match declared type' }, { status: 400 })
      }
    }

    const filename = `${globalThis.crypto.randomUUID()}${ext}`

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
