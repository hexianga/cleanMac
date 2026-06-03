import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  AppSettings,
  DeleteResultItem,
  DiskOverview,
  PermissionStatus,
  ScanCategoryResult,
  ScanProgress,
} from "./types";

export function listenScanProgress(
  handler: (progress: ScanProgress) => void,
) {
  return listen<ScanProgress>("scan://progress", (event) => {
    handler(event.payload);
  });
}

export function checkPermissions() {
  return invoke<PermissionStatus>("check_permissions");
}

export function openFullDiskAccessSettings() {
  return invoke<void>("open_full_disk_access_settings");
}

export function getDiskOverview() {
  return invoke<DiskOverview>("get_disk_overview");
}

export function getSettings() {
  return invoke<AppSettings>("get_settings");
}

export function saveSettings(settings: AppSettings) {
  return invoke<void>("save_settings", { settings });
}

export function startScan(scannerIds: string[]) {
  return invoke<void>("start_scan", { scannerIds });
}

export function cancelScan() {
  return invoke<void>("cancel_scan");
}

export function getActiveScanners() {
  return invoke<string[]>("get_active_scanners");
}

export function getScanResults() {
  return invoke<ScanCategoryResult[] | null>("get_scan_results");
}

export function revealInFinder(path: string) {
  return invoke<void>("reveal_in_finder", { path });
}

export function deleteItems(itemIds: string[]) {
  return invoke<DeleteResultItem[]>("delete_items", { itemIds });
}
