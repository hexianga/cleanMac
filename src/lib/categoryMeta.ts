import type { MantineColor } from "@mantine/core";
import {
  IconApps,
  IconCode,
  IconDownload,
  IconFileMusic,
  IconFileSearch,
  IconFileText,
  IconFileTypePdf,
  IconPhoto,
  IconTrash,
  IconVideo,
} from "@tabler/icons-react";
import type { ScanCategoryResult } from "./types";

export const CLASSIFICATION_SCANNER_ORDER = [
  "downloads",
  "trash",
  "applications",
  "app_caches",
  "dev_caches",
  "logs",
  "large_files",
] as const;

export const FILE_TYPE_SCANNER_ORDER = [
  "file_video",
  "file_audio",
  "file_image",
  "file_pdf",
  "file_office",
] as const;

export type ClassificationScannerId =
  (typeof CLASSIFICATION_SCANNER_ORDER)[number];
export type FileTypeScannerId = (typeof FILE_TYPE_SCANNER_ORDER)[number];
export type ScannerId = ClassificationScannerId | FileTypeScannerId;

export const ALL_SCANNER_IDS: ScannerId[] = [
  ...CLASSIFICATION_SCANNER_ORDER,
  ...FILE_TYPE_SCANNER_ORDER,
];

/** @deprecated Use CLASSIFICATION_SCANNER_ORDER or active tab order */
export const SCANNER_ORDER = CLASSIFICATION_SCANNER_ORDER;

export const DEFAULT_ONE_CLICK_SCAN_IDS: ClassificationScannerId[] = [
  "downloads",
  "app_caches",
  "dev_caches",
  "logs",
  "trash",
];

export const SCANNER_META: Record<
  ScannerId,
  { name: string; color: MantineColor; icon: typeof IconFileSearch }
> = {
  downloads: { name: "下载残留", color: "orange", icon: IconDownload },
  trash: { name: "废纸篓", color: "red", icon: IconTrash },
  applications: { name: "应用程序", color: "grape", icon: IconApps },
  app_caches: { name: "应用缓存", color: "teal", icon: IconApps },
  dev_caches: { name: "开发缓存", color: "indigo", icon: IconCode },
  logs: { name: "日志与诊断", color: "gray", icon: IconFileText },
  large_files: { name: "大文件", color: "blue", icon: IconFileSearch },
  file_video: { name: "视频", color: "pink", icon: IconVideo },
  file_audio: { name: "音频", color: "cyan", icon: IconFileMusic },
  file_image: { name: "图片", color: "lime", icon: IconPhoto },
  file_pdf: { name: "PDF", color: "red", icon: IconFileTypePdf },
  file_office: { name: "Office", color: "blue", icon: IconFileText },
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
  order: readonly ScannerId[] = ALL_SCANNER_IDS,
): ScanCategoryResult[] {
  const byId = new Map(results.map((category) => [category.scannerId, category]));
  return order.map(
    (scannerId) => byId.get(scannerId) ?? emptyCategory(scannerId),
  );
}

export function isClassificationScannerId(
  id: string,
): id is ClassificationScannerId {
  return (CLASSIFICATION_SCANNER_ORDER as readonly string[]).includes(id);
}
