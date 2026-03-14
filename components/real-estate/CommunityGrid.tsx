import { NeighborhoodCard } from './NeighborhoodCard'

interface Community {
  name: string
  slug: string
  description: string
  image: string
  listingCount?: number
}

interface CommunityGridProps {
  communities: Community[]
}

export function CommunityGrid({ communities }: CommunityGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {communities.map(c => (
        <NeighborhoodCard key={c.slug} {...c} />
      ))}
    </div>
  )
}
