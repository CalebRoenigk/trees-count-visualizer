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
  const [sliderPos, setSliderPos] = useState(0);

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

  const visibleTrees = useMemo(() => timedTrees.filter((t) => t.x <= cursorX), [timedTrees, cursorX]);

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

  const cursorPosition = useMemo<{ lon: number; lat: number } | null>(() => {
    if (visibleTrees.length === 0 || visibleTrees.length >= timedTrees.length) return null;
    const last = visibleTrees[visibleTrees.length - 1];
    const next = timedTrees[visibleTrees.length];
    if (!next) return null;
    const span = next.x - last.x || 1;
    const fraction = Math.min(1, Math.max(0, (cursorX - last.x) / span));
    return {
      lon: last.lon + (next.lon - last.lon) * fraction,
      lat: last.lat + (next.lat - last.lat) * fraction,
    };
  }, [visibleTrees, timedTrees, cursorX]);

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
    cursorPosition,
    play,
    pause,
    togglePlay,
    seekTo,
    setSliderPos,
    goToPrevGroup,
    goToNextGroup,
  };
}
