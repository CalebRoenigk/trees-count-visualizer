import { useCallback, useRef } from 'react';
import type { TreeGroup } from '@/data/types';
import type { TimelineAxis } from '@/data/scrubberLayout';
import type { TimedTree } from '@/hooks/useTimelineEngine';
import styles from './TimelineScrubber.module.css';

interface TimelineScrubberProps {
  axis: TimelineAxis;
  groups: TreeGroup[];
  timedTrees: TimedTree[];
  activeGroupIndex: number;
  cursorX: number;
  onSeek: (x: number) => void;
}

export function TimelineScrubber({
  axis,
  groups,
  timedTrees,
  activeGroupIndex,
  cursorX,
  onSeek,
}: TimelineScrubberProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const pct = (x: number) => (axis.maxX > 0 ? (x / axis.maxX) * 100 : 0);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      onSeek(fraction * axis.maxX);
    },
    [axis.maxX, onSeek],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    seekFromClientX(e.clientX);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    seekFromClientX(e.clientX);
  };
  const handlePointerUp = () => {
    draggingRef.current = false;
  };

  const activeGroup = groups[activeGroupIndex];
  const activeSegment = axis.segments.find(
    (s) => s.kind === 'group' && s.groupIndex === activeGroupIndex,
  );

  return (
    <div className={styles.wrapper}>
      <div
        ref={trackRef}
        className={styles.track}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className={styles.baseline} />

        {activeGroup && activeSegment && (
          <div
            className={styles.activeBracket}
            style={{
              left: `${pct(activeSegment.xStart)}%`,
              width: `${Math.max(pct(activeSegment.xEnd) - pct(activeSegment.xStart), 0.6)}%`,
            }}
          />
        )}

        {timedTrees.map((t) => (
          <div
            key={t.id}
            className={t.x <= cursorX ? styles.tickPassed : styles.tick}
            style={{ left: `${pct(t.x)}%` }}
          />
        ))}

        <div className={styles.playhead} style={{ left: `${pct(cursorX)}%` }} />
      </div>
    </div>
  );
}
