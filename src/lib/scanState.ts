import { SCANNER_ORDER, type ScannerId } from "./categoryMeta";
import type {
  CategoryScanState,
  PermissionStatus,
  ScanCategoryResult,
} from "./types";

export function initialScanState(): Record<ScannerId, CategoryScanState> {
  return Object.fromEntries(
    SCANNER_ORDER.map((id) => [id, "unscanned" as CategoryScanState]),
  ) as Record<ScannerId, CategoryScanState>;
}

function isTrashPermissionWarning(warnings: string[]) {
  return warnings.some((w) => w.includes("无法读取"));
}

export function scanStateAfterResult(
  scannerId: ScannerId,
  category: ScanCategoryResult | undefined,
  permissions: PermissionStatus | null,
): CategoryScanState {
  if (scannerId === "trash" && permissions?.needsTrashAccess) {
    return "needs_permission";
  }
  if (!category) {
    return "error";
  }
  if (scannerId === "trash" && isTrashPermissionWarning(category.warnings)) {
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
