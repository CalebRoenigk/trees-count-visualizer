import * as maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { circumferenceToRadius, HEALTH_COLORS, UNVERIFIED_HEALTH_COLOR } from '@/data/colors';
import type { SpeciesColorMap } from '@/data/colors';
import type { GroupBounds, Tree } from '@/data/types';
import mapStyleRaw from '@/map/style.json';
import styles from './MapView.module.css';

// maplibre-gl's worker script imports a sibling "shared" chunk via a
// relative path at runtime, which defeats Vite/Rollup's static
// worker-asset bundling (only the worker file gets discovered, its
// sibling 404s, and every tile request silently never fires). Both
// files are vendored verbatim into public/maplibre-worker/ (kept
// together, unhashed, next to each other) so the relative import
// resolves the same way in dev and production. Re-copy them from
// node_modules/maplibre-gl/dist/ if the maplibre-gl version changes.
maplibregl.setWorkerUrl(`${import.meta.env.BASE_URL}maplibre-worker/maplibre-gl-worker.mjs`);

const mapStyle = mapStyleRaw as unknown as maplibregl.StyleSpecification;

export type ColorMode = 'health' | 'type';

const PROSPECT_PARK_CENTER: [number, number] = [-73.972, 40.6615];
const POP_TRANSITION_MS = 450;
const CAMERA_FLY_DURATION_MS = 1200;
// Extra margin around a group's bounds so the camera sits a bit further
// back than a tight fit — keeps trees from crowding the very edge of the
// frame once the pop-in/emphasis rings are factored in.
const CAMERA_PADDING = { top: 260, bottom: 340, left: 160, right: 400 };

// Keeps panning/zooming from wandering past NYC — a loose box around the
// five boroughs (Staten Island's western/southern tip, the Bronx's
// northern edge, Queens' eastern border), not a tight administrative
// boundary. maxBounds fits this box to whichever viewport dimension binds
// first, so a wide browser window may still reveal a bit past the edge —
// expected, not worth chasing per-aspect-ratio bounds for.
const NYC_MAX_BOUNDS: maplibregl.LngLatBoundsLike = [
  [-74.28, 40.47],
  [-73.68, 40.93],
];

interface MapViewProps {
  trees: Tree[];
  visibleIds: Set<string>;
  colorMode: ColorMode;
  speciesColors: SpeciesColorMap;
  newlyPoppedIds: Set<string>;
  activeGroupBounds: GroupBounds | null;
  hoveredId: string | null;
  pinnedId: string | null;
  onHoverTree: (id: string | null) => void;
  onClickTree: (id: string | null) => void;
  onViewportTreesChange: (ids: Set<string>) => void;
  onCameraTransitionChange: (transitioning: boolean) => void;
}

function buildFeatureCollection(
  trees: Tree[],
  visibleIds: Set<string>,
  colorMode: ColorMode,
  speciesColors: SpeciesColorMap,
  newlyPoppedIds: Set<string>,
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: trees.map((t) => {
      const visible = visibleIds.has(t.id);
      // "Cannot be Found" trees carry stale, unverified health data left
      // over from the original staff-seeded record — flagged with a
      // neutral color in health mode rather than a misleading real rating.
      const healthColor =
        t.raw.TC25_TreePresenceReason === 'Cannot be Found' ? UNVERIFIED_HEALTH_COLOR : HEALTH_COLORS[t.health];
      const typeColor = speciesColors.colorFor(t.species);
      return {
        type: 'Feature',
        id: t.id,
        geometry: { type: 'Point', coordinates: [t.lon, t.lat] },
        properties: {
          id: t.id,
          species: t.species,
          circumferenceIn: t.circumferenceIn,
          radius: visible ? circumferenceToRadius(t.circumferenceIn) : 0,
          fillOpacity: visible ? 0.9 : 0,
          strokeOpacity: visible ? 1 : 0,
          healthColor,
          typeColor,
          activeColor: colorMode === 'health' ? healthColor : typeColor,
          isNew: newlyPoppedIds.has(t.id) ? 1 : 0,
        },
      };
    }),
  };
}

export function MapView({
  trees,
  visibleIds,
  colorMode,
  speciesColors,
  newlyPoppedIds,
  activeGroupBounds,
  hoveredId,
  pinnedId,
  onHoverTree,
  onClickTree,
  onViewportTreesChange,
  onCameraTransitionChange,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);

  const onHoverTreeRef = useRef(onHoverTree);
  const onClickTreeRef = useRef(onClickTree);
  const onViewportTreesChangeRef = useRef(onViewportTreesChange);
  const onCameraTransitionChangeRef = useRef(onCameraTransitionChange);
  const treesRef = useRef(trees);
  const visibleIdsRef = useRef(visibleIds);
  useEffect(() => {
    onHoverTreeRef.current = onHoverTree;
    onClickTreeRef.current = onClickTree;
    onViewportTreesChangeRef.current = onViewportTreesChange;
    onCameraTransitionChangeRef.current = onCameraTransitionChange;
    treesRef.current = trees;
    visibleIdsRef.current = visibleIds;
  }, [onHoverTree, onClickTree, onViewportTreesChange, onCameraTransitionChange, trees, visibleIds]);

  // Recomputes which currently-counted trees fall within the map's actual
  // rendered viewport (not just the active group's bounds — camera padding
  // and nearby-but-different-session clusters can put more on screen than
  // that). Assigned once the map loads; called on camera settle and on
  // every source update so newly-popped trees are reflected immediately.
  const recomputeViewportRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: PROSPECT_PARK_CENTER,
      zoom: 15.2,
      attributionControl: false,
      maxBounds: NYC_MAX_BOUNDS,
    });
    mapRef.current = map;

    map.on('load', () => {
      map.addSource('trees', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'tree-circles',
        type: 'circle',
        source: 'trees',
        paint: {
          // Scaled by zoom (not just the tree's own size) so markers
          // shrink at a borough- or city-wide view instead of dominating
          // the screen — a hand-tuned curve, not a literal ground-scale.
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            ['*', ['get', 'radius'], 0.15],
            12,
            ['*', ['get', 'radius'], 0.35],
            14,
            ['*', ['get', 'radius'], 0.65],
            16,
            ['*', ['get', 'radius'], 1],
            18,
            ['*', ['get', 'radius'], 1.15],
          ],
          'circle-radius-transition': { duration: POP_TRANSITION_MS },
          'circle-color': ['get', 'activeColor'],
          'circle-opacity': ['get', 'fillOpacity'],
          'circle-opacity-transition': { duration: POP_TRANSITION_MS },
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgb(250, 249, 245)',
          'circle-stroke-opacity': ['get', 'strokeOpacity'],
          'circle-stroke-opacity-transition': { duration: POP_TRANSITION_MS },
        },
      });

      map.addLayer({
        id: 'tree-new-badge',
        type: 'symbol',
        source: 'trees',
        filter: ['==', ['get', 'isNew'], 1],
        layout: {
          'text-field': '+',
          'text-size': 14,
          'text-font': ['Noto Sans Bold'],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(44, 40, 32, 0.45)',
          'text-halo-width': 1,
        },
      });

      map.on('mousemove', 'tree-circles', (e: maplibregl.MapLayerMouseEvent) => {
        map.getCanvas().style.cursor = 'pointer';
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) onHoverTreeRef.current(id);
      });
      map.on('mouseleave', 'tree-circles', () => {
        map.getCanvas().style.cursor = '';
        onHoverTreeRef.current(null);
      });
      map.on('click', (e: maplibregl.MapMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['tree-circles'] });
        const id = features[0]?.properties?.id as string | undefined;
        onClickTreeRef.current(id ?? null);
      });

      const recomputeViewport = () => {
        const bounds = map.getBounds();
        const ids = new Set(
          treesRef.current
            .filter((t) => visibleIdsRef.current.has(t.id) && bounds.contains([t.lon, t.lat]))
            .map((t) => t.id),
        );
        onViewportTreesChangeRef.current(ids);
      };
      recomputeViewportRef.current = recomputeViewport;
      map.on('moveend', recomputeViewport);

      loadedRef.current = true;
    });

    return () => {
      loadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const update = () => {
      const source = map.getSource('trees') as maplibregl.GeoJSONSource | undefined;
      if (!source) return;
      source.setData(buildFeatureCollection(trees, visibleIds, colorMode, speciesColors, newlyPoppedIds));
      recomputeViewportRef.current();
    };

    if (loadedRef.current) update();
    else map.once('load', update);
  }, [trees, visibleIds, colorMode, speciesColors, newlyPoppedIds]);

  // Camera glides to frame whichever group is currently active, so the
  // whole cluster of trees counted in that session is visible together.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeGroupBounds) return;

    const fly = () => {
      onCameraTransitionChangeRef.current(true);
      map.fitBounds(
        [
          [activeGroupBounds.minLon, activeGroupBounds.minLat],
          [activeGroupBounds.maxLon, activeGroupBounds.maxLat],
        ],
        {
          padding: CAMERA_PADDING,
          maxZoom: 17,
          duration: CAMERA_FLY_DURATION_MS,
          essential: true,
        },
      );
      // A plain timeout (rather than a `moveend` listener) sidesteps any
      // ambiguity from a fast-following group change interrupting this
      // flight mid-animation and re-triggering its own moveend.
      window.setTimeout(() => onCameraTransitionChangeRef.current(false), CAMERA_FLY_DURATION_MS);
    };

    if (loadedRef.current) fly();
    else map.once('load', fly);
  }, [activeGroupBounds]);

  const emphasizedId = pinnedId ?? hoveredId;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    map.setPaintProperty('tree-circles', 'circle-stroke-width', [
      'case',
      ['==', ['get', 'id'], emphasizedId ?? ''],
      3,
      1.5,
    ]);
  }, [emphasizedId]);

  return <div ref={containerRef} className={styles.mapContainer} />;
}
