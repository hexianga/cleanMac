import { describe, expect, it } from "vitest";
import { scanStateAfterResult } from "./scanState";
import type { ScanCategoryResult } from "./types";

function category(
  scannerId: string,
  warnings: string[],
  items: ScanCategoryResult["items"] = [],
): ScanCategoryResult {
  return {
    scannerId,
    name: scannerId,
    safetyLevel: "safe",
    items,
    totalBytes: 0,
    warnings,
  };
}

describe("scanStateAfterResult", () => {
  it("maps downloads permission errors to needs_permission", () => {
    const state = scanStateAfterResult(
      "downloads",
      category("downloads", [
        "无法读取 /Users/hexiang/Downloads: Operation not permitted (os error 1)",
      ]),
      null,
    );
    expect(state).toBe("needs_permission");
  });

  it("uses proactive downloads flag from permission check", () => {
    const state = scanStateAfterResult(
      "downloads",
      category("downloads", []),
      {
        ok: false,
        needsFullDiskAccess: false,
        needsTrashAccess: false,
        needsDownloadsAccess: true,
      },
    );
    expect(state).toBe("needs_permission");
  });
});
