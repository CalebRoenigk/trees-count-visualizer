import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { groupTreesByGap } from '../data/grouping';
import { buildTimelineAxis, timeToX, xToTime, type TimelineAxis } from '../data/scrubberLayout';
import type { Tree, TreeGroup } from '../data/types';

const POP_HIGHLIGHT_MS = 600;
// speed = MAX_SPEED ** sliderPos, so the low end (near real-time, most
// useful for watching individual counts) isn't crammed into the first
// few percent of a linear slider.
const MAX_SPEED = 500;

export interface TimedTree extends Tree {
  x: number;
}

export interface UseTimelineEngineOptions {
  onTreePopIn?: (tree: Tree) => void;
}

export function useTimelineEngine(trees: Tree[], options: UseTimelineEngineOptions = {}) {
  const { onTreePopIn } = options;

  const groups = useMemo<TreeGroup[]>(() => groupTreesByGap(trees), [trees]);
  const axis = useMemo<TimelineAxis>(() => buildTimelineAxis(groups), [groups]);
  const timedTrees = useMemo<TimedTree[]>(
    () => trees.map((t) => ({ ...t, x: timeToX(axis, t.createdAt.getTime()) })),
    [trees, axis],
  );

  const [cursorX, setCursorX] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sliderPos, setSliderPos] = useState(0.8);

  const speed = MAX_SPEED ** sliderPos;

  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const cursorRef = useRef(0);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    cursorRef.current = 0;
    setCursorX(0);
  }, [axis]);

  const clamp = useCallback((x: number) => Math.min(axis.maxX, Math.max(axis.minX, x)), [axis]);

  const seekTo = useCallback(
    (x: number) => {
      const clamped = clamp(x);
      cursorRef.current = clamped;
      setCursorX(clamped);
    },
    [clamp],
  );

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const togglePlay = useCallback(() => setIsPlaying((p) => !p), []);

  useEffect(() => {
    if (!isPlaying) {
      lastFrameRef.current = null;
      return;
    }

    const tick = (now: number) => {
      if (lastFrameRef.current === null) lastFrameRef.current = now;
      const dt = now - lastFrameRef.current;
      lastFrameRef.current = now;

      const next = clamp(cursorRef.current + dt * speedRef.current);
      cursorRef.current = next;
      setCursorX(next);

      if (next >= axis.maxX) {
        setIsPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, axis.maxX, clamp]);

  // Pop-in tracking: diff the visible-id set only when the cursor moves
  // forward, so scrubbing backward never re-triggers the "+" flash.
  const prevVisibleIdsRef = useRef<Set<string>>(new Set());
  const prevCursorRef = useRef(0);
  const [poppedAt, setPoppedAt] = useState<Map<string, number>>(new Map());

  // timedTrees is sorted by .x (a monotonic transform of createdAt), so the
  // visible set is always its leading prefix — found in O(log n) instead of
  // an O(n) scan every frame, and — more importantly — kept at the *same*
  // array reference across frames where the prefix length hasn't changed.
  // Without that, this recomputed on every rAF tick during playback (every
  // frame, not just when a tree actually popped in), which cascaded into
  // MapView rebuilding and re-submitting its entire GeoJSON source on every
  // frame regardless of whether anything changed — fine at a few hundred
  // trees, but a real jank source at thousands.
  const visibleTreesCacheRef = useRef<{ timedTrees: TimedTree[]; count: number; result: TimedTree[] }>({
    timedTrees: [],
    count: 0,
    result: [],
  });
  const visibleTrees = useMemo(() => {
    let lo = 0;
    let hi = timedTrees.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (timedTrees[mid].x <= cursorX) lo = mid + 1;
      else hi = mid;
    }
    const count = lo;

    const cache = visibleTreesCacheRef.current;
    if (cache.timedTrees === timedTrees && cache.count === count) {
      return cache.result;
    }
    const result = timedTrees.slice(0, count);
    visibleTreesCacheRef.current = { timedTrees, count, result };
    return result;
  }, [timedTrees, cursorX]);

  useEffect(() => {
    const movedForward = cursorX >= prevCursorRef.current;
    prevCursorRef.current = cursorX;

    const currentIds = new Set(visibleTrees.map((t) => t.id));
    if (movedForward) {
      const now = performance.now();
      let changed = false;
      const next = new Map(poppedAt);
      for (const t of visibleTrees) {
        if (!prevVisibleIdsRef.current.has(t.id)) {
          next.set(t.id, now);
          changed = true;
          onTreePopIn?.(t);
        }
      }
      if (changed) setPoppedAt(next);
    }
    prevVisibleIdsRef.current = currentIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTrees]);

  // A fixed-cadence interval (not re-armed on every new pop-in) so
  // continuous pop-ins during fast playback can't keep postponing pruning.
  useEffect(() => {
    if (poppedAt.size === 0) return;
    const interval = setInterval(() => {
      const now = performance.now();
      setPoppedAt((current) => {
        let changed = false;
        const next = new Map(current);
        for (const [id, t] of next) {
          if (now - t > POP_HIGHLIGHT_MS) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : current;
      });
    }, 150);
    return () => clearInterval(interval);
  }, [poppedAt.size]);

  const newlyPoppedIds = useMemo(() => new Set(poppedAt.keys()), [poppedAt]);

  const cursorMs = useMemo(() => xToTime(axis, cursorX), [axis, cursorX]);

  const activeGroupIndex = useMemo(() => {
    if (groups.length === 0) return -1;
    for (let i = 0; i < groups.length; i++) {
      if (cursorMs <= groups[i].endTime) return i;
    }
    return groups.length - 1;
  }, [groups, cursorMs]);

  const goToGroup = useCallback(
    (index: number) => {
      const clampedIndex = Math.min(groups.length - 1, Math.max(0, index));
      const group = groups[clampedIndex];
      if (!group) return;
      setIsPlaying(false);
      seekTo(timeToX(axis, group.startTime));
    },
    [groups, axis, seekTo],
  );

  const goToPrevGroup = useCallback(() => {
    const idx = activeGroupIndex <= 0 ? 0 : activeGroupIndex - 1;
    goToGroup(idx);
  }, [activeGroupIndex, goToGroup]);

  const goToNextGroup = useCallback(() => {
    goToGroup(activeGroupIndex + 1);
  }, [activeGroupIndex, goToGroup]);

  const currentLocationLabel = useMemo(() => {
    if (visibleTrees.length === 0) return trees[0]?.parkName ?? '';
    return visibleTrees[visibleTrees.length - 1].parkName;
  }, [visibleTrees, trees]);

  return {
    groups,
    axis,
    timedTrees,
    visibleTrees,
    newlyPoppedIds,
    cursorX,
    cursorMs,
    isPlaying,
    sliderPos,
    speed,
    activeGroupIndex,
    currentLocationLabel,
    play,
    pause,
    togglePlay,
    seekTo,
    setSliderPos,
    goToPrevGroup,
    goToNextGroup,
  };
}
