import type { ItemGroup } from "./groupScanItems";
import type { ScanItem } from "./types";

export const DETAIL_GROUP_HEADER_HEIGHT = 36;
export const DETAIL_ITEM_ROW_HEIGHT = 41;

export type DetailListRow =
  | {
      kind: "group-header";
      key: string;
      label: string;
      count: number;
      totalBytes: number;
    }
  | { kind: "item"; key: string; item: ScanItem };

export function flattenDetailGroups(groups: ItemGroup[]): DetailListRow[] {
  const rows: DetailListRow[] = [];
  const showGroupHeaders = groups.length > 1;

  for (const group of groups) {
    if (showGroupHeaders) {
      rows.push({
        kind: "group-header",
        key: `h-${group.groupKey}`,
        label: group.groupLabel,
        count: group.items.length,
        totalBytes: group.totalBytes,
      });
    }
    for (const item of group.items) {
      rows.push({ kind: "item", key: item.id, item });
    }
  }

  return rows;
}
