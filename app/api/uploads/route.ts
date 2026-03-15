// POST /api/uploads — save a file to disk, return its public URL
// Used by campaign step config to persist attachment files.

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

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
    const uploadDir = join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadDir, { recursive: true })

    const ext      = file.name.includes('.') ? '.' + file.name.split('.').pop() : ''
    const filename = `${globalThis.crypto.randomUUID()}${ext}`
    const buffer   = Buffer.from(await file.arrayBuffer())

    await writeFile(join(uploadDir, filename), buffer)

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
