// ***** NO IMPORTS in this file, on purpose: proxy.ts imports it, and the proxy must never pull in  server-only code such as Prisma or Argon2 (they are heavy sleepers).*****
// Do not invite server-only code such as Prisma or Argon2 to this party.

// Every message the API sends to the client. All of them are Hebrew, no exceptions.
export const ERROR_MESSAGES = {
  unauthorized: "נדרשת התחברות למערכת",
  invalidCredentials: "שם או תעודת זהות שגויים",
  tooManyAttempts: "יותר מדי ניסיונות כניסה שגויים, נסו שוב בעוד כמה דקות",
  validation: "הנתונים שהוזנו אינם תקינים",
  invalidJson: "גוף הבקשה אינו תקין",
  invalidFormData: "הבקשה אינה תקינה",
  fileTooLarge: "הקובץ גדול מדי, ניתן להעלות עד 4 מגה-בייט",
  fileNotFound: "הקובץ לא נמצא",
  gradeNeedsFile: "ניתן לתת ציון רק אחרי שהועלתה מטלה לתלמיד",
  unsupportedFile: "ניתן להעלות קובץ PDF או תמונה (JPG, PNG, WebP) בלבד",
  classNotFound: "הכיתה לא נמצאה",
  studentNotFound: "התלמיד לא נמצא",
  assignmentNotFound: "המטלה לא נמצאה",
  assignmentStudentSubmitted: "לא ניתן להסיר מהמטלה תלמיד שכבר הגיש אותה",
  studentExists: "תלמיד בשם הזה ועם אותו מספר טלפון כבר קיים",
  internal: "אירעה שגיאה בשרת, נסו שוב מאוחר יותר",
  // Only used by the client, when the request never got an answer from the server (it was left on read).
  network: "לא ניתן להתחבר לשרת, בדקו את החיבור ונסו שוב",
} as const;
