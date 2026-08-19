import * as maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { circumferenceToRadius, HEALTH_COLORS } from '@/data/colors';
import type { SpeciesColorMap } from '@/data/colors';
import type { Tree } from '@/data/types';
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

interface MapViewProps {
  visibleTrees: Tree[];
  colorMode: ColorMode;
  speciesColors: SpeciesColorMap;
  newlyPoppedIds: Set<string>;
  cursorPosition: { lon: number; lat: number } | null;
  hoveredId: string | null;
  pinnedId: string | null;
  onHoverTree: (id: string | null) => void;
  onClickTree: (id: string | null) => void;
}

function buildFeatureCollection(
  trees: Tree[],
  colorMode: ColorMode,
  speciesColors: SpeciesColorMap,
  newlyPoppedIds: Set<string>,
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: trees.map((t) => ({
      type: 'Feature',
      id: t.id,
      geometry: { type: 'Point', coordinates: [t.lon, t.lat] },
      properties: {
        id: t.id,
        species: t.species,
        circumferenceIn: t.circumferenceIn,
        radius: circumferenceToRadius(t.circumferenceIn),
        healthColor: HEALTH_COLORS[t.health],
        typeColor: speciesColors.colorFor(t.species),
        activeColor: colorMode === 'health' ? HEALTH_COLORS[t.health] : speciesColors.colorFor(t.species),
        isNew: newlyPoppedIds.has(t.id) ? 1 : 0,
      },
    })),
  };
}

export function MapView({
  visibleTrees,
  colorMode,
  speciesColors,
  newlyPoppedIds,
  cursorPosition,
  hoveredId,
  pinnedId,
  onHoverTree,
  onClickTree,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const rippleRef = useRef<maplibregl.Marker | null>(null);
  const loadedRef = useRef(false);

  const onHoverTreeRef = useRef(onHoverTree);
  const onClickTreeRef = useRef(onClickTree);
  useEffect(() => {
    onHoverTreeRef.current = onHoverTree;
    onClickTreeRef.current = onClickTree;
  }, [onHoverTree, onClickTree]);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: PROSPECT_PARK_CENTER,
      zoom: 15.2,
      attributionControl: false,
    });
    mapRef.current = map;

    // MapLibre owns `transform` on the marker's root element for
    // positioning, so the pulse animation lives on a nested child instead
    // of the root — otherwise the two `transform` writers fight and the
    // marker renders stuck near the map origin.
    const rippleEl = document.createElement('div');
    rippleEl.className = styles.rippleAnchor;
    const rippleInner = document.createElement('div');
    rippleInner.className = styles.ripple;
    rippleEl.appendChild(rippleInner);
    const ripple = new maplibregl.Marker({ element: rippleEl });
    rippleRef.current = ripple;

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
          'circle-radius': ['get', 'radius'],
          'circle-color': ['get', 'activeColor'],
          'circle-opacity': 0.9,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgb(243, 236, 220)',
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

      loadedRef.current = true;
    });

    return () => {
      loadedRef.current = false;
      ripple.remove();
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
      source.setData(buildFeatureCollection(visibleTrees, colorMode, speciesColors, newlyPoppedIds));
    };

    if (loadedRef.current) update();
    else map.once('load', update);
  }, [visibleTrees, colorMode, speciesColors, newlyPoppedIds]);

  useEffect(() => {
    const map = mapRef.current;
    const ripple = rippleRef.current;
    if (!map || !ripple) return;

    if (cursorPosition) {
      ripple.setLngLat([cursorPosition.lon, cursorPosition.lat]);
      if (!ripple.getElement().isConnected) ripple.addTo(map);
    } else {
      ripple.remove();
    }
  }, [cursorPosition]);

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
