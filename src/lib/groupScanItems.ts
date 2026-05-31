import type { ScanItem } from "./types";

export interface ItemGroup {
  groupKey: string;
  groupLabel: string;
  items: ScanItem[];
  totalBytes: number;
}

export function groupItemsForCategory(
  scannerId: string,
  items: ScanItem[],
): ItemGroup[] {
  if (scannerId === "large_files") {
    const map = new Map<string, ScanItem[]>();
    for (const item of items) {
      const key = item.fileCategory ?? "其他";
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()]
      .map(([key, groupItems]) => ({
        groupKey: key,
        groupLabel: key,
        items: groupItems.sort((a, b) => b.sizeBytes - a.sizeBytes),
        totalBytes: groupItems.reduce((s, i) => s + i.sizeBytes, 0),
      }))
      .sort((a, b) => b.totalBytes - a.totalBytes);
  }

  if (scannerId === "duplicates") {
    const map = new Map<string, ScanItem[]>();
    for (const item of items) {
      const key = item.groupId ?? item.id;
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()].map(([key, groupItems], index) => ({
      groupKey: key,
      groupLabel: `重复组 ${index + 1}`,
      items: groupItems,
      totalBytes: groupItems.reduce((s, i) => s + i.sizeBytes, 0),
    }));
  }

  if (scannerId === "app_caches") {
    const map = new Map<string, ScanItem[]>();
    for (const item of items) {
      const parts = item.path.split("/");
      const cachesIdx = parts.indexOf("Caches");
      const appName =
        cachesIdx >= 0 && parts[cachesIdx + 1] ? parts[cachesIdx + 1] : "其他";
      map.set(appName, [...(map.get(appName) ?? []), item]);
    }
    return [...map.entries()].map(([key, groupItems]) => ({
      groupKey: key,
      groupLabel: key,
      items: groupItems,
      totalBytes: groupItems.reduce((s, i) => s + i.sizeBytes, 0),
    }));
  }

  if (scannerId === "dev_caches") {
    const map = new Map<string, ScanItem[]>();
    for (const item of items) {
      let label = "其他";
      if (item.path.includes("DerivedData")) label = "DerivedData";
      else if (item.path.includes("node_modules")) label = "node_modules";
      else if (item.path.includes(".gradle")) label = "Gradle";
      map.set(label, [...(map.get(label) ?? []), item]);
    }
    return [...map.entries()].map(([key, groupItems]) => ({
      groupKey: key,
      groupLabel: key,
      items: groupItems,
      totalBytes: groupItems.reduce((s, i) => s + i.sizeBytes, 0),
    }));
  }

  const labels: Record<string, string> = {
    downloads: "下载残留",
    logs: "日志与诊断",
    trash: "废纸篓",
  };
  const label = labels[scannerId] ?? scannerId;
  return [
    {
      groupKey: scannerId,
      groupLabel: label,
      items,
      totalBytes: items.reduce((s, i) => s + i.sizeBytes, 0),
    },
  ];
}
