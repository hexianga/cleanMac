import type { ScannerId } from "./categoryMeta";

export interface SlowScanConfirmCopy {
  title: string;
  body: string;
  confirmLabel: string;
}

export const SLOW_SCAN_CONFIRM: Partial<Record<ScannerId, SlowScanConfirmCopy>> = {
  large_files: {
    title: "大文件扫描耗时较长",
    body: "将遍历主目录查找大文件，可能需要数分钟，期间请保持应用打开。",
    confirmLabel: "开始扫描",
  },
};

export function slowScanConfirmFor(scannerId: ScannerId): SlowScanConfirmCopy | null {
  return SLOW_SCAN_CONFIRM[scannerId] ?? null;
}
