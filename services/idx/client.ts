import type { IdxRawListing } from './types'

const BASE_URL = process.env.IDX_API_BASE_URL ?? 'https://api.idx.broker/api/1.7'
const API_KEY  = process.env.IDX_API_KEY ?? ''

async function idxFetch<T>(path: string): Promise<T> {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    headers: {
      'accesskey': API_KEY,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`IDX API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export async function fetchActiveListings(): Promise<IdxRawListing[]> {
  try {
    return await idxFetch<IdxRawListing[]>('/listings/active')
  } catch (e) {
    console.error('[IDX] Failed to fetch active listings:', e)
    return []
  }
}

export async function fetchListingById(idxId: string): Promise<IdxRawListing | null> {
  try {
    return await idxFetch<IdxRawListing>(`/listings/${idxId}`)
  } catch {
    return null
  }
}
