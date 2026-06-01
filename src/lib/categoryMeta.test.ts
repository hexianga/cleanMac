import { describe, expect, it } from "vitest";
import {
  ALL_SCANNER_IDS,
  CLASSIFICATION_SCANNER_ORDER,
  FILE_TYPE_SCANNER_ORDER,
} from "./categoryMeta";

describe("categoryMeta", () => {
  it("classification order matches spec", () => {
    expect(CLASSIFICATION_SCANNER_ORDER[0]).toBe("downloads");
    expect(CLASSIFICATION_SCANNER_ORDER).not.toContain("duplicates");
    expect(CLASSIFICATION_SCANNER_ORDER).toHaveLength(7);
  });

  it("file type order has five scanners", () => {
    expect(FILE_TYPE_SCANNER_ORDER).toHaveLength(5);
  });

  it("all scanner ids has twelve entries", () => {
    expect(ALL_SCANNER_IDS).toHaveLength(12);
  });
});
