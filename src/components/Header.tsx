import styles from './Header.module.css';

export function Header() {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>Timeline Viewer</h1>
      <p className={styles.subtitle}>
        Timeline visualization for Caleb Roenigk&rsquo;s TreesCount 2025 counting.
        <br />
        Covers the duration of tree counting for 2025 and 2026.
      </p>
    </div>
  );
}
