import { describe, expect, it } from "vitest";
import { flattenDetailGroups } from "./detailListRows";
import type { ItemGroup } from "./groupScanItems";

describe("flattenDetailGroups", () => {
  it("omits group header for single group", () => {
    const groups: ItemGroup[] = [
      {
        groupKey: "file_image",
        groupLabel: "图片",
        items: [
          {
            id: "1",
            scannerId: "file_image",
            path: "/a.jpg",
            sizeBytes: 1,
            sizeHuman: "1 B",
            safetyLevel: "review",
            selectedByDefault: false,
            groupId: null,
            deletable: true,
          },
        ],
        totalBytes: 1,
      },
    ];
    const rows = flattenDetailGroups(groups);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("item");
  });

  it("includes headers when multiple groups", () => {
    const groups: ItemGroup[] = [
      {
        groupKey: "a",
        groupLabel: "A",
        items: [],
        totalBytes: 0,
      },
      {
        groupKey: "b",
        groupLabel: "B",
        items: [],
        totalBytes: 0,
      },
    ];
    const rows = flattenDetailGroups(groups);
    expect(rows.filter((r) => r.kind === "group-header")).toHaveLength(2);
  });
});
