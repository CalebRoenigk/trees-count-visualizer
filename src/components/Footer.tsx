import { AUTHOR_URL } from '@/data/config';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <div className={styles.footer}>
      <span>
        Data visualization created with data from NYC Parks Department. Map tiles &copy; OpenFreeMap, &copy;
        OpenStreetMap contributors.
      </span>
      <span>
        Created by{' '}
        <a href={AUTHOR_URL} target="_blank" rel="noreferrer">
          Caleb Roenigk
        </a>
      </span>
    </div>
  );
}
