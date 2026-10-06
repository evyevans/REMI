/* ═══════════════════════════════════════════════════════════
   NEIGHBORHOOD LAYER — Renders ont_regions as dynamic polygons.
   Phase 5+ enhancement: boundaries loaded from Supabase per market.
   ⚠️  Miami hardcodes purged in Geographic Identity Purge v1.
   ═══════════════════════════════════════════════════════════ */

import { Polygon, Tooltip } from 'react-leaflet';

// Neighborhoods are now injected as props from the market context.
// They come from the discovered_neighborhoods store which is populated
// after a scan completes from the Jina Orchestrator pipeline.
interface NeighborhoodEntry {
  name: string;
  centroid: { lat: number; lng: number };
  /** Optional bounding box: [swLat, swLng, neLat, neLng] */
  bbox?: [number, number, number, number];
  color?: string;
}

const FALLBACK_COLORS = [
  '#E8733A', '#D4A843', '#4A9E6B', '#5A7EA6', '#C9503C',
  '#8B5E3C', '#2B8A9E',
];

function bboxToPositions(bbox: [number, number, number, number]): [number, number][] {
  const [swLat, swLng, neLat, neLng] = bbox;
  return [
    [swLat, swLng],
    [neLat, swLng],
    [neLat, neLng],
    [swLat, neLng],
  ];
}

/* ═══ MAIN COMPONENT ═════════════════════════════════════ */

interface NeighborhoodLayerProps {
  visible: boolean;
  neighborhoods?: NeighborhoodEntry[];
  onRegionClick?: (name: string) => void;
}

export default function NeighborhoodLayer({
  visible,
  neighborhoods = [],
  onRegionClick
}: NeighborhoodLayerProps) {
  if (!visible || neighborhoods.length === 0) return null;

  return (
    <>
      {neighborhoods.map((n, idx) => {
        if (!n.bbox) return null;
        const color = n.color ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
        return (
          <Polygon
            key={n.name}
            positions={bboxToPositions(n.bbox)}
            pathOptions={{
              color,
              weight: 2,
              opacity: 0.7,
              fillColor: color,
              fillOpacity: 0.08,
            }}
            eventHandlers={{
              click: () => onRegionClick?.(n.name),
              mouseover: (e) => {
                const layer = e.target;
                layer.setStyle({ fillOpacity: 0.2, weight: 3 });
              },
              mouseout: (e) => {
                const layer = e.target;
                layer.setStyle({ fillOpacity: 0.08, weight: 2 });
              },
            }}
          >
            <Tooltip sticky className="neighborhood-tooltip">
              <div className="text-xs font-semibold">{n.name}</div>
            </Tooltip>
          </Polygon>
        );
      })}
    </>
  );
}
