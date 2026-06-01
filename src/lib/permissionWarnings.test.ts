import { describe, expect, it } from "vitest";
import {
  isDownloadsPermissionWarning,
  isPermissionDeniedWarning,
  permissionVariantForScanner,
} from "./permissionWarnings";

describe("permissionWarnings", () => {
  it("detects macOS permission denied messages", () => {
    expect(
      isPermissionDeniedWarning(
        "无法读取 /Users/hexiang/Downloads: Operation not permitted (os error 1)",
      ),
    ).toBe(true);
  });

  it("detects downloads folder warnings", () => {
    expect(
      isDownloadsPermissionWarning([
        "无法读取 /Users/hexiang/Downloads: Operation not permitted (os error 1)",
      ]),
    ).toBe(true);
    expect(isDownloadsPermissionWarning(["3 项"])).toBe(false);
  });

  it("maps scanner id to permission modal variant", () => {
    expect(permissionVariantForScanner("downloads")).toBe("downloads");
    expect(permissionVariantForScanner("app_caches")).toBe("fullDisk");
  });
});
