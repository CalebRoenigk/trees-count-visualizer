import { useCallback, useRef } from 'react';
import type { TreeGroup } from '@/data/types';
import type { TimelineAxis } from '@/data/scrubberLayout';
import styles from './TimelineScrubber.module.css';

interface TimelineScrubberProps {
  axis: TimelineAxis;
  groups: TreeGroup[];
  activeGroupIndex: number;
  cursorX: number;
  onSeek: (x: number) => void;
}

export function TimelineScrubber({ axis, groups, activeGroupIndex, cursorX, onSeek }: TimelineScrubberProps) {
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

        {groups.map((group, i) => {
          const segment = axis.segments.find((s) => s.kind === 'group' && s.groupIndex === i);
          if (!segment) return null;

          const left = pct(segment.xStart);
          const width = Math.max(pct(segment.xEnd) - pct(segment.xStart), 0.35);
          const span = segment.xEnd - segment.xStart || 1;
          const progress = Math.min(1, Math.max(0, (cursorX - segment.xStart) / span));
          const isActive = i === activeGroupIndex;

          return (
            <div
              key={group.id}
              className={isActive ? styles.groupBlockActive : styles.groupBlock}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${group.parkName} — ${group.treeIds.length} trees`}
            >
              <div className={styles.groupBlockFill} style={{ width: `${progress * 100}%` }} />
            </div>
          );
        })}

        <div className={styles.playhead} style={{ left: `${pct(cursorX)}%` }} />
      </div>
    </div>
  );
}
