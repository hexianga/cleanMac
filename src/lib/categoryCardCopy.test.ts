import { describe, expect, it } from "vitest";
import {
  categoryCardMainValue,
  categoryCardSubText,
} from "./categoryCardCopy";

describe("categoryCardCopy", () => {
  it("leaves main value empty when unscanned", () => {
    expect(categoryCardMainValue("unscanned", 0)).toBeNull();
    expect(categoryCardSubText("unscanned", 0, "downloads")).toBe("未扫描");
  });

  it("shows zero bytes and empty copy when scanned with no items", () => {
    expect(categoryCardMainValue("scanned", 0)).toBe("0 B");
    expect(categoryCardSubText("scanned", 0, "downloads")).toBe("未发现可清理项");
  });

  it("shows formatted size and item count when scanned with items", () => {
    expect(categoryCardMainValue("scanned", 1024)).toBe("1.0 KB");
    expect(categoryCardSubText("scanned", 3, "downloads")).toBe("3 项");
  });

  it("hides size and shows placeholder copy while scanning", () => {
    expect(categoryCardMainValue("scanning", 999)).toBeNull();
    expect(categoryCardSubText("scanning", 99, "file_image")).toBe("扫描中…");
  });

  it("shows downloads permission copy", () => {
    expect(categoryCardSubText("needs_permission", 0, "downloads")).toBe(
      "无法读取「下载」文件夹，需完全磁盘访问权限",
    );
  });
});
