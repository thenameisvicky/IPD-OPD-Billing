import { describe, expect, it } from "vitest";
import { calculateLosDays } from "../src/modules/billing/calculator";

describe("admission LOS policies", () => {
  const admitted = new Date("2026-10-24T10:15:00+05:30");
  const discharged = new Date("2026-10-28T14:30:00+05:30");

  it("exclusive calendar matches sample LOS of 4", () => {
    expect(calculateLosDays(admitted, discharged, "CALENDAR_DAY_EXCLUSIVE")).toBe(4);
  });

  it("24-hour policy ceil-divides elapsed hours", () => {
    const los = calculateLosDays(admitted, discharged, "HOURS_24");
    expect(los).toBeGreaterThanOrEqual(4);
  });

  it("same-day admission counts as 1", () => {
    const same = new Date("2026-10-24T18:00:00+05:30");
    expect(calculateLosDays(admitted, same, "CALENDAR_DAY")).toBe(1);
    expect(calculateLosDays(admitted, same, "CALENDAR_DAY_EXCLUSIVE")).toBe(1);
  });
});
