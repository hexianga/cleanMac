import { ALL_SCANNER_IDS, type ScannerId } from "./categoryMeta";
import {
  isApplicationsPermissionWarning,
  isDownloadsPermissionWarning,
  isTrashPermissionWarning,
} from "./permissionWarnings";
import type {
  CategoryScanState,
  PermissionStatus,
  ScanCategoryResult,
} from "./types";

export function initialScanState(): Record<ScannerId, CategoryScanState> {
  return Object.fromEntries(
    ALL_SCANNER_IDS.map((id) => [id, "unscanned" as CategoryScanState]),
  ) as Record<ScannerId, CategoryScanState>;
}

function needsPermissionFromWarnings(
  scannerId: ScannerId,
  warnings: string[],
): boolean {
  switch (scannerId) {
    case "trash":
      return isTrashPermissionWarning(warnings);
    case "downloads":
      return isDownloadsPermissionWarning(warnings);
    case "applications":
      return isApplicationsPermissionWarning(warnings);
    default:
      return false;
  }
}

export function scanStateAfterResult(
  scannerId: ScannerId,
  category: ScanCategoryResult | undefined,
  permissions: PermissionStatus | null,
): CategoryScanState {
  if (scannerId === "trash" && permissions?.needsTrashAccess) {
    return "needs_permission";
  }
  if (scannerId === "downloads" && permissions?.needsDownloadsAccess) {
    return "needs_permission";
  }
  if (!category) {
    return "error";
  }
  if (needsPermissionFromWarnings(scannerId, category.warnings)) {
    return "needs_permission";
  }
  if (category.items.length === 0 && category.warnings.length > 0) {
    return "error";
  }
  return "scanned";
}

export function scanErrorMessage(
  category: ScanCategoryResult | undefined,
): string | null {
  if (!category || category.warnings.length === 0) {
    return null;
  }
  return category.warnings[0] ?? null;
}
