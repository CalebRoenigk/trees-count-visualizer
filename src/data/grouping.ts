import { GAP_THRESHOLD_MS } from './config';
import type { Tree, TreeGroup } from './types';

/**
 * Splits trees (must already be sorted by createdAt ascending) into groups:
 * a gap greater than gapMs between consecutive trees starts a new group.
 */
export function groupTreesByGap(sortedTrees: Tree[], gapMs = GAP_THRESHOLD_MS): TreeGroup[] {
  if (sortedTrees.length === 0) return [];

  const groups: TreeGroup[] = [];
  let current: TreeGroup = {
    id: `group-0`,
    startTime: sortedTrees[0].createdAt.getTime(),
    endTime: sortedTrees[0].createdAt.getTime(),
    treeIds: [sortedTrees[0].id],
  };

  for (let i = 1; i < sortedTrees.length; i++) {
    const tree = sortedTrees[i];
    const t = tree.createdAt.getTime();
    const gap = t - current.endTime;

    if (gap > gapMs) {
      groups.push(current);
      current = {
        id: `group-${groups.length}`,
        startTime: t,
        endTime: t,
        treeIds: [tree.id],
      };
    } else {
      current.endTime = t;
      current.treeIds.push(tree.id);
    }
  }

  groups.push(current);
  return groups;
}
