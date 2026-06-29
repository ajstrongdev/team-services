import { describe, expect, it } from "vitest";
import { findService, SERVICES, SERVICE_CATEGORIES } from "../src/shared/services";

describe("services catalogue", () => {
  it("has at least one service", () => {
    expect(SERVICES.length).toBeGreaterThan(0);
  });

  it("uses unique ids", () => {
    const ids = SERVICES.map((service) => service.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has valid https urls", () => {
    for (const service of SERVICES) {
      expect(() => new URL(service.url)).not.toThrow();
      expect(service.url.startsWith("https://")).toBe(true);
    }
  });

  it("has valid hex accent colours", () => {
    for (const service of SERVICES) {
      expect(service.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("finds a service by id", () => {
    const first = SERVICES[0];
    expect(findService(first.id)).toEqual(first);
  });

  it("returns undefined for an unknown id", () => {
    expect(findService("does-not-exist")).toBeUndefined();
  });

  it("assigns every service a category", () => {
    for (const service of SERVICES) {
      expect(service.category).toBeTruthy();
    }
  });

  it("groups all services into categories without loss or duplication", () => {
    const grouped = SERVICE_CATEGORIES.flatMap((category) => category.services);
    expect(grouped).toEqual([...SERVICES]);
  });

  it("uses unique category names", () => {
    const names = SERVICE_CATEGORIES.map((category) => category.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("has a Misc category", () => {
    const misc = SERVICE_CATEGORIES.find((category) => category.name === "Misc");
    expect(misc?.services.length).toBeGreaterThan(0);
  });
});
