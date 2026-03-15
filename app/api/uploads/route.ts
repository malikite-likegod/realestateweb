// POST /api/uploads — save a file to disk, return its public URL
// Used by campaign step config to persist attachment files.

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const formData = await request.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const uploadDir = join(process.cwd(), 'public', 'uploads')
  await mkdir(uploadDir, { recursive: true })

  const ext      = file.name.includes('.') ? '.' + file.name.split('.').pop() : ''
  const filename = `${randomUUID()}${ext}`
  const buffer   = Buffer.from(await file.arrayBuffer())

  await writeFile(join(uploadDir, filename), buffer)

  return NextResponse.json({
    data: {
      url:          `/uploads/${filename}`,
      originalName: file.name,
      size:         file.size,
    },
  }, { status: 201 })
}
