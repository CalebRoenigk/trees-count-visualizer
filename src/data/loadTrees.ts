import { DATA_URL } from './config';
import { normalizeTree } from './normalize';
import type { RawSurveyTree, Tree } from './types';

export async function loadTrees(): Promise<Tree[]> {
  const res = await fetch(DATA_URL);
  if (!res.ok) {
    throw new Error(`Failed to load ${DATA_URL}: ${res.status} ${res.statusText}`);
  }
  const raw: RawSurveyTree[] = await res.json();

  return raw
    .map(normalizeTree)
    .filter((t): t is Tree => t !== null)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}
