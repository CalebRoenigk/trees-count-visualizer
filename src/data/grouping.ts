import { GAP_THRESHOLD_MS } from './config';
import type { GroupBounds, Tree, TreeGroup } from './types';

function boundsFor(trees: Tree[]): GroupBounds {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const t of trees) {
    if (t.lon < minLon) minLon = t.lon;
    if (t.lon > maxLon) maxLon = t.lon;
    if (t.lat < minLat) minLat = t.lat;
    if (t.lat > maxLat) maxLat = t.lat;
  }
  return { minLon, minLat, maxLon, maxLat };
}

function expandBounds(bounds: GroupBounds, tree: Tree): GroupBounds {
  return {
    minLon: Math.min(bounds.minLon, tree.lon),
    minLat: Math.min(bounds.minLat, tree.lat),
    maxLon: Math.max(bounds.maxLon, tree.lon),
    maxLat: Math.max(bounds.maxLat, tree.lat),
  };
}

function startGroup(index: number, tree: Tree): TreeGroup {
  return {
    id: `group-${index}`,
    startTime: tree.createdAt.getTime(),
    endTime: tree.createdAt.getTime(),
    treeIds: [tree.id],
    bounds: boundsFor([tree]),
    parkName: tree.parkName,
  };
}

/**
 * Splits trees (must already be sorted by createdAt ascending) into groups:
 * a new group starts whenever the gap since the previous tree exceeds gapMs,
 * OR the park changes — a different park within the same hour is still a
 * different group, since it means a fresh, unrelated visit.
 */
export function groupTreesByGap(sortedTrees: Tree[], gapMs = GAP_THRESHOLD_MS): TreeGroup[] {
  if (sortedTrees.length === 0) return [];

  const groups: TreeGroup[] = [];
  let current = startGroup(0, sortedTrees[0]);

  for (let i = 1; i < sortedTrees.length; i++) {
    const tree = sortedTrees[i];
    const t = tree.createdAt.getTime();
    const gap = t - current.endTime;

    if (gap > gapMs || tree.parkName !== current.parkName) {
      groups.push(current);
      current = startGroup(groups.length, tree);
    } else {
      current.endTime = t;
      current.treeIds.push(tree.id);
      current.bounds = expandBounds(current.bounds, tree);
    }
  }

  groups.push(current);
  return groups;
}
