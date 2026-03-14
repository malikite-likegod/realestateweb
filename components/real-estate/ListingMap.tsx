'use client'

import { MapPin } from 'lucide-react'

interface MapMarker {
  lat: number
  lng: number
  title: string
  price?: number
}

interface ListingMapProps {
  markers?: MapMarker[]
  center?: { lat: number; lng: number }
  zoom?: number
  height?: string
}

// Placeholder map component — replace with Mapbox or Google Maps integration
export function ListingMap({ markers = [], height = '400px' }: ListingMapProps) {
  return (
    <div
      className="relative rounded-2xl overflow-hidden bg-charcoal-100 flex items-center justify-center border border-charcoal-200"
      style={{ height }}
    >
      <div className="text-center text-charcoal-400">
        <MapPin size={32} className="mx-auto mb-2 text-charcoal-300" />
        <p className="text-sm font-medium">Interactive Map</p>
        <p className="text-xs mt-1">{markers.length} properties in view</p>
        <p className="text-xs mt-3 text-charcoal-300">
          Connect NEXT_PUBLIC_GOOGLE_MAPS_KEY or Mapbox token to enable
        </p>
      </div>
    </div>
  )
}
