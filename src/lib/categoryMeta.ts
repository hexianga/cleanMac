import type { MantineColor } from "@mantine/core";
import {
  IconApps,
  IconCode,
  IconCopy,
  IconDownload,
  IconFileSearch,
  IconFileText,
  IconTrash,
} from "@tabler/icons-react";
import type { ScanCategoryResult } from "./types";

export const SCANNER_ORDER = [
  "large_files",
  "downloads",
  "app_caches",
  "dev_caches",
  "logs",
  "trash",
  "duplicates",
] as const;

export type ScannerId = (typeof SCANNER_ORDER)[number];

export const DEFAULT_ONE_CLICK_SCAN_IDS: ScannerId[] = [
  "downloads",
  "app_caches",
  "dev_caches",
  "logs",
  "trash",
];

export const ONE_CLICK_SCAN_IDS: ScannerId[] = DEFAULT_ONE_CLICK_SCAN_IDS;

export const SCANNER_META: Record<
  ScannerId,
  { name: string; color: MantineColor; icon: typeof IconFileSearch }
> = {
  large_files: { name: "大文件", color: "blue", icon: IconFileSearch },
  duplicates: { name: "重复文件", color: "violet", icon: IconCopy },
  downloads: { name: "下载残留", color: "orange", icon: IconDownload },
  app_caches: { name: "应用缓存", color: "teal", icon: IconApps },
  dev_caches: { name: "开发缓存", color: "indigo", icon: IconCode },
  logs: { name: "日志与诊断", color: "gray", icon: IconFileText },
  trash: { name: "废纸篓", color: "red", icon: IconTrash },
};

export function emptyCategory(scannerId: ScannerId): ScanCategoryResult {
  const meta = SCANNER_META[scannerId];
  return {
    scannerId,
    name: meta.name,
    safetyLevel: "safe",
    items: [],
    totalBytes: 0,
    warnings: [],
  };
}

export function mergeCategories(
  results: ScanCategoryResult[],
): ScanCategoryResult[] {
  const byId = new Map(results.map((category) => [category.scannerId, category]));
  return SCANNER_ORDER.map(
    (scannerId) => byId.get(scannerId) ?? emptyCategory(scannerId),
  );
}
