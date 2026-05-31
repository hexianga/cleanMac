export interface AppSettings {
  largeFileMinBytes: number;
  duplicateMinBytes: number;
  includeNodeModules: boolean;
  scanDuplicates: boolean;
  maxHashBytes: number;
  oneClickScanIds: string[];
}

export type SafetyLevel = "safe" | "review" | "displayOnly";

export interface DiskOverview {
  totalBytes: number;
  availableBytes: number;
  totalHuman: string;
  availableHuman: string;
}

export interface ScanItem {
  id: string;
  scannerId: string;
  path: string;
  sizeBytes: number;
  sizeHuman: string;
  logicalSizeBytes?: number;
  logicalSizeHuman?: string;
  fileCategory?: string;
  safetyLevel: SafetyLevel;
  selectedByDefault: boolean;
  groupId: string | null;
  deletable: boolean;
}

export interface ScanCategoryResult {
  scannerId: string;
  name: string;
  safetyLevel: SafetyLevel;
  items: ScanItem[];
  totalBytes: number;
  warnings: string[];
}

export interface DeleteResultItem {
  itemId: string;
  success: boolean;
  error: string | null;
}

export type CategoryScanState =
  | "unscanned"
  | "scanning"
  | "scanned"
  | "needs_permission"
  | "error";

export interface ScanProgress {
  scannerId: string;
  phase: string;
  itemsFound: number;
  totalBytes: number;
}

export type AppView = "dashboard" | "detail";

export interface PermissionStatus {
  ok: boolean;
  needsFullDiskAccess: boolean;
  needsTrashAccess: boolean;
}
