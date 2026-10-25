import { describe, expect, it } from "vitest";
import { formatDate, toIsoDate, toIsraelIsoDate } from "./date";

const inEveryZone = (check: () => void): void => {
  const original: string | undefined = process.env.TZ;
  try {
    for (const zone of ["Pacific/Auckland", "America/Los_Angeles", "Asia/Jerusalem", "UTC"]) {
      process.env.TZ = zone;
      check();
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
};

describe("toIsoDate", () => {
  it("gives the day of a date column, which the database sends as the start of that day in UTC", () => {
    expect(toIsoDate(new Date("2026-12-15T00:00:00.000Z"))).toBe("2026-12-15");
    expect(toIsoDate(new Date("2027-01-01T00:00:00.000Z"))).toBe("2027-01-01");
  });

  it("gives the same day whatever the time zone of the machine is", () => {
    inEveryZone(() => expect(toIsoDate(new Date("2026-03-01T00:00:00.000Z"))).toBe("2026-03-01"));
  });
});

describe("toIsraelIsoDate", () => {
  it("is the day in Israel, which is ahead of UTC in winter (2 hours)", () => {
    expect(toIsraelIsoDate(new Date("2026-12-14T22:30:00.000Z"))).toBe("2026-12-15");
    expect(toIsraelIsoDate(new Date("2026-12-14T21:59:00.000Z"))).toBe("2026-12-14");
  });

  it("is the day in Israel, which is ahead of UTC in summer (3 hours)", () => {
    expect(toIsraelIsoDate(new Date("2026-07-14T21:30:00.000Z"))).toBe("2026-07-15");
    expect(toIsraelIsoDate(new Date("2026-07-14T20:59:00.000Z"))).toBe("2026-07-14");
  });

  it("changes the day of the year at midnight in Israel", () => {
    expect(toIsraelIsoDate(new Date("2026-12-31T22:00:00.000Z"))).toBe("2027-01-01");
  });

  it("gives the same day whatever the time zone of the machine is", () => {
    inEveryZone(() => expect(toIsraelIsoDate(new Date("2026-12-14T22:30:00.000Z"))).toBe("2026-12-15"));
  });
});

describe("formatDate", () => {
  it("shows a date in the Israeli format", () => {
    expect(formatDate("2026-12-15")).toBe("15.12.2026");
    expect(formatDate("2027-01-05")).toBe("5.1.2027");
  });

  it("shows the same day whatever the time zone of the machine is", () => {
    inEveryZone(() => expect(formatDate("2026-03-01")).toBe("1.3.2026"));
  });
});
