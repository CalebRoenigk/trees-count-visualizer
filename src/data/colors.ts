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

// One hue per plant family ("major" species — the part before " - " in a
// name like "Oak - Pin Oak"; a standalone name like "London Planetree" is
// its own family of one). Members within a family share this hue and vary
// only in lightness, so e.g. every oak reads as a shade of the same brown
// while a totally different family (maples, say) reads as a different hue.
// Spaced ~30-38° apart around the wheel so adjacent families stay visually
// distinct even at low saturation (a tighter spacing reads as near-identical
// muted tones).
const FAMILY_HUES = [20, 100, 200, 320, 60, 160, 260, 0, 130, 230, 290, 350];
const FAMILY_SATURATION = 38;
const MIN_LIGHTNESS = 34;
const MAX_LIGHTNESS = 62;
const STANDALONE_LIGHTNESS = 46;
// Cap on distinguishable shades within one family — a family with more
// members than this (e.g. "Oak" has ~20) cycles back through the same
// steps rather than producing barely-different slivers of lightness.
const MAX_TONAL_STEPS = 6;

export const OTHER_SPECIES_COLOR = '#9a9488';

export interface SpeciesColorMap {
  colorFor: (species: string) => string;
  topSpecies: { species: string; color: string; count: number }[];
  hasOther: boolean;
}

const MAX_SPECIES_SHOWN = 10;

/** The part before " - " in a legacy-cleaned name like "Oak - Pin Oak", or
 * the whole name for a standalone species like "London Planetree". */
function familyOf(species: string): string {
  const i = species.indexOf(' - ');
  return i === -1 ? species : species.slice(0, i);
}

/** The part after " - ", for display — "Oak - Pin Oak" reads as "Pin Oak". */
export function speciesDisplayName(species: string): string {
  const i = species.indexOf(' - ');
  return i === -1 ? species : species.slice(i + 3);
}

export function assignSpeciesColors(trees: Tree[]): SpeciesColorMap {
  const counts = new Map<string, number>();
  for (const tree of trees) {
    counts.set(tree.species, (counts.get(tree.species) ?? 0) + 1);
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  // Colors are assigned to EVERY species seen, not just the top N shown in
  // the legend — a given viewport's most-common trees are usually far down
  // the *global* frequency ranking, so capping this to the global top N
  // left most on-screen trees falling back to flat gray.
  const familyOrder: string[] = [];
  const membersByFamily = new Map<string, string[]>();
  for (const [species] of ranked) {
    const family = familyOf(species);
    if (!membersByFamily.has(family)) {
      membersByFamily.set(family, []);
      familyOrder.push(family);
    }
    membersByFamily.get(family)!.push(species);
  }

  const colorByName = new Map<string, string>();
  familyOrder.forEach((family, hueIndex) => {
    const hue = FAMILY_HUES[hueIndex % FAMILY_HUES.length];
    const members = membersByFamily.get(family)!;
    const steps = Math.min(members.length, MAX_TONAL_STEPS);
    members.forEach((species, i) => {
      const lightness =
        steps === 1 ? STANDALONE_LIGHTNESS : MIN_LIGHTNESS + ((i % steps) * (MAX_LIGHTNESS - MIN_LIGHTNESS)) / (steps - 1);
      colorByName.set(species, `hsl(${hue}, ${FAMILY_SATURATION}%, ${lightness}%)`);
    });
  });

  const top = ranked.slice(0, MAX_SPECIES_SHOWN);
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
  const top = ranked.slice(0, MAX_SPECIES_SHOWN);

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
