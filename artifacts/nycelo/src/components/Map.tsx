import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import L from 'leaflet'

// Fix Leaflet default icon issues in React
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Create brutalist custom markers
const createCustomIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border: 3px solid #1A1A1A; border-radius: 50%; box-shadow: 2px 2px 0px 0px #1A1A1A;"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

const redIcon = createCustomIcon('#FF4500')
const blueIcon = createCustomIcon('#0044D6')

// Component to handle auto-zooming to fit markers
function MapBounds({ markers }: { markers: Array<{lat: number, lng: number}> }) {
  const map = useMap()
  
  useEffect(() => {
    if (markers.length === 2) {
      const bounds = L.latLngBounds(
        [markers[0].lat, markers[0].lng],
        [markers[1].lat, markers[1].lng]
      )
      // Pad bounds a bit so markers aren't on the edge
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
    }
  }, [map, markers])
  
  return null
}

interface SingleMapProps {
  point: { lat: number, lng: number, name: string }
}

export function SingleMap({ point }: SingleMapProps) {
  return (
    <div className="w-full h-full relative z-0">
      <MapContainer
        center={[point.lat, point.lng]}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <Marker position={[point.lat, point.lng]} icon={redIcon}>
          <Popup className="font-mono font-bold">{point.name}</Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}

interface DualMapProps {
  a: { lat: number, lng: number, name: string } | undefined
  b: { lat: number, lng: number, name: string } | undefined
}

export function DualMap({ a, b }: DualMapProps) {
  const markers = []
  if (a) markers.push(a)
  if (b) markers.push(b)
    
  // Default to NYC center if nothing available
  const center: [number, number] = [40.7128, -74.0060]

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer 
        center={center} 
        zoom={11} 
        scrollWheelZoom={false} 
        style={{ height: '100%', width: '100%' }}
        attributionControl={false}
      >
        {/* Voyager basemap for a cleaner look */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {a && (
          <Marker position={[a.lat, a.lng]} icon={redIcon}>
            <Popup className="font-mono font-bold">{a.name}</Popup>
          </Marker>
        )}
        {b && (
          <Marker position={[b.lat, b.lng]} icon={blueIcon}>
            <Popup className="font-mono font-bold">{b.name}</Popup>
          </Marker>
        )}
        <MapBounds markers={markers} />
      </MapContainer>
    </div>
  )
}
