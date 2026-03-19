import type { ResoODataResponse } from './types'

const BASE_URL      = process.env.RESO_API_BASE_URL  ?? 'http://localhost:3000/api/mock-reso'
const CLIENT_ID     = process.env.RESO_CLIENT_ID     ?? 'mock-client'
const CLIENT_SECRET = process.env.RESO_CLIENT_SECRET ?? 'mock-secret'

interface TokenCache {
  token:     string
  expiresAt: number   // unix ms
}

let tokenCache: TokenCache | null = null

async function getToken(): Promise<string> {
  const now = Date.now()
  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.token
  }

  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
  })

  const res = await fetch(`${BASE_URL}/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`RESO token request failed: ${res.status} ${text}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  tokenCache = { token: data.access_token, expiresAt: now + data.expires_in * 1000 }
  return data.access_token
}

export type ODataParams = {
  $filter?:  string
  $select?:  string
  $top?:     number
  $skip?:    number
  $orderby?: string
}

export async function resoGet<T>(resource: string, params: ODataParams = {}): Promise<ResoODataResponse<T>> {
  const token = await getToken()
  const qs = new URLSearchParams()
  if (params.$filter)       qs.set('$filter',  params.$filter)
  if (params.$select)       qs.set('$select',  params.$select)
  if (params.$top  != null) qs.set('$top',     String(params.$top))
  if (params.$skip != null) qs.set('$skip',    String(params.$skip))
  if (params.$orderby)      qs.set('$orderby', params.$orderby)

  const url = `${BASE_URL}/${resource}?${qs}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next:    { revalidate: 0 },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`RESO API error: ${res.status} ${url} — ${text}`)
  }

  return res.json() as Promise<ResoODataResponse<T>>
}

/** Fetch all pages of a resource using @odata.count for termination. */
export async function resoGetAll<T>(resource: string, filter?: string): Promise<T[]> {
  const PAGE_SIZE = 100
  let skip = 0
  const all: T[] = []

  // Fetch first page to get total count
  const first = await resoGet<T>(resource, {
    $filter:  filter,
    $top:     PAGE_SIZE,
    $skip:    0,
    $orderby: 'ModificationTimestamp desc',
  })
  all.push(...first.value)
  const total = first['@odata.count'] ?? first.value.length
  skip = PAGE_SIZE

  while (skip < total) {
    const response = await resoGet<T>(resource, {
      $filter:  filter,
      $top:     PAGE_SIZE,
      $skip:    skip,
      $orderby: 'ModificationTimestamp desc',
    })
    all.push(...response.value)
    if (response.value.length === 0) break // safety guard
    skip += PAGE_SIZE
  }

  return all
}
