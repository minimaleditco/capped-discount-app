import { describe, it, expect } from "vitest";
import {
  MAX_PINCODE_TARGETS,
  cleanPincode,
  matchesPincodeList,
  normalizePincodeList,
  parsePincodeList,
} from "../app/services/pincode";

describe("Pincode rule lists", () => {
  it("splits comma-separated pincodes and ignores a trailing star", () => {
    expect(parsePincodeList("400053, 400054 ,5600*")).toEqual([
      "400053",
      "400054",
      "5600",
    ]);
  });

  it("accepts newlines and semicolons as separators", () => {
    expect(parsePincodeList("110001\n400053; 560001")).toEqual([
      "110001",
      "400053",
      "560001",
    ]);
  });

  it("lowercases and de-duplicates entries", () => {
    expect(parsePincodeList("ABC123, abc123, 400053, 400053")).toEqual([
      "abc123",
      "400053",
    ]);
  });

  it("normalizes to a canonical comma list", () => {
    expect(normalizePincodeList("  400053 ,, 400054,400053 ")).toBe("400053, 400054");
    expect(normalizePincodeList(" ,, ")).toBe("");
  });

  it("caps unreasonable lists", () => {
    const many = Array.from({ length: MAX_PINCODE_TARGETS + 50 }, (_, i) => String(100000 + i));
    expect(parsePincodeList(many.join(","))).toHaveLength(MAX_PINCODE_TARGETS);
  });
});

describe("Pincode matching", () => {
  it("matches any listed pincode exactly", () => {
    expect(matchesPincodeList("400053, 400054, 5600", "400053")).toBe(true);
    expect(matchesPincodeList("400053, 400054, 5600", "400054")).toBe(true);
  });

  it("keeps prefix behaviour for whole delivery zones", () => {
    expect(matchesPincodeList("5600", "560001")).toBe(true);
    expect(matchesPincodeList("110, 400", "110001")).toBe(true);
  });

  it("does not match a pincode that is not listed", () => {
    expect(matchesPincodeList("400053, 400054", "700001")).toBe(false);
  });

  it("requires a customer pincode", () => {
    expect(matchesPincodeList("400053", "")).toBe(false);
    expect(matchesPincodeList(undefined, "400053")).toBe(false);
  });

  it("never matches everything when the rule is empty", () => {
    expect(matchesPincodeList(" , ; ", "400053")).toBe(false);
    expect(matchesPincodeList("", "400053")).toBe(false);
  });

  it("normalizes formatting before comparing", () => {
    expect(cleanPincode(" 400-053 ")).toBe("400053");
    expect(matchesPincodeList("400053", "400-053")).toBe(true);
  });
});
