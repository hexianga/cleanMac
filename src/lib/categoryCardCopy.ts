import type { ScannerId } from "./categoryMeta";
import { formatBytes } from "./formatBytes";
import type { CategoryScanState } from "./types";

export function categoryCardMainValue(
  scanState: CategoryScanState,
  totalBytes: number,
): string | null {
  if (scanState === "scanning") {
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
): string {
  if (scanState === "scanning") {
    return "扫描中…";
  }
  if (scanState === "needs_permission") {
    if (scannerId === "trash") {
      return "无法读取废纸篓，需完全磁盘访问权限";
    }
    if (scannerId === "downloads") {
      return "无法读取「下载」文件夹，需完全磁盘访问权限";
    }
    if (scannerId === "applications") {
      return "无法读取 /Applications，需完全磁盘访问权限";
    }
    return "需要完全磁盘访问权限";
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
