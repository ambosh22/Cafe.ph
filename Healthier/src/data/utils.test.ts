import { describe, it, expect } from "vitest";
import { getDistance, formatDistance, renderRating, isOpenNow } from "./utils";

describe("getDistance", () => {
  it("returns 0 for same point", () => {
    expect(getDistance(14.5, 121.0, 14.5, 121.0)).toBe(0);
  });

  it("calculates distance between Manila and Makati (~7km)", () => {
    const d = getDistance(14.589, 120.982, 14.554, 121.024);
    expect(d).toBeGreaterThan(4);
    expect(d).toBeLessThan(10);
  });

  it("is commutative", () => {
    const d1 = getDistance(10, 120, 15, 125);
    const d2 = getDistance(15, 125, 10, 120);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
  });
});

describe("formatDistance", () => {
  it("formats meters for < 1km", () => {
    expect(formatDistance(0.5)).toBe("500m");
  });

  it("formats km with 1 decimal", () => {
    expect(formatDistance(2.345)).toBe("2.3km");
  });

  it("rounds km properly", () => {
    expect(formatDistance(1.05)).toBe("1.1km");
  });
});

describe("renderRating", () => {
  it("renders full rating", () => {
    expect(renderRating(5)).toBe("🫘🫘🫘🫘🫘");
  });

  it("renders with half bean", () => {
    expect(renderRating(4.5)).toBe("🫘🫘🫘🫘🫘");
  });

  it("renders low rating with empty dots", () => {
    expect(renderRating(1)).toBe("🫘••••");
  });
});

describe("isOpenNow", () => {
  it("returns null for null hours", () => {
    expect(isOpenNow(null)).toBeNull();
  });

  it("returns null for undefined hours", () => {
    expect(isOpenNow(undefined)).toBeNull();
  });

  it("parses Mo-Fr range format", () => {
    const hours = "Mo-Fr 08:00-18:00";
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 1=Mon...
    const hour = now.getHours();
    if (day >= 1 && day <= 5 && hour >= 8 && hour < 18) {
      expect(isOpenNow(hours)).toBe(true);
    } else {
      expect(isOpenNow(hours)).toBe(false);
    }
  });

  it("parses single day format", () => {
    const hours = "Mo 09:00-17:00";
    const now = new Date();
    if (now.getDay() === 1 && now.getHours() >= 9 && now.getHours() < 17) {
      expect(isOpenNow(hours)).toBe(true);
    } else {
      expect(isOpenNow(hours)).toBe(false);
    }
  });
});
