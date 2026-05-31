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
});
