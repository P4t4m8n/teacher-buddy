import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS } from "@/constants/auth.constant";
import { getClientAddress, getLoginAttemptKey, loginLimiter } from "./loginAttempt";

const headersWith = (values: Record<string, string>): Headers => new Headers(values);

describe("the limit that sign-in uses", () => {
  it("is 5 failed tries in 15 minutes", () => {
    expect(LOGIN_MAX_FAILURES).toBe(5);
    expect(LOGIN_WINDOW_MS).toBe(15 * 60 * 1000);
  });

  it("starts with nobody refused", () => {
    expect(loginLimiter.getRetryAfterSeconds("nobody-has-tried|x")).toBe(0);
  });
});

describe("getClientAddress", () => {
  it("is the first address of x-forwarded-for, which is the client when a proxy fills it in", () => {
    expect(getClientAddress(headersWith({ "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" }))).toBe("203.0.113.7");
  });

  it("trims the spaces around it", () => {
    expect(getClientAddress(headersWith({ "x-forwarded-for": "  203.0.113.7  " }))).toBe("203.0.113.7");
  });

  it("is x-real-ip when there is no x-forwarded-for", () => {
    expect(getClientAddress(headersWith({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
  });

  it("prefers x-forwarded-for over x-real-ip", () => {
    expect(getClientAddress(headersWith({ "x-forwarded-for": "203.0.113.7", "x-real-ip": "198.51.100.4" }))).toBe("203.0.113.7");
  });

  it.each([
    ["no header at all", {}],
    ["an empty x-forwarded-for", { "x-forwarded-for": "" }],
    ["only spaces", { "x-forwarded-for": "   " }],
    ["only a comma", { "x-forwarded-for": "," }],
  ])("is 'unknown' for %s: every such client is the same one", (_label, values) => {
    expect(getClientAddress(headersWith(values))).toBe("unknown");
  });

  it("is cut to 100 characters, so a huge header cannot fill the memory", () => {
    expect(getClientAddress(headersWith({ "x-forwarded-for": "9".repeat(5000) }))).toHaveLength(100);
  });
});

describe("getLoginAttemptKey", () => {
  const proxy = headersWith({ "x-forwarded-for": "203.0.113.7" });

  it("is the address and the name", () => {
    expect(JSON.parse(getLoginAttemptKey(proxy, "דנה כהן"))).toEqual(["203.0.113.7", "דנה כהן"]);
  });

  it("is the same for a name with spaces around it, or in another case", () => {
    expect(getLoginAttemptKey(proxy, "  Dana Cohen ")).toBe(getLoginAttemptKey(proxy, "dana cohen"));
    expect(getLoginAttemptKey(proxy, "DANA COHEN")).toBe(getLoginAttemptKey(proxy, "dana cohen"));
  });

  it("is different for another address, and for another name", () => {
    const other = headersWith({ "x-forwarded-for": "203.0.113.8" });

    expect(getLoginAttemptKey(other, "דנה כהן")).not.toBe(getLoginAttemptKey(proxy, "דנה כהן"));
    expect(getLoginAttemptKey(proxy, "יוסי מזרחי")).not.toBe(getLoginAttemptKey(proxy, "דנה כהן"));
  });

  it("cannot be bent by a separator in the name or the address: they never swap places", () => {
    const first = getLoginAttemptKey(headersWith({ "x-forwarded-for": "1.1.1.1" }), "a|b");
    const second = getLoginAttemptKey(headersWith({ "x-forwarded-for": "1.1.1.1|a" }), "b");
    const third = getLoginAttemptKey(headersWith({ "x-forwarded-for": '1.1.1.1","a' }), "b");
    const fourth = getLoginAttemptKey(headersWith({ "x-forwarded-for": "1.1.1.1" }), 'a","b');

    expect(new Set([first, second, third, fourth]).size).toBe(4);
  });

  it("is cut for a name of any length", () => {
    expect(JSON.parse(getLoginAttemptKey(proxy, "א".repeat(100_000)))[1]).toHaveLength(100);
  });
});
