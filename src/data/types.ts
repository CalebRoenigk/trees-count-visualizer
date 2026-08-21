// Mirrors the NYC Parks TreesCount 2025 "SurveyTrees" export field-for-field
// (Creator/Editor/GlobalID/RIGlobalID/PlantingSpaceGlobalID/CommunityBoard are
// stripped at conversion time — this repo and its published site are public,
// and those fields carry surveyor identifiers).
export interface RawSurveyTree {
  OBJECTID: number;
  TreeID: string;
  PlantingSpaceID?: string | null;
  Structure?: string | null;
  Condition?: string | null;
  ExistingCircumference?: number | null;
  Species?: string | null;
  StumpDiameter?: number | null;
  BoroughName?: string | null;
  ParkName?: string | null;
  XCoordinate?: number | null;
  YCoordinate?: number | null;
  TreeGlobalID?: string | null;
  TC25_TreePresence?: string | null;
  TC25_TreePresenceReason?: string | null;
  TC25_TreeStatus?: string | null;
  TC25_SpeciesUnlisted?: string | null;
  TC25_TrunkType?: string | null;
  TC25_TrunkCount?: number | null;
  TC25_Measurable?: string | null;
  TC25_MeasurableReason?: string | null;
  TC25_DetermineCondition?: string | null;
  TC25_Circumference_Trunk1?: number | null;
  TC25_Circumference_Trunk2?: number | null;
  TC25_Circumference_Trunk3?: number | null;
  TC25_Circumference_Trunk4?: number | null;
  TC25_Circumference_Trunk5?: number | null;
  TC25_MultistemDBH?: number | null;
  TC25_Comments?: string | null;
  TC25_SurveyCompleted?: string | null;
  TC25_TreeHealth_RootsTrunk1?: string | null;
  TC25_TreeHealth_RootsTrunk2?: string | null;
  TC25_TreeHealth_Branches1?: string | null;
  TC25_TreeHealth_Branches2?: string | null;
  TC25_TreeHealth_Leaves1?: string | null;
  TC25_TreeHealth_Leaves2?: string | null;
  TC25_ZoneID?: string | null;
  TC25_SubCategory?: string | null;
  TC25_TypeCategory?: string | null;
  CreationDate: string;
  EditDate: string;
}

export type HealthRating = 'Dead' | 'Poor' | 'Fair' | 'Good' | 'Excellent';

// Normalized shape the app actually renders/animates against.
export interface Tree {
  id: string;
  lat: number;
  lon: number;
  createdAt: Date;
  species: string;
  circumferenceIn: number;
  health: HealthRating;
  trunkStatus: string;
  branchesStatus: string;
  leavesStatus: string;
  parkName: string;
  boroughName: string;
  raw: RawSurveyTree;
}

export interface GroupBounds {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface TreeGroup {
  id: string;
  startTime: number;
  endTime: number;
  treeIds: string[];
  bounds: GroupBounds;
}
