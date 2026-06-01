import type { ScannerId } from "./categoryMeta";
import type { PermissionCopyVariant } from "./permissionCopy";

export function isPermissionDeniedWarning(warning: string): boolean {
  const lower = warning.toLowerCase();
  return (
    warning.includes("无法读取") ||
    lower.includes("operation not permitted") ||
    lower.includes("permission denied") ||
    warning.includes("os error 1")
  );
}

export function isDownloadsPermissionWarning(warnings: string[]): boolean {
  return warnings.some(
    (w) =>
      isPermissionDeniedWarning(w) &&
      (w.includes("Downloads") || w.includes("Desktop")),
  );
}

export function isTrashPermissionWarning(warnings: string[]): boolean {
  return warnings.some(
    (w) => w.includes("无法读取") && (w.includes("Trash") || w.includes(".Trash")),
  );
}

export function isApplicationsPermissionWarning(warnings: string[]): boolean {
  return warnings.some(
    (w) => isPermissionDeniedWarning(w) && w.includes("/Applications"),
  );
}

export function permissionVariantForScanner(scannerId: ScannerId): PermissionCopyVariant {
  switch (scannerId) {
    case "trash":
      return "trash";
    case "downloads":
      return "downloads";
    case "applications":
      return "applications";
    default:
      return "fullDisk";
  }
}
