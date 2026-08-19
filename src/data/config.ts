import type { RawSurveyTree } from './types';

// Real export may include other volunteers' rows (it's a spatial-joined
// borough-wide dataset) — only Caleb's own counts should appear on the
// timeline. Likely needs a one-line tweak once the real Creator string is seen.
export const CALEB_IDENTIFIERS = ['crdotx@gmail.com', 'Caleb Roenigk'];

export function isCalebRecord(raw: RawSurveyTree): boolean {
  const creator = raw.Creator?.trim().toLowerCase();
  if (!creator) return false;
  return CALEB_IDENTIFIERS.some((id) => id.toLowerCase() === creator);
}

// Gap threshold that splits the chronological tree sequence into groups.
export const GAP_THRESHOLD_MS = 60 * 60 * 1000;

export const DATA_URL = `${import.meta.env.BASE_URL}data/trees.json`;

export const AUTHOR_URL = 'https://github.com/CalebRoenigk';
