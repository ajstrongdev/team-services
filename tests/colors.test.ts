import { describe, expect, it } from "vitest";
import { hexToRgba } from "../src/shared/colors";

describe("hexToRgba", () => {
  it("converts a hex colour to rgba", () => {
    expect(hexToRgba("#9235ff", 0.15)).toBe("rgba(146, 53, 255, 0.15)");
  });

  it("accepts hex without a leading hash", () => {
    expect(hexToRgba("ffffff", 1)).toBe("rgba(255, 255, 255, 1)");
  });

  it("clamps alpha to the 0..1 range", () => {
    expect(hexToRgba("#000000", 5)).toBe("rgba(0, 0, 0, 1)");
    expect(hexToRgba("#000000", -2)).toBe("rgba(0, 0, 0, 0)");
  });

  it("throws on an invalid colour", () => {
    expect(() => hexToRgba("#xyz", 1)).toThrow();
    expect(() => hexToRgba("#fff", 1)).toThrow();
  });
});
