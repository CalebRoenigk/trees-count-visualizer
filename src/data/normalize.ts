import { deriveLonLat } from './coords';
import type { HealthRating, RawSurveyTree, Tree } from './types';

const HEALTH_BUCKETS: Record<string, HealthRating> = {
  dead: 'Dead',
  poor: 'Poor',
  fair: 'Fair',
  good: 'Good',
  excellent: 'Excellent',
  critical: 'Dead',
};

// TC25 field values as surveyed (not a rating scale by name, but each maps to
// a rough severity 0-4 used only when Condition itself is missing/"Unknown").
const ISSUE_SEVERITY: Record<string, number> = {
  'no issues': 0,
  'full and healthy': 0,
  'undetermined - seasonal l': 0,
  'litter/bbq coal': 1,
  'improper pruning': 1,
  cavities: 2,
  'damaged bark/wound': 2,
  'insect holes': 2,
  'sparse leaves': 2,
  'yellowing or browning leaves': 2,
  'insect damage': 2,
  'small dead branches': 2,
  mushrooms: 3,
  'large dead branches': 3,
  'dangling branches': 3,
};

// The real Condition field carries values like "Fair" or legacy-formatted
// "4 - Fair" (a leftover numbered-category prefix from an older inventory).
function stripConditionPrefix(value: string): string {
  return value.replace(/^\d+\s*-\s*/, '').trim();
}

// Prefer the surveyor's own overall Condition rating; fall back to a
// worst-of heuristic over the individual roots/trunk, branches, and leaves
// fields when Condition is missing or "Unknown".
export function deriveHealth(raw: RawSurveyTree): HealthRating {
  const declared = raw.Condition ? stripConditionPrefix(raw.Condition).toLowerCase() : '';
  if (declared && HEALTH_BUCKETS[declared]) return HEALTH_BUCKETS[declared];

  const statuses = [
    raw.TC25_TreeHealth_RootsTrunk1,
    raw.TC25_TreeHealth_RootsTrunk2,
    raw.TC25_TreeHealth_Branches1,
    raw.TC25_TreeHealth_Branches2,
    raw.TC25_TreeHealth_Leaves1,
    raw.TC25_TreeHealth_Leaves2,
  ]
    .filter((s): s is string => !!s)
    .map((s) => s.trim().toLowerCase());

  if (statuses.length === 0) return 'Fair';

  const worst = Math.max(...statuses.map((s) => ISSUE_SEVERITY[s] ?? 1));
  if (worst >= 4) return 'Dead';
  if (worst === 3) return 'Poor';
  if (worst === 2) return 'Fair';
  return 'Good';
}

export function deriveCircumference(raw: RawSurveyTree): number {
  if ((raw.TC25_TrunkCount ?? 0) > 1 && raw.TC25_MultistemDBH) {
    return raw.TC25_MultistemDBH;
  }
  return raw.TC25_Circumference_Trunk1 ?? raw.ExistingCircumference ?? 8;
}

export function normalizeTree(raw: RawSurveyTree): Tree | null {
  const lonLat = deriveLonLat(raw);
  if (!lonLat) {
    console.warn(`Dropping tree ${raw.TreeID ?? raw.OBJECTID}: no usable coordinates`);
    return null;
  }

  // EditDate is when the survey was actually done — CreationDate mostly
  // reflects when the (often staff-pre-seeded) record was first created.
  const createdAt = new Date(raw.EditDate);
  if (Number.isNaN(createdAt.getTime())) {
    console.warn(`Dropping tree ${raw.TreeID ?? raw.OBJECTID}: invalid EditDate`);
    return null;
  }

  const [lon, lat] = lonLat;

  return {
    id: raw.TreeID ?? String(raw.OBJECTID),
    sequenceNumber: 0, // assigned by loadTrees() once the full list is sorted
    lat,
    lon,
    createdAt,
    species: raw.Species?.trim() || raw.TC25_SpeciesUnlisted?.trim() || 'Unknown',
    circumferenceIn: deriveCircumference(raw),
    health: deriveHealth(raw),
    trunkStatus: raw.TC25_TreeHealth_RootsTrunk1 ?? 'Unknown',
    branchesStatus: raw.TC25_TreeHealth_Branches1 ?? 'Unknown',
    leavesStatus: raw.TC25_TreeHealth_Leaves1 ?? 'Unknown',
    parkName: raw.ParkName?.trim() || 'Unknown Park',
    boroughName: raw.BoroughName?.trim() || '',
    raw,
  };
}
