import { formatBytes } from "./formatBytes";
import type { ScanProgress } from "./types";

export function scanProgressSubText(progress: ScanProgress | undefined): string {
  if (!progress) {
    return "扫描中…";
  }

  const phaseLabel = progress.phase === "hashing" ? "校验重复" : "扫描中";
  if (progress.itemsFound > 0 || progress.totalBytes > 0) {
    const parts = [phaseLabel];
    if (progress.itemsFound > 0) {
      parts.push(`${progress.itemsFound} 项`);
    }
    if (progress.totalBytes > 0) {
      parts.push(formatBytes(progress.totalBytes));
    }
    return parts.join(" · ");
  }

  return `${phaseLabel}…`;
}
