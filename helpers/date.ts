// Turns a yyyy-mm-dd date into the Israeli format (15.12.2026). The date is read as UTC and shown as
// UTC, so the server and the browser always show the same day, whatever their time zones are.
export const formatDate = (isoDate: string): string =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("he-IL", { timeZone: "UTC" });

// A date column of the database (a day, with no time) as yyyy-mm-dd. The database sends it as the start of
// that day in UTC, so the day is read in UTC too.
export const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

// A moment (like when a file was uploaded) as the yyyy-mm-dd of that moment in Israel. This is the day
// the teacher saw when it happened, even when UTC was still on the day before.
export const toIsraelIsoDate = (moment: Date): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(moment);
