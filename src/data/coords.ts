import proj4 from 'proj4';
import type { RawSurveyTree } from './types';

// NAD83 / New York Long Island (ftUS) — the projection NYC Parks datasets
// use for XCoordinate/YCoordinate. Not registered in proj4 by default.
const EPSG_2263 =
  '+proj=lcc +lat_0=40.1666666666667 +lon_0=-74 +lat_1=41.0333333333333 ' +
  '+lat_2=40.6666666666667 +x_0=300000 +y_0=0 +ellps=GRS80 ' +
  '+towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs +type=crs';

proj4.defs('EPSG:2263', EPSG_2263);

function isWgs84Range(lon: number, lat: number): boolean {
  return lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
}

/** Returns [lon, lat] in WGS84, projected from XCoordinate/YCoordinate (NY
 * State Plane feet, EPSG:2263). Returns null if coordinates are missing or
 * don't project into a valid range. */
export function deriveLonLat(raw: RawSurveyTree): [number, number] | null {
  if (typeof raw.XCoordinate === 'number' && typeof raw.YCoordinate === 'number') {
    const [lon, lat] = proj4('EPSG:2263', 'WGS84', [raw.XCoordinate, raw.YCoordinate]);
    if (isWgs84Range(lon, lat)) return [lon, lat];
  }

  return null;
}
