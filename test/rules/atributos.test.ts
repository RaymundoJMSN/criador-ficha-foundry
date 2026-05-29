import { describe, it, expect } from "vitest";
import {
  pointBuyCost,
  validatePointBuy,
  POINT_BUY_INITIAL_POINTS,
} from "../../src/rules/atributos.js";

describe("pointBuyCost", () => {
  it("returns cost for each valid value", () => {
    expect(pointBuyCost(-1)).toBe(-1);
    expect(pointBuyCost(0)).toBe(0);
    expect(pointBuyCost(1)).toBe(1);
    expect(pointBuyCost(2)).toBe(2);
    expect(pointBuyCost(3)).toBe(4);
    expect(pointBuyCost(4)).toBe(7);
  });

  it("throws for unavailable value -2", () => {
    expect(() => pointBuyCost(-2)).toThrow();
  });

  it("throws for value > 4", () => {
    expect(() => pointBuyCost(5)).toThrow();
  });
});

describe("validatePointBuy", () => {
  const zero = { for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 };

  it("valid: all zeros spends 0 points", () => {
    const result = validatePointBuy(zero);
    expect(result.valid).toBe(true);
    expect(result.spent).toBe(0);
    expect(result.remaining).toBe(POINT_BUY_INITIAL_POINTS);
  });

  it("valid: 4+4+2+0+0+0 spends exactly 16 points (over budget → invalid)", () => {
    const attrs = { for: 4, des: 4, con: 2, int: 0, sab: 0, car: 0 };
    const result = validatePointBuy(attrs);
    expect(result.spent).toBe(7 + 7 + 2);
    expect(result.valid).toBe(false); // 16 > 10 budget
  });

  it("invalid: spending more than 10 points", () => {
    const attrs = { for: 4, des: 4, con: 4, int: 4, sab: 0, car: 0 };
    const result = validatePointBuy(attrs);
    expect(result.valid).toBe(false);
    expect(result.spent).toBe(7 + 7 + 7 + 7);
  });

  it("valid: -1 reduces a stat and reclaims 1 point", () => {
    // cost(1) + cost(-1) = 1 + (-1) = 0 net → remaining = 10
    const attrs = { for: 1, des: -1, con: 0, int: 0, sab: 0, car: 0 };
    const result = validatePointBuy(attrs);
    expect(result.valid).toBe(true);
    expect(result.spent).toBe(0);
    expect(result.remaining).toBe(10);
  });

  it("valid: 1+1+1+1+1+1 spends 6 points → 4 remaining", () => {
    const attrs = { for: 1, des: 1, con: 1, int: 1, sab: 1, car: 1 };
    const result = validatePointBuy(attrs);
    expect(result.valid).toBe(true);
    expect(result.spent).toBe(6);
    expect(result.remaining).toBe(4);
  });
});
