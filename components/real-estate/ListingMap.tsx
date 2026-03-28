'use client'

import { APIProvider, Map, AdvancedMarker, InfoWindow, Pin } from '@vis.gl/react-google-maps'
import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

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

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ''

function MapContent({ markers, center, zoom }: { markers: MapMarker[]; center: { lat: number; lng: number }; zoom: number }) {
  const [activeMarker, setActiveMarker] = useState<number | null>(null)

  return (
    <Map
      defaultCenter={center}
      defaultZoom={zoom}
      mapId="listing-map"
      gestureHandling="greedy"
      disableDefaultUI={false}
    >
      {markers.map((marker, i) => (
        <AdvancedMarker
          key={i}
          position={{ lat: marker.lat, lng: marker.lng }}
          onClick={() => setActiveMarker(activeMarker === i ? null : i)}
        >
          <Pin background="#1a1a1a" borderColor="#1a1a1a" glyphColor="#f5f2ed" />
        </AdvancedMarker>
      ))}

      {activeMarker !== null && markers[activeMarker] && (
        <InfoWindow
          position={{ lat: markers[activeMarker].lat, lng: markers[activeMarker].lng }}
          onCloseClick={() => setActiveMarker(null)}
        >
          <div className="p-1 min-w-[140px]">
            <p className="font-semibold text-charcoal-900 text-sm leading-snug">{markers[activeMarker].title}</p>
            {markers[activeMarker].price && (
              <p className="text-charcoal-600 text-xs mt-0.5">{formatPrice(markers[activeMarker].price!)}</p>
            )}
          </div>
        </InfoWindow>
      )}
    </Map>
  )
}

export function ListingMap({ markers = [], center, zoom = 12, height = '400px' }: ListingMapProps) {
  if (!API_KEY) {
    return (
      <div
        className="relative rounded-2xl overflow-hidden bg-charcoal-100 flex items-center justify-center border border-charcoal-200"
        style={{ height }}
      >
        <div className="text-center text-charcoal-400">
          <MapPin size={32} className="mx-auto mb-2 text-charcoal-300" />
          <p className="text-sm font-medium">Interactive Map</p>
          <p className="text-xs mt-1">{markers.length} properties in view</p>
          <p className="text-xs mt-3 text-charcoal-300">Set NEXT_PUBLIC_GOOGLE_MAPS_KEY to enable</p>
        </div>
      </div>
    )
  }

  const mapCenter = center ?? (markers.length > 0
    ? { lat: markers.reduce((s, m) => s + m.lat, 0) / markers.length, lng: markers.reduce((s, m) => s + m.lng, 0) / markers.length }
    : { lat: 43.6532, lng: -79.3832 } // Toronto fallback
  )

  return (
    <div className="rounded-2xl overflow-hidden border border-charcoal-200" style={{ height }}>
      <APIProvider apiKey={API_KEY}>
        <MapContent markers={markers} center={mapCenter} zoom={zoom} />
      </APIProvider>
    </div>
  )
}
