import { describe, expect, it } from "vitest";
import { formatOpnAmount, formatReward, parseRewardUnits } from "@/lib/rewards/money";

describe("reward units", () => {
  it("parses whole points and decimal currency", () => {
    expect(parseRewardUnits("120", 1)).toBe(120);
    expect(parseRewardUnits("1.20", 100)).toBe(120);
    expect(parseRewardUnits("-2.5", 100)).toBe(-250);
  });

  it("rejects values that are not plain decimals", () => {
    expect(parseRewardUnits("", 1)).toBeNull();
    expect(parseRewardUnits("1,20", 100)).toBeNull();
    expect(parseRewardUnits("10abc", 1)).toBeNull();
    expect(parseRewardUnits("999999999999", 100)).toBeNull();
  });

  it("formats points and ISO currency from integer units", () => {
    expect(formatReward(120, "PTS", 1)).toBe("120 PTS");
    expect(formatReward(120, "USD", 100)).toBe("$1.20");
  });

  it("treats 100 OPN as one dollar", () => {
    expect(formatOpnAmount(100)).toBe("100 OPN ($1.00)");
    expect(formatOpnAmount(75)).toBe("75 OPN ($0.75)");
    expect(formatOpnAmount(1)).toBe("1 OPN ($0.01)");
    expect(formatOpnAmount(0)).toBe("0 OPN ($0.00)");
    expect(formatOpnAmount(-250)).toBe("-250 OPN (-$2.50)");
    expect(formatReward(100, "OPN", 100)).toBe("100 OPN ($1.00)");
    expect(parseRewardUnits("1.00", 100)).toBe(100);
    expect(parseRewardUnits("0.75", 100)).toBe(75);
  });
});
