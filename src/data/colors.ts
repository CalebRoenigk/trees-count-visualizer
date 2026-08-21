import type { HealthRating, Tree } from './types';

// Single source of truth for every color used in JS-driven visuals (map
// paint expressions, legend gradient) — avoids hex drift between TS and CSS.
export const HEALTH_COLORS: Record<HealthRating, string> = {
  Dead: '#4a4a46',
  Poor: '#c1544a',
  Fair: '#d99a45',
  Good: '#9fb98a',
  Excellent: '#5f8f5a',
};

export const HEALTH_ORDER: HealthRating[] = ['Dead', 'Poor', 'Fair', 'Good', 'Excellent'];

// Trees marked "Cannot be Found" carry stale leftover health data from the
// original staff-seeded record, not anything actually observed — shown as
// this neutral color in health mode instead of a misleadingly real rating.
export const UNVERIFIED_HEALTH_COLOR = '#8C8E82';

const SPECIES_PALETTE = [
  '#8a9a5b',
  '#c98a4b',
  '#6b8f9e',
  '#b4694e',
  '#7a9e7e',
  '#a98abf',
  '#c2a24e',
  '#5e8a7a',
  '#af7d9e',
  '#7c8ba1',
];

export const OTHER_SPECIES_COLOR = '#9a9488';

export interface SpeciesColorMap {
  colorFor: (species: string) => string;
  topSpecies: { species: string; color: string; count: number }[];
  hasOther: boolean;
}

export function assignSpeciesColors(trees: Tree[]): SpeciesColorMap {
  const counts = new Map<string, number>();
  for (const tree of trees) {
    counts.set(tree.species, (counts.get(tree.species) ?? 0) + 1);
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked.slice(0, SPECIES_PALETTE.length);
  const colorByName = new Map<string, string>();
  top.forEach(([species], i) => colorByName.set(species, SPECIES_PALETTE[i]));

  return {
    colorFor: (species) => colorByName.get(species) ?? OTHER_SPECIES_COLOR,
    topSpecies: top.map(([species, count]) => ({
      species,
      color: colorByName.get(species)!,
      count,
    })),
    hasOther: ranked.length > top.length,
  };
}

export interface SpeciesEntry {
  species: string;
  color: string;
  count: number;
}

/**
 * Species breakdown for a specific subset of trees (e.g. only the ones
 * currently on screen), reusing the stable global color assignment from
 * `colorMap` so a species never changes color as the camera moves.
 */
export function speciesEntriesFor(trees: Tree[], colorMap: SpeciesColorMap): {
  entries: SpeciesEntry[];
  hasOther: boolean;
} {
  const counts = new Map<string, number>();
  for (const tree of trees) {
    counts.set(tree.species, (counts.get(tree.species) ?? 0) + 1);
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked.slice(0, SPECIES_PALETTE.length);

  return {
    entries: top.map(([species, count]) => ({ species, count, color: colorMap.colorFor(species) })),
    hasOther: ranked.length > top.length,
  };
}

const MIN_CIRCUMFERENCE = 4;
const MAX_CIRCUMFERENCE = 70;
const MIN_RADIUS = 5;
const MAX_RADIUS = 14;

export function circumferenceToRadius(circumferenceIn: number): number {
  const t = Math.min(
    1,
    Math.max(
      0,
      (circumferenceIn - MIN_CIRCUMFERENCE) / (MAX_CIRCUMFERENCE - MIN_CIRCUMFERENCE),
    ),
  );
  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
}
