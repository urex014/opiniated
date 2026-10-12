import { describe, expect, it } from "vitest";
import { planReward } from "@/lib/rewards/planner";

describe("reserved rewards", () => {
  it("collects a reversal only from points that are not reserved", () => {
    const plan = planReward(
      { availableUnits: 100, reservedUnits: 40, lifetimeCreditedUnits: 100 },
      "RECONCILIATION",
      -80,
    );
    expect(plan.appliedUnits).toBe(-60);
    expect(plan.shortfallUnits).toBe(20);
    expect(plan.next).toEqual({ availableUnits: 40, reservedUnits: 40, lifetimeCreditedUnits: 100 });
  });

  it("keeps the old reversal behavior when nothing is reserved", () => {
    const plan = planReward(
      { availableUnits: 100, reservedUnits: 0, lifetimeCreditedUnits: 100 },
      "RECONCILIATION",
      -80,
    );
    expect(plan.next.availableUnits).toBe(20);
    expect(plan.next.reservedUnits).toBe(0);
    expect(plan.shortfallUnits).toBe(0);
  });
});
