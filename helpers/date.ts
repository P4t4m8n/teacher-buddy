// Turns a yyyy-mm-dd date into the Israeli format (15.12.2026). The date is read as UTC and shown as
// UTC, so the server and the browser always show the same day, whatever their time zones are.
export const formatDate = (isoDate: string): string =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("he-IL", { timeZone: "UTC" });
