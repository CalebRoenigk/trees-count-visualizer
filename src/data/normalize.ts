import { deriveLonLat } from './coords';
import type { HealthRating, RawSurveyTree, Tree } from './types';

const HEALTH_BUCKETS: Record<string, HealthRating> = {
  dead: 'Dead',
  poor: 'Poor',
  fair: 'Fair',
  good: 'Good',
  excellent: 'Excellent',
};

const ISSUE_SEVERITY: Record<string, number> = {
  dead: 4,
  'large dead': 4,
  poor: 3,
  'small dead': 2,
  'no issues': 0,
  healthy: 0,
};

// Prefer the surveyor's own overall determination; fall back to a worst-of
// heuristic over the individual roots/trunk, branches, and leaves fields.
// Likely needs a one-line tweak once real TC25_DetermineCondition strings are seen.
export function deriveHealth(raw: RawSurveyTree): HealthRating {
  const declared = raw.TC25_DetermineCondition?.trim().toLowerCase();
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
  return (
    raw.TC25_Circumference_Trunk1 ?? raw.ExistingCircumference ?? 8
  );
}

export function normalizeTree(raw: RawSurveyTree): Tree | null {
  const lonLat = deriveLonLat(raw);
  if (!lonLat) {
    console.warn(`Dropping tree ${raw.TreeID ?? raw.OBJECTID}: no usable coordinates`);
    return null;
  }

  const createdAt = new Date(raw.CreationDate);
  if (Number.isNaN(createdAt.getTime())) {
    console.warn(`Dropping tree ${raw.TreeID ?? raw.OBJECTID}: invalid CreationDate`);
    return null;
  }

  const [lon, lat] = lonLat;

  return {
    id: raw.TreeID ?? String(raw.OBJECTID),
    lat,
    lon,
    createdAt,
    creator: raw.Creator,
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
