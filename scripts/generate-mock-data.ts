// Generates public/data/trees.json in the real TreesCount 2025 export shape,
// so the app's normalization/coordinate/grouping layers are exercised
// honestly against something schema-shaped, not a hand-simplified stub.
// Run with: node scripts/generate-mock-data.ts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import proj4 from 'proj4';

proj4.defs(
  'EPSG:2263',
  '+proj=lcc +lat_0=40.1666666666667 +lon_0=-74 +lat_1=41.0333333333333 ' +
    '+lat_2=40.6666666666667 +x_0=300000 +y_0=0 +ellps=GRS80 ' +
    '+towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs +type=crs',
);

// --- seeded PRNG (mulberry32) for reproducible output -----------------
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20250816);
const randRange = (min: number, max: number) => min + rand() * (max - min);
const randInt = (min: number, max: number) => Math.floor(randRange(min, max + 1));

function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// --- bounding box (matches the mockup's Prospect Park cluster) --------
const BBOX = { minLat: 40.658, maxLat: 40.665, minLon: -73.976, maxLon: -73.968 };
const clampReflect = (v: number, min: number, max: number) => {
  if (v < min) return min + (min - v);
  if (v > max) return max - (v - max);
  return v;
};

// --- reference data -----------------------------------------------------
const SPECIES = [
  'Green Ash',
  'Pin Oak',
  'American Elm',
  'London Planetree',
  'Little-leaf Linden',
  'Honey Locust',
  'Norway Maple',
  'Sugar Maple',
  'Callery Pear',
  'Black Cherry',
];
const SPECIES_WEIGHTS = [22, 18, 14, 11, 9, 7, 6, 5, 4, 4];

const CALEB_CREATOR = 'crdotx@gmail.com';
const DECOY_CREATORS = [
  'jane.doe@example.com',
  'nyctreewatcher@example.com',
  'parkvolunteer22@example.com',
];

const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor', 'Dead'] as const;
const CONDITION_WEIGHTS = [15, 40, 30, 10, 5];

const HEALTH_PHRASES: Record<
  (typeof CONDITIONS)[number],
  { trunk: string[]; branches: string[]; leaves: string[] }
> = {
  Excellent: { trunk: ['No Issues'], branches: ['No Issues'], leaves: ['Healthy'] },
  Good: { trunk: ['No Issues', 'Minor Wounds'], branches: ['No Issues', 'Small Dead'], leaves: ['Healthy'] },
  Fair: { trunk: ['Minor Issues', 'Cracks'], branches: ['Small Dead', 'Crossing Branches'], leaves: ['Healthy', 'Some Wilting'] },
  Poor: { trunk: ['Major Issues', 'Decay'], branches: ['Large Dead', 'Broken Limbs'], leaves: ['Sparse', 'Discolored'] },
  Dead: { trunk: ['Dead'], branches: ['Dead'], leaves: ['None'] },
};

let objectId = 1;
const nextTreeId = () => String(6000 + objectId);

interface MockRow {
  OBJECTID: number;
  Shape?: { type: 'Point'; coordinates: [number, number] } | null;
  Join_Count: number;
  TARGET_FID: number;
  Structure: string;
  Condition: string;
  ExistingCircumference: number;
  PlantingSpaceID: string;
  TreeID: string;
  Species: string;
  StumpDiameter: null;
  BoroughName: string;
  CommunityBoard: string;
  ParkName: string;
  XCoordinate?: number | null;
  YCoordinate?: number | null;
  TreeGlobalID: string;
  PlantingSpaceGlobalID: string;
  RIGlobalID: string;
  TC25_TreePresence: string;
  TC25_TreePresenceReason: null;
  TC25_TreeStatus: string;
  TC25_SpeciesUnlisted: null;
  TC25_TrunkType: string;
  TC25_TrunkCount: number;
  TC25_Measurable: string;
  TC25_MeasurableReason: null;
  TC25_DetermineCondition: string;
  TC25_Circumference_Trunk1: number;
  TC25_Circumference_Trunk2: number | null;
  TC25_Circumference_Trunk3: number | null;
  TC25_Circumference_Trunk4: number | null;
  TC25_Circumference_Trunk5: number | null;
  TC25_MultistemDBH: number | null;
  TC25_Comments: string | null;
  TC25_SurveyCompleted: string;
  TC25_TreeHealth_RootsTrunk1: string;
  TC25_TreeHealth_RootsTrunk2: null;
  TC25_TreeHealth_Branches1: string;
  TC25_TreeHealth_Branches2: null;
  TC25_TreeHealth_Leaves1: string;
  TC25_TreeHealth_Leaves2: null;
  TC25_ZoneID: string;
  CreationDate: string;
  Creator: string;
  TC_SubCategory: string;
  TC_TypeCategory: string;
  EditDate: string;
  Editor: string;
  SubCategory: string;
  TypeCategory: string;
}

function makeRow(params: { lon: number; lat: number; createdAt: Date; creator: string; useShape: boolean }): MockRow {
  const { lon, lat, createdAt, creator, useShape } = params;
  const condition = weightedPick([...CONDITIONS], CONDITION_WEIGHTS);
  const phrases = HEALTH_PHRASES[condition];
  const isMultistem = rand() < 0.15;
  const trunkCount = isMultistem ? randInt(2, 4) : 1;
  const baseCircumference = Math.round(randRange(8, 60) * 10) / 10;
  const editDate = new Date(createdAt.getTime() + randInt(1, 5) * 24 * 60 * 60 * 1000);

  let xCoord: number | null = null;
  let yCoord: number | null = null;
  let shape: MockRow['Shape'] = null;

  if (useShape) {
    shape = { type: 'Point', coordinates: [lon, lat] };
  } else {
    const [x, y] = proj4('WGS84', 'EPSG:2263', [lon, lat]);
    xCoord = Math.round(x * 100) / 100;
    yCoord = Math.round(y * 100) / 100;
  }

  const id = objectId++;

  return {
    OBJECTID: id,
    Shape: shape,
    Join_Count: 1,
    TARGET_FID: id,
    Structure: 'Standard',
    Condition: condition,
    ExistingCircumference: baseCircumference,
    PlantingSpaceID: crypto.randomUUID(),
    TreeID: nextTreeId(),
    Species: weightedPick(SPECIES, SPECIES_WEIGHTS),
    StumpDiameter: null,
    BoroughName: 'Brooklyn',
    CommunityBoard: '306',
    ParkName: 'Prospect Park',
    XCoordinate: xCoord,
    YCoordinate: yCoord,
    TreeGlobalID: crypto.randomUUID(),
    PlantingSpaceGlobalID: crypto.randomUUID(),
    RIGlobalID: crypto.randomUUID(),
    TC25_TreePresence: 'Yes',
    TC25_TreePresenceReason: null,
    TC25_TreeStatus: condition === 'Dead' ? 'Dead' : 'Alive',
    TC25_SpeciesUnlisted: null,
    TC25_TrunkType: isMultistem ? 'Multistem' : 'Single Stem',
    TC25_TrunkCount: trunkCount,
    TC25_Measurable: 'Yes',
    TC25_MeasurableReason: null,
    TC25_DetermineCondition: condition,
    TC25_Circumference_Trunk1: baseCircumference,
    TC25_Circumference_Trunk2: trunkCount > 1 ? Math.round(randRange(6, 30) * 10) / 10 : null,
    TC25_Circumference_Trunk3: trunkCount > 2 ? Math.round(randRange(6, 30) * 10) / 10 : null,
    TC25_Circumference_Trunk4: trunkCount > 3 ? Math.round(randRange(6, 30) * 10) / 10 : null,
    TC25_Circumference_Trunk5: null,
    TC25_MultistemDBH: isMultistem ? Math.round(randRange(10, 40) * 10) / 10 : null,
    TC25_Comments: rand() < 0.08 ? 'Near path, slight lean.' : null,
    TC25_SurveyCompleted: 'Yes',
    TC25_TreeHealth_RootsTrunk1: weightedPick(phrases.trunk, phrases.trunk.map(() => 1)),
    TC25_TreeHealth_RootsTrunk2: null,
    TC25_TreeHealth_Branches1: weightedPick(phrases.branches, phrases.branches.map(() => 1)),
    TC25_TreeHealth_Branches2: null,
    TC25_TreeHealth_Leaves1: weightedPick(phrases.leaves, phrases.leaves.map(() => 1)),
    TC25_TreeHealth_Leaves2: null,
    TC25_ZoneID: '306-12',
    CreationDate: createdAt.toISOString(),
    Creator: creator,
    TC_SubCategory: 'Street Tree',
    TC_TypeCategory: 'Tree',
    EditDate: editDate.toISOString(),
    Editor: creator,
    SubCategory: 'Street Tree',
    TypeCategory: 'Tree',
  };
}

// --- session simulation ---------------------------------------------------
interface SessionResult {
  rows: MockRow[];
  times: Date[];
}

function simulateSession(sessionStart: Date): SessionResult {
  const treeCount = randInt(6, 12);
  const rows: MockRow[] = [];
  const times: Date[] = [];

  let lon = randRange(BBOX.minLon, BBOX.maxLon);
  let lat = randRange(BBOX.minLat, BBOX.maxLat);
  let t = sessionStart.getTime();
  const breakIndex = rand() < 0.35 ? randInt(2, treeCount - 2) : -1;

  for (let i = 0; i < treeCount; i++) {
    if (i === breakIndex) {
      t += randInt(10, 90) * 60 * 1000;
    } else if (i > 0) {
      t += randInt(45, 360) * 1000;
    }

    lon = clampReflect(lon + randRange(-0.0004, 0.0004), BBOX.minLon, BBOX.maxLon);
    lat = clampReflect(lat + randRange(-0.0004, 0.0004), BBOX.minLat, BBOX.maxLat);

    const createdAt = new Date(t);
    const useShape = rand() < 0.8;
    rows.push(makeRow({ lon, lat, createdAt, creator: CALEB_CREATOR, useShape }));
    times.push(createdAt);
  }

  return { rows, times };
}

function buildSessionStarts(): Date[] {
  const starts: Date[] = [];
  // 11 sessions across Aug-Oct 2025, walking-hour start times.
  const rangeStart = new Date('2025-08-02T00:00:00-04:00').getTime();
  const rangeEnd = new Date('2025-10-25T00:00:00-04:00').getTime();
  const fallCount = 11;
  for (let i = 0; i < fallCount; i++) {
    const dayOffset = rangeStart + (i / fallCount) * (rangeEnd - rangeStart) + randRange(0, 4) * 24 * 60 * 60 * 1000;
    const hour = randInt(8, 17);
    const minute = randInt(0, 59);
    const day = new Date(dayOffset);
    day.setHours(hour, minute, 0, 0);
    starts.push(day);
  }
  // 1 spring 2026 session ("counting continued into 2026").
  const spring2026 = new Date('2026-04-18T10:15:00-04:00');
  starts.push(spring2026);

  return starts.sort((a, b) => a.getTime() - b.getTime());
}

function buildDecoyRows(calebTimes: Date[]): MockRow[] {
  const decoyCount = Math.round(calebTimes.length * 0.12);
  const rows: MockRow[] = [];
  for (let i = 0; i < decoyCount; i++) {
    const anchor = calebTimes[randInt(0, calebTimes.length - 1)];
    const createdAt = new Date(anchor.getTime() + randInt(-30, 30) * 60 * 1000);
    const lon = randRange(BBOX.minLon, BBOX.maxLon);
    const lat = randRange(BBOX.minLat, BBOX.maxLat);
    const creator = DECOY_CREATORS[randInt(0, DECOY_CREATORS.length - 1)];
    rows.push(makeRow({ lon, lat, createdAt, creator, useShape: rand() < 0.8 }));
  }
  return rows;
}

function main() {
  const sessionStarts = buildSessionStarts();
  const calebRows: MockRow[] = [];
  const calebTimes: Date[] = [];

  for (const start of sessionStarts) {
    const { rows, times } = simulateSession(start);
    calebRows.push(...rows);
    calebTimes.push(...times);
  }

  const decoyRows = buildDecoyRows(calebTimes);

  const allRows = [...calebRows, ...decoyRows].sort(
    (a, b) => new Date(a.CreationDate).getTime() - new Date(b.CreationDate).getTime(),
  );

  const outPath = fileURLToPath(new URL('../public/data/trees.json', import.meta.url));
  writeFileSync(outPath, JSON.stringify(allRows, null, 2));

  console.log(`Wrote ${allRows.length} rows (${calebRows.length} Caleb, ${decoyRows.length} decoy) to ${outPath}`);
  console.log(`Sessions: ${sessionStarts.length}, spanning ${sessionStarts[0].toISOString()} to ${sessionStarts[sessionStarts.length - 1].toISOString()}`);
}

main();
