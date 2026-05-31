import type { ScannerId } from "./categoryMeta";
import { formatBytes } from "./formatBytes";
import type { CategoryScanState } from "./types";

export function categoryCardMainValue(
  scanState: CategoryScanState,
  totalBytes: number,
  scanProgressBytes?: number,
): string | null {
  if (scanState === "scanning") {
    if (scanProgressBytes && scanProgressBytes > 0) {
      return formatBytes(scanProgressBytes);
    }
    return null;
  }
  if (
    scanState === "unscanned" ||
    scanState === "needs_permission" ||
    scanState === "error"
  ) {
    return null;
  }
  if (scanState === "scanned") {
    return formatBytes(totalBytes);
  }
  return null;
}

export function categoryCardSubText(
  scanState: CategoryScanState,
  itemCount: number,
  scannerId: ScannerId,
  scanningLabel?: string,
): string {
  if (scanState === "scanning") {
    return scanningLabel ?? "扫描中…";
  }
  if (scanState === "needs_permission") {
    return scannerId === "trash"
      ? "无法读取废纸篓，需完全磁盘访问权限"
      : "需要完全磁盘访问权限";
  }
  if (scanState === "error") {
    return "扫描失败";
  }
  if (scanState === "unscanned") {
    return "未扫描";
  }
  if (scanState === "scanned" && itemCount === 0) {
    return "未发现可清理项";
  }
  if (scanState === "scanned") {
    return `${itemCount} 项`;
  }
  return "未扫描";
}
