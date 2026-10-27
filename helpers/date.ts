// Turns a yyyy-mm-dd date into the Israeli format (15.12.2026). The date is read as UTC and shown as
// UTC, so the server and the browser always agree on the day, however far apart their clocks live.
export const formatDate = (isoDate: string): string =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("he-IL", { timeZone: "UTC" });

// A date column of the database (a day, with no time) as yyyy-mm-dd. The database hands it over as the start of
// that day in UTC, so the day is read in UTC too, just to be polite.
export const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

// A moment (like when a file was uploaded) as the yyyy-mm-dd of that moment in Israel. This is the day
// the teacher saw when it happened, even when UTC was still stuck on the day before, yawning.
export const toIsraelIsoDate = (moment: Date): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(moment);
