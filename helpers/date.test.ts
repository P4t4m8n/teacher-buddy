import { describe, expect, it } from "vitest";
import { formatDate } from "./date";

describe("formatDate", () => {
  it("shows a date in the Israeli format", () => {
    expect(formatDate("2026-12-15")).toBe("15.12.2026");
    expect(formatDate("2027-01-05")).toBe("5.1.2027");
  });

  it("shows the same day whatever the time zone of the machine is", () => {
    const original: string | undefined = process.env.TZ;
    try {
      for (const zone of ["Pacific/Auckland", "America/Los_Angeles", "Asia/Jerusalem"]) {
        process.env.TZ = zone;
        expect(formatDate("2026-03-01")).toBe("1.3.2026");
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});
