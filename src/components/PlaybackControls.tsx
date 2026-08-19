import styles from './PlaybackControls.module.css';

interface PlaybackControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPrevGroup: () => void;
  onNextGroup: () => void;
  sliderPos: number;
  onSliderPosChange: (pos: number) => void;
  speed: number;
}

function PrevGroupIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
      <rect x="2" y="2" width="1.6" height="12" />
      <path d="M14 3 L14 13 L6 8 Z" />
    </svg>
  );
}

function NextGroupIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
      <rect x="12.4" y="2" width="1.6" height="12" />
      <path d="M2 3 L2 13 L10 8 Z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M4 2.5 L14 8 L4 13.5 Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <rect x="3.5" y="2.5" width="3.2" height="11" />
      <rect x="9.3" y="2.5" width="3.2" height="11" />
    </svg>
  );
}

export function PlaybackControls({
  isPlaying,
  onTogglePlay,
  onPrevGroup,
  onNextGroup,
  sliderPos,
  onSliderPosChange,
  speed,
}: PlaybackControlsProps) {
  return (
    <div className={styles.row}>
      <div className={styles.transport}>
        <button type="button" aria-label="Previous group" onClick={onPrevGroup} className={styles.iconButton}>
          <PrevGroupIcon />
        </button>
        <button
          type="button"
          aria-label={isPlaying ? 'Pause' : 'Play'}
          onClick={onTogglePlay}
          className={styles.playButton}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button type="button" aria-label="Next group" onClick={onNextGroup} className={styles.iconButton}>
          <NextGroupIcon />
        </button>
      </div>

      <div className={styles.speed}>
        <span className={styles.speedLabel}>x1</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={sliderPos}
          onChange={(e) => onSliderPosChange(Number(e.target.value))}
          className={styles.slider}
          aria-label={`Playback speed, ${speed.toFixed(0)}x`}
        />
        <span className={styles.speedLabel}>x500</span>
      </div>
    </div>
  );
}
