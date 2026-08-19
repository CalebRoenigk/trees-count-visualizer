import { HEALTH_COLORS, HEALTH_ORDER, OTHER_SPECIES_COLOR, type SpeciesColorMap } from '@/data/colors';
import type { ColorMode } from './MapView';
import styles from './Legend.module.css';

interface LegendProps {
  mode: ColorMode;
  speciesColors: SpeciesColorMap;
}

export function Legend({ mode, speciesColors }: LegendProps) {
  if (mode === 'health') {
    const gradient = `linear-gradient(to right, ${HEALTH_ORDER.map((h) => HEALTH_COLORS[h]).join(', ')})`;
    return (
      <div className={styles.card}>
        <div className={styles.title}>Health Index</div>
        <div className={styles.gradient} style={{ background: gradient }} />
        <div className={styles.labels}>
          <span>Dead</span>
          <span>Poor</span>
          <span>Excellent</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.title}>Tree Type</div>
      <ul className={styles.speciesList}>
        {speciesColors.topSpecies.map(({ species, color }) => (
          <li key={species}>
            <span className={styles.swatch} style={{ background: color }} />
            {species}
          </li>
        ))}
        {speciesColors.hasOther && (
          <li>
            <span className={styles.swatch} style={{ background: OTHER_SPECIES_COLOR }} />
            Other
          </li>
        )}
      </ul>
    </div>
  );
}
