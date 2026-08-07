/**
 * TRREB Toronto district codes (C01-C15, E01-E11, W01-W10) synced into
 * ResoProperty.city as raw values like "Toronto C01". Meaningless to a
 * home buyer, so this maps each code to a consumer-friendly display name
 * and resolves free-text search input (label, code, or partial neighbourhood
 * name) back to the canonical value the database actually stores.
 *
 * Single source of truth — the canonical `cityValue` is never altered or
 * migrated; this is a presentation/search layer on top of it.
 */

export interface TrrebDistrict {
  code:        string // 'C01'
  cityValue:   string // 'Toronto C01' — exact literal stored in ResoProperty.city
  displayName: string // 'Downtown West (Toronto)'
}

const RAW_DISTRICTS: Array<[code: string, displayName: string]> = [
  // Toronto Central
  ['C01', 'Downtown West (Toronto)'],
  ['C02', 'Yorkville & Midtown West (Toronto)'],
  ['C03', 'Forest Hill & Cedarvale (Toronto)'],
  ['C04', 'Lawrence Park & Bedford Park (Toronto)'],
  ['C06', 'North York West (Toronto)'],
  ['C07', 'Willowdale West (Toronto)'],
  ['C08', 'Downtown East (Toronto)'],
  ['C09', 'Rosedale & Moore Park (Toronto)'],
  ['C10', 'Yonge & Eglinton (Toronto)'],
  ['C11', 'Leaside & East York North (Toronto)'],
  ['C12', 'York Mills & Bridle Path (Toronto)'],
  ['C13', 'Don Mills & Parkwoods (Toronto)'],
  ['C14', 'Willowdale East (Toronto)'],
  ['C15', 'Bayview Village & North York East (Toronto)'],
  // Toronto East
  ['E01', 'Riverdale & Leslieville (Toronto)'],
  ['E02', 'The Beaches & East Danforth (Toronto)'],
  ['E03', 'East York & Woodbine Heights (Toronto)'],
  ['E04', 'Clairlea & Scarborough Junction (Toronto)'],
  ['E05', 'Agincourt & Milliken (Toronto)'],
  ['E06', 'Birch Cliff & Cliffside (Toronto)'],
  ['E07', 'Woburn & Morningside (Toronto)'],
  ['E08', 'West Hill & Highland Creek (Toronto)'],
  ['E09', 'Scarborough Village & Eglinton East (Toronto)'],
  ['E10', 'Rouge & Port Union (Toronto)'],
  ['E11', 'North Scarborough (Toronto)'],
  // Toronto West
  ['W01', 'Roncesvalles & Parkdale (Toronto)'],
  ['W02', 'Bloor West & The Junction (Toronto)'],
  ['W03', 'Weston & Keelesdale (Toronto)'],
  ['W04', 'York & Weston (Toronto)'],
  ['W05', 'Downsview & North York West (Toronto)'],
  ['W06', 'Mimico & Long Branch (Toronto)'],
  ['W07', 'Etobicoke South (Toronto)'],
  ['W08', 'The Kingsway & Islington (Toronto)'],
  ['W09', 'Etobicoke West & The Westway (Toronto)'],
  ['W10', 'Etobicoke North (Toronto)'],
]

export const TRREB_DISTRICTS: TrrebDistrict[] = RAW_DISTRICTS.map(([code, displayName]) => ({
  code,
  cityValue: `Toronto ${code}`,
  displayName,
}))

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[().,'-]/g, ' ')
    .replace(/\btoronto\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const byCityValue = new Map(TRREB_DISTRICTS.map(d => [d.cityValue.toLowerCase(), d]))
const byCode      = new Map(TRREB_DISTRICTS.map(d => [d.code.toLowerCase(), d]))

/** Translates a raw ResoProperty.city value to its consumer-friendly label. Non-Toronto cities pass through unchanged. */
export function getDisplayCity(rawCity: string): string {
  return byCityValue.get(rawCity.trim().toLowerCase())?.displayName ?? rawCity
}

// Build normalized-alias -> Set<code> candidates: bare code, full display name,
// and each "&"/"and"-delimited segment (so bare "Mimico" resolves to W06 without
// hand-authoring per-district alias lists). Segments/names that collide across
// multiple districts (e.g. "Weston" appears in both W03 and W04; "North York West"
// is both C06's full name and a segment of W05) are excluded entirely rather than
// guessed — an ambiguous term should fail visibly (no match), never silently
// resolve to the wrong district.
const candidates = new Map<string, Set<string>>()
function addCandidate(key: string, code: string) {
  if (!key) return
  if (!candidates.has(key)) candidates.set(key, new Set())
  candidates.get(key)!.add(code)
}
for (const d of TRREB_DISTRICTS) {
  addCandidate(d.code.toLowerCase(), d.code)
  const fullName = normalize(d.displayName)
  addCandidate(fullName, d.code)
  for (const segment of fullName.split(' and ')) addCandidate(segment.trim(), d.code)
}

const aliasMap = new Map<string, TrrebDistrict>()
for (const [key, codes] of candidates) {
  if (codes.size === 1) aliasMap.set(key, byCode.get([...codes][0].toLowerCase())!)
}

/**
 * Tolerant search resolver — accepts a TRREB code, the full display label
 * (with or without punctuation/"Toronto"), or a bare neighbourhood segment
 * (e.g. "Mimico"), and resolves it to the canonical district. Case,
 * whitespace, punctuation, and "&" vs "and" insensitive. Returns undefined
 * for unrecognized or ambiguous input — callers should fall back to their
 * existing behavior in that case.
 */
export function resolveDistrictSearchTerm(input: string): TrrebDistrict | undefined {
  const key = normalize(input)
  if (!key) return undefined
  return aliasMap.get(key)
}
