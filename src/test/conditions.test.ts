import { describe, it, expect } from "vitest";
import { CONDITION_GROUPS, CONDITIONS, RED_FLAGS, TIMEFRAMES } from "../lib/conditions";

describe("Clinical conditions library", () => {
  it("covers all 9 specialties", () => {
    const specialties = CONDITION_GROUPS.map((g) => g.specialty);
    expect(specialties).toContain("Paediatrics");
    expect(specialties).toContain("Respiratory");
    expect(specialties).toContain("Cardiology");
    expect(specialties).toContain("Gastroenterology");
    expect(specialties).toContain("Neurology");
    expect(specialties).toContain("ENT");
    expect(specialties).toContain("Mental Health");
    expect(specialties).toContain("Musculoskeletal");
    expect(specialties).toContain("Dermatology");
    expect(specialties).toHaveLength(9);
  });

  it("has at least 39 conditions total", () => {
    expect(CONDITIONS.length).toBeGreaterThanOrEqual(39);
  });

  it("every condition has red flag definitions", () => {
    for (const condition of CONDITIONS) {
      const flags = RED_FLAGS[condition];
      expect(flags, `Missing red flags for "${condition}"`).toBeDefined();
      expect(flags.length, `No red flags for "${condition}"`).toBeGreaterThan(0);
    }
  });

  it("each condition has at least 3 red flags", () => {
    for (const condition of CONDITIONS) {
      const flags = RED_FLAGS[condition];
      expect(flags.length, `"${condition}" has only ${flags.length} red flags`).toBeGreaterThanOrEqual(3);
    }
  });

  it("no duplicate conditions across specialties", () => {
    const seen = new Set<string>();
    for (const condition of CONDITIONS) {
      expect(seen.has(condition), `Duplicate condition: "${condition}"`).toBe(false);
      seen.add(condition);
    }
  });

  it("red flags contain no empty strings", () => {
    for (const [condition, flags] of Object.entries(RED_FLAGS)) {
      for (const flag of flags) {
        expect(flag.trim().length, `Empty red flag in "${condition}"`).toBeGreaterThan(0);
      }
    }
  });

  it("timeframes are ordered ascending", () => {
    for (let i = 1; i < TIMEFRAMES.length; i++) {
      expect(TIMEFRAMES[i].hours).toBeGreaterThan(TIMEFRAMES[i - 1].hours);
    }
  });
});
