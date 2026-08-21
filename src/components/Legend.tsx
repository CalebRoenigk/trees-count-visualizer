import { HEALTH_COLORS, HEALTH_ORDER, OTHER_SPECIES_COLOR, speciesDisplayName, type SpeciesEntry } from '@/data/colors';
import type { ColorMode } from './MapView';
import styles from './Legend.module.css';

interface LegendProps {
  mode: ColorMode;
  speciesEntries: SpeciesEntry[];
  hasOtherSpecies: boolean;
}

export function Legend({ mode, speciesEntries, hasOtherSpecies }: LegendProps) {
  if (mode === 'health') {
    // Hard-edged segments (not a blended gradient) — each rating gets its
    // own solid band, matching the discrete health buckets it represents.
    const segmentPct = 100 / HEALTH_ORDER.length;
    const stops = HEALTH_ORDER.flatMap((h, i) => {
      const color = HEALTH_COLORS[h];
      return [`${color} ${i * segmentPct}%`, `${color} ${(i + 1) * segmentPct}%`];
    });
    const gradient = `linear-gradient(to right, ${stops.join(', ')})`;
    return (
      <div className={styles.card}>
        <div className={styles.title}>Health Index</div>
        <div className={styles.gradient} style={{ background: gradient }} />
        <div className={styles.labels}>
          <span style={{ left: 0 }}>Dead</span>
          <span style={{ left: `${HEALTH_ORDER.indexOf('Poor') * segmentPct}%` }}>Poor</span>
          <span className={styles.labelLast}>Excellent</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.title}>Tree Type</div>
      <ul className={styles.speciesList}>
        {speciesEntries.map(({ species, color }) => (
          <li key={species}>
            <span className={styles.swatch} style={{ background: color }} />
            {speciesDisplayName(species)}
          </li>
        ))}
        {hasOtherSpecies && (
          <li>
            <span className={styles.swatch} style={{ background: OTHER_SPECIES_COLOR }} />
            Other
          </li>
        )}
      </ul>
    </div>
  );
}
