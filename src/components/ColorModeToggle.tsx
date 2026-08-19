import type { ColorMode } from './MapView';
import styles from './ColorModeToggle.module.css';

interface ColorModeToggleProps {
  mode: ColorMode;
  onChange: (mode: ColorMode) => void;
}

export function ColorModeToggle({ mode, onChange }: ColorModeToggleProps) {
  return (
    <div className={styles.toggle} role="tablist" aria-label="Marker color mode">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'health'}
        className={mode === 'health' ? styles.activeTab : styles.tab}
        onClick={() => onChange('health')}
      >
        Tree Health
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'type'}
        className={mode === 'type' ? styles.activeTab : styles.tab}
        onClick={() => onChange('type')}
      >
        Tree Type
      </button>
    </div>
  );
}
