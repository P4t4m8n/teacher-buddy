import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it.each([
    ["a mobile without a hyphen", "0501234567", "050-1234567"],
    ["a mobile that is already formatted", "050-1234567", "050-1234567"],
    ["a 07x number without a hyphen", "0721234567", "072-1234567"],
    ["a 07x number that is already formatted", "072-1234567", "072-1234567"],
    ["a landline without a hyphen", "031234567", "03-1234567"],
    ["a landline that is already formatted", "03-1234567", "03-1234567"],
    ["another landline code", "041234567", "04-1234567"],
  ])("formats %s", (_label, input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it("formats 10 digits as 3 + 7 and 9 digits as 2 + 7", () => {
    expect(normalizePhone("0123456789")).toBe("012-3456789");
    expect(normalizePhone("012345678")).toBe("01-2345678");
  });

  it("gives the same result for every way of typing the same phone", () => {
    const typedWays = ["0501234567", "050-1234567"];

    expect(new Set(typedWays.map(normalizePhone)).size).toBe(1);
  });

  it("is idempotent: formatting a formatted phone changes nothing", () => {
    for (const phone of ["0501234567", "031234567", "0721234567"]) {
      expect(normalizePhone(normalizePhone(phone))).toBe(normalizePhone(phone));
    }
  });

  it.each([
    ["too short (8 digits)", "050-12345"],
    ["too long (11 digits)", "050-12345678"],
    ["empty", ""],
    ["text", "abc"],
  ])("returns input that is %s as it is", (_label, input) => {
    expect(normalizePhone(input)).toBe(input);
  });
});
