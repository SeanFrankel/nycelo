import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import { useEffect, useRef } from 'react'
import L from 'leaflet'

interface GeoFeature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: { type: string; coordinates: unknown }
}
interface GeoFC { type: 'FeatureCollection'; features: GeoFeature[] }

/** Ray-casting point-in-polygon for a ring of [lng, lat] pairs. */
function pointInRing(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

function pointInFeature(lat: number, lng: number, feat: GeoFeature): boolean {
  const g = feat.geometry
  if (g.type === 'Polygon') {
    return pointInRing(lat, lng, (g.coordinates as number[][][])[0])
  }
  if (g.type === 'MultiPolygon') {
    return (g.coordinates as number[][][][]).some((poly) => pointInRing(lat, lng, poly[0]))
  }
  return false
}

function findFeature(lat: number, lng: number, fc: GeoFC): GeoFeature | null {
  // 1. Exact containment check
  for (const feat of fc.features) {
    if (pointInFeature(lat, lng, feat)) return feat
  }
  // 2. Nearest centroid fallback for border-straddling points
  let best: GeoFeature | null = null
  let bestDist = Infinity
  for (const feat of fc.features) {
    const g = feat.geometry
    const ring: number[][] =
      g.type === 'Polygon'
        ? (g.coordinates as number[][][])[0]
        : (g.coordinates as number[][][][])[0][0]
    const sumLng = ring.reduce((s, c) => s + c[0], 0) / ring.length
    const sumLat = ring.reduce((s, c) => s + c[1], 0) / ring.length
    const d = Math.hypot(sumLat - lat, sumLng - lng)
    if (d < bestDist) { bestDist = d; best = feat }
  }
  return best
}

// Load the GeoJSON once and cache it globally.
let geoCache: GeoFC | null = null
let geoPromise: Promise<GeoFC> | null = null
function loadGeo(): Promise<GeoFC> {
  if (geoCache) return Promise.resolve(geoCache)
  if (geoPromise) return geoPromise
  geoPromise = fetch(`${import.meta.env.BASE_URL}nyc-neighborhoods.geojson`)
    .then((r) => r.json())
    .then((d) => { geoCache = d; return d })
  return geoPromise
}

// ---- StaticBounds: fits the map once per pair, never animates ----
function StaticBounds({ latLngs }: { latLngs: [number, number][] }) {
  const map = useMap()
  const prevKey = useRef('')
  useEffect(() => {
    if (latLngs.length < 2) return
    const key = latLngs.map((ll) => `${ll[0].toFixed(4)},${ll[1].toFixed(4)}`).join('|')
    if (key === prevKey.current) return
    prevKey.current = key
    map.fitBounds(L.latLngBounds(latLngs), { padding: [28, 28], maxZoom: 14, animate: false })
  }, [map, latLngs])
  return null
}

// ---- NeighborhoodLayers: draws two polygon outlines from GeoJSON ----
function NeighborhoodLayers({
  a, b,
}: {
  a: { lat: number; lng: number } | undefined
  b: { lat: number; lng: number } | undefined
}) {
  const map = useMap()
  const layersRef = useRef<L.Layer[]>([])

  useEffect(() => {
    if (!a && !b) return
    let cancelled = false
    loadGeo().then((fc) => {
      if (cancelled) return
      layersRef.current.forEach((l) => l.remove())
      layersRef.current = []
      const sides: Array<{ hood: typeof a; color: string }> = [
        { hood: a, color: '#FF4500' },
        { hood: b, color: '#0044D6' },
      ]
      for (const { hood, color } of sides) {
        if (!hood) continue
        const feat = findFeature(hood.lat, hood.lng, fc)
        if (!feat) continue
        const layer = L.geoJSON(feat as Parameters<typeof L.geoJSON>[0], {
          style: { color, weight: 3, opacity: 0.9, fillColor: color, fillOpacity: 0.18 },
        }).addTo(map)
        layersRef.current.push(layer)
      }
    })
    return () => { cancelled = true }
  // Only re-run when actual coordinates change, not on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, a?.lat, a?.lng, b?.lat, b?.lng])

  return null
}

// ---- Public API ----

interface DualMapProps {
  a: { lat: number; lng: number; name: string } | undefined
  b: { lat: number; lng: number; name: string } | undefined
}

export function DualMap({ a, b }: DualMapProps) {
  const latLngs: [number, number][] = []
  if (a) latLngs.push([a.lat, a.lng])
  if (b) latLngs.push([b.lat, b.lng])

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer
        center={[40.7128, -74.006]}
        zoom={11}
        // Lock all interactions — this is a decorative thumbnail, not a live map.
        scrollWheelZoom={false}
        dragging={false}
        zoomControl={false}
        doubleClickZoom={false}
        keyboard={false}
        touchZoom={false}
        boxZoom={false}
        style={{ height: '100%', width: '100%', cursor: 'default' }}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png" />
        <NeighborhoodLayers a={a} b={b} />
        <StaticBounds latLngs={latLngs} />
      </MapContainer>
    </div>
  )
}

interface SingleMapProps {
  point: { lat: number; lng: number; name: string }
}

export function SingleMap({ point }: SingleMapProps) {
  return (
    <div className="w-full h-full relative z-0">
      <MapContainer
        center={[point.lat, point.lng]}
        zoom={13}
        scrollWheelZoom={false}
        dragging={false}
        zoomControl={false}
        doubleClickZoom={false}
        keyboard={false}
        style={{ height: '100%', width: '100%', cursor: 'default' }}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png" />
        <NeighborhoodLayers a={point} b={undefined} />
      </MapContainer>
    </div>
  )
}
