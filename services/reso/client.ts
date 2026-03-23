import type { AmpreODataResponse } from './types'

export type TokenType = 'idx' | 'dla' | 'vox'

export type ODataParams = {
  $filter?:  string
  $select?:  string
  $top?:     number
  $orderby?: string
}

const BASE_URL = process.env.AMPRE_API_BASE_URL ?? 'https://query.ampre.ca/odata'

function getToken(tokenType: TokenType): string {
  switch (tokenType) {
    case 'idx': return process.env.AMPRE_IDX_TOKEN ?? 'mock-idx-token'
    case 'dla': return process.env.AMPRE_DLA_TOKEN ?? 'mock-dla-token'
    case 'vox': return process.env.AMPRE_VOX_TOKEN ?? 'mock-vox-token'
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchOData<T>(
  tokenType: TokenType,
  resource: string,
  params: ODataParams
): Promise<Response> {
  const qs = new URLSearchParams()
  if (params.$filter)       qs.set('$filter',  params.$filter)
  if (params.$select)       qs.set('$select',  params.$select)
  if (params.$top  != null) qs.set('$top',     String(params.$top))
  if (params.$orderby)      qs.set('$orderby', params.$orderby)

  const url = `${BASE_URL}/${resource}?${qs}`
  return fetch(url, {
    headers: { Authorization: `Bearer ${getToken(tokenType)}` },
    next:    { revalidate: 0 },
  })
}

/**
 * Fetch a single page from the Amplify OData API.
 *
 * Rate limit (429): reads X-Rate-Limit-Retry-After-Seconds, waits, retries once.
 * If still 429 on retry, throws — callers should write a failed log and return early.
 */
export async function ampreGet<T>(
  tokenType: TokenType,
  resource:  string,
  params:    ODataParams
): Promise<AmpreODataResponse<T>> {
  let res = await fetchOData<T>(tokenType, resource, params)

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('X-Rate-Limit-Retry-After-Seconds') ?? '60', 10)
    await sleep(retryAfter * 1000)
    res = await fetchOData<T>(tokenType, resource, params)
    if (res.status === 429) {
      throw new Error(`AMPRE rate limited on ${resource} — retry after ${retryAfter}s`)
    }
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`AMPRE API error: ${res.status} ${resource} — ${text}`)
  }

  return res.json() as Promise<AmpreODataResponse<T>>
}
