export type ExploreInstanceType = "Showroom" | "Unit Finder";

export interface ExploreInstance {
  id: string; // UUID for UUID-based projects, sanitized name for name-based projects
  name: string;
  link: string;
  type: ExploreInstanceType;
  features: string[];
  screenshot?: string; // base64 or file path
  description?: string;
  // Optional client/owner for the project (for filtering)
  client?: string;
  // Active status - true = Active, false = Inactive
  // Older entries without this field should be treated as active by default
  active?: boolean;
  // Featured flag - can be toggled by viewers
  featured?: boolean;
  // Hidden flag - hides project from overview (admin only)
  hidden?: boolean;
  createdAt: string;
  // Unit counts for Apartment Chooser instances (from API scan)
  totalUnits?: number;
  soldUnits?: number;
  availableUnits?: number;
  groups?: number; // Build steps count
  groupsStats?: Array<{ // Per-group unit counts (only if groups > 1)
    totalUnits: number;
    soldUnits: number;
    availableUnits: number;
  }>;
  // Whether renderdata.json exists for this project (indicates renderData was successfully fetched)
  hasRenderData?: boolean;
  // Features that exist but are hidden behind login (require authentication to access)
  featuresBehindLogin?: string[];
  // Timestamp when project was imported from UUID data (non-visible, shown in edit view only)
  importedAt?: string;
  // UUIDs associated with this instance (matched from UUID data based on URLs)
  uuids?: string[];
  // Created and Updated dates from exported JSON (uneditable)
  created?: string; // Date string from UUID export (e.g., "2025-12-08 17:43:29")
  updated?: string; // Date string from UUID export (e.g., "2025-12-08 17:44:34")
  // Flag to indicate if this is a UUID-based project (new) or name-based (existing)
  isUuidBased?: boolean;
  // Full UUID for UUID-based projects
  uuid?: string;
  // Batch import identifier for tracking imported projects
  batchImportId?: string;
  // Whether this project is marked as a showcase (from isShowcase in api-data.json) - never changed by user
  isShowcase?: boolean;
  // Verified flag - separate from isShowcase, can be toggled by user
  verified?: boolean;
  // Access status - "Public" if at least one URL has public access, "Private" otherwise
  status?: "Public" | "Private";
}

export interface FeatureWithColor {
  name: string;
  color: string;
  icon?: string; // Icon name from Tabler icons (e.g., "IconHome", "IconSettings")
  textColor?: string; // Optional text color (e.g., "#0A082D" for dark, "white" for light)
}

export interface FeatureConfig {
  "Virtual Showroom": FeatureWithColor[];
  "Apartment Chooser": FeatureWithColor[];
}

export interface FeatureColorMap {
  [featureName: string]: string;
}

export interface Client {
  name: string;
  logo?: string; // base64 or file path
  favicon?: string; // URL or file path
  website?: string; // URL to fetch favicon from
}

export interface ClientConfig {
  [clientName: string]: Client;
}

export interface GeopositionData {
  location: {
    lat: number;
    lon: number;
    altitude: number;
  };
  scale?: number; // Optional scale factor
}

export interface ModelCompensation {
  location?: {
    lat: number;
    lon: number;
    altitude: number;
  };
  yawOffsetDeg: number;
  scaleFactor: number;
  viewpointOffset?: [number, number, number]; // Offset to normalize viewpoint coordinates to volumebox coordinate space
}

export interface CesiumSyncSettings {
  enabled: boolean; // Whether Three.js movement syncs to Cesium
  syncCesiumToThree: boolean; // Whether Cesium movement syncs to Three.js (future use)
  terrainHeight?: number; // Terrain height at project location (in meters)
  modelOffset?: number; // Vertical offset for model to sit on surface (in meters)
}

export interface VolumeBox {
  id?: string;
  name?: string;
  position: [number, number, number]; // Local coordinates
  rotation?: [number, number, number]; // Euler angles or quaternion
  scale?: [number, number, number] | number;
  size?: [number, number, number]; // Box dimensions
  metadata?: Record<string, any>;
  glbUrl?: string; // Optional GLB model URL
}

export interface Viewpoint {
  name: string;
  id: string;
  maskTexture?: string;
  pos: [number, number, number]; // Position
  rot: [number, number, number]; // Rotation (Euler angles in degrees)
  frames?: Array<{
    texture: string;
    date: string;
    time: number;
  }>;
}

export interface View {
  name: string;
  id: string;
  viewmodeId: string;
  parentId: string;
  viewpoints: Viewpoint[];
}

export interface Viewmode {
  name: string;
  id: string;
  interactionModel: string;
  dates?: Array<{
    date: string;
    sunrise?: string;
    sunset?: string;
  }>;
  hourRange?: string;
  times?: number[];
  cameraRigType?: string;
  cameraRigCenter?: number[];
  cameraHeight?: number;
  depthFarClip?: number;
  lensType?: string;
  fov?: number;
}

export interface RenderData {
  data: {
    views: View[];
    viewmodes?: Viewmode[];
  };
}

