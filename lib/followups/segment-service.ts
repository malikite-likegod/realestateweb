/**
 * Segment Service
 *
 * Derives a follow-up cadence segment from existing Contact fields rather than
 * storing it directly — keeps a single source of truth (classification/status/tags)
 * instead of a field that can drift out of sync.
 *
 *   past_client → Contact.status === 'past_client'
 *   soi         → contact has a Tag named "SOI" (sphere of influence)
 *   hot/warm    → Contact.classification (as set by services/ai/lead-scoring.ts)
 *   cool        → Contact.classification === 'cold' (renamed for follow-up purposes only)
 */

export type FollowUpSegment = 'hot' | 'warm' | 'cool' | 'past_client' | 'soi'

export function resolveSegment(
  contact: { status: string; classification: string },
  tagNames: string[],
): FollowUpSegment {
  if (contact.status === 'past_client') return 'past_client'
  if (tagNames.some(name => name.toUpperCase() === 'SOI')) return 'soi'

  switch (contact.classification) {
    case 'hot':  return 'hot'
    case 'warm': return 'warm'
    default:     return 'cool' // 'cold' and any unrecognized value
  }
}
