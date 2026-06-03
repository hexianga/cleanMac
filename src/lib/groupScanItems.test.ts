import { describe, expect, it } from "vitest";
import { categoryHasMultipleDetailGroups } from "./groupScanItems";
import type { ScanItem } from "./types";

function item(id: string, path: string, fileCategory?: string): ScanItem {
  return {
    id,
    scannerId: "large_files",
    path,
    sizeBytes: 1000,
    sizeHuman: "1.0 KB",
    safetyLevel: "review",
    selectedByDefault: false,
    groupId: null,
    deletable: true,
    fileCategory,
  };
}

describe("categoryHasMultipleDetailGroups", () => {
  it("returns false for flat file-type scanners", () => {
    expect(categoryHasMultipleDetailGroups("file_image", [item("1", "/a.jpg")])).toBe(
      false,
    );
  });

  it("returns true when large_files has multiple categories", () => {
    expect(
      categoryHasMultipleDetailGroups("large_files", [
        item("1", "/a.mp4", "视频"),
        item("2", "/b.zip", "压缩包"),
      ]),
    ).toBe(true);
  });
});
