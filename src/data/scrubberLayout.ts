import type { TreeGroup } from './types';

// Compressed timeline axis: within a group the axis is 1:1 with real
// elapsed milliseconds (so playback at x1 is genuinely real-time paced
// while actively counting), but the *gap between groups* always collapses
// to a small fixed compressed width, no matter how long the real gap was
// (hours or months) — otherwise "real time" would mean sitting through
// multi-week idle stretches, and a big speed multiplier would still take
// a very long time to cross the whole survey period.
const GAP_UNIT_MS = 45_000;
const MIN_GROUP_SPAN_MS = 20_000;

interface AxisSegment {
  kind: 'group' | 'gap';
  groupIndex: number;
  realStart: number;
  realEnd: number;
  xStart: number;
  xEnd: number;
}

export interface TimelineAxis {
  segments: AxisSegment[];
  minX: number;
  maxX: number;
  minCalendarMs: number;
  maxCalendarMs: number;
}

export function buildTimelineAxis(groups: TreeGroup[]): TimelineAxis {
  if (groups.length === 0) {
    return { segments: [], minX: 0, maxX: 0, minCalendarMs: 0, maxCalendarMs: 0 };
  }

  const segments: AxisSegment[] = [];
  let x = 0;

  groups.forEach((group, i) => {
    const realSpan = group.endTime - group.startTime;
    const xSpan = Math.max(realSpan, MIN_GROUP_SPAN_MS);
    segments.push({
      kind: 'group',
      groupIndex: i,
      realStart: group.startTime,
      realEnd: group.endTime,
      xStart: x,
      xEnd: x + xSpan,
    });
    x += xSpan;

    const next = groups[i + 1];
    if (next) {
      segments.push({
        kind: 'gap',
        groupIndex: i,
        realStart: group.endTime,
        realEnd: next.startTime,
        xStart: x,
        xEnd: x + GAP_UNIT_MS,
      });
      x += GAP_UNIT_MS;
    }
  });

  return {
    segments,
    minX: 0,
    maxX: x,
    minCalendarMs: groups[0].startTime,
    maxCalendarMs: groups[groups.length - 1].endTime,
  };
}

export function timeToX(axis: TimelineAxis, calendarMs: number): number {
  if (axis.segments.length === 0) return 0;
  if (calendarMs <= axis.minCalendarMs) return axis.minX;
  if (calendarMs >= axis.maxCalendarMs) return axis.maxX;

  for (const seg of axis.segments) {
    if (calendarMs <= seg.realEnd) {
      const realSpan = seg.realEnd - seg.realStart || 1;
      const fraction = (calendarMs - seg.realStart) / realSpan;
      return seg.xStart + fraction * (seg.xEnd - seg.xStart);
    }
  }
  return axis.maxX;
}

export function xToTime(axis: TimelineAxis, x: number): number {
  if (axis.segments.length === 0) return 0;
  if (x <= axis.minX) return axis.minCalendarMs;
  if (x >= axis.maxX) return axis.maxCalendarMs;

  for (const seg of axis.segments) {
    if (x <= seg.xEnd) {
      const xSpan = seg.xEnd - seg.xStart || 1;
      const fraction = (x - seg.xStart) / xSpan;
      return seg.realStart + fraction * (seg.realEnd - seg.realStart);
    }
  }
  return axis.maxCalendarMs;
}
