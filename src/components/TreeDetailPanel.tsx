import { speciesDisplayName } from '@/data/colors';
import type { Tree } from '@/data/types';
import styles from './TreeDetailPanel.module.css';

interface TreeDetailPanelProps {
  tree: Tree | null;
}

export function TreeDetailPanel({ tree }: TreeDetailPanelProps) {
  if (!tree) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.title}>Tree {tree.sequenceNumber}</div>
      <div className={styles.species}>{speciesDisplayName(tree.species)}</div>
      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt>Trunk</dt>
          <dd>{Math.round(tree.circumferenceIn)}&quot;</dd>
        </div>
        <div className={styles.row}>
          <dt>Trunk</dt>
          <dd>{tree.trunkStatus}</dd>
        </div>
        <div className={styles.row}>
          <dt>Branches</dt>
          <dd>{tree.branchesStatus}</dd>
        </div>
        <div className={styles.row}>
          <dt>Leaves</dt>
          <dd>{tree.leavesStatus}</dd>
        </div>
        <div className={styles.row}>
          <dt>Health</dt>
          <dd>{tree.health}</dd>
        </div>
      </dl>
      <div className={styles.coords}>
        {tree.lat.toFixed(6)}, {tree.lon.toFixed(6)}
      </div>
    </div>
  );
}
