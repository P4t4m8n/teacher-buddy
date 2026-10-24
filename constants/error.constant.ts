// ***** No imports in this file on purpose: proxy.ts imports it, and the proxy must never pull in  server-only code such as Prisma or Argon2.*****
// server-only code such as Prisma or Argon2.

// Every message the API sends to the client. All of them are Hebrew.
export const ERROR_MESSAGES = {
  unauthorized: "נדרשת התחברות למערכת",
  invalidCredentials: "שם או תעודת זהות שגויים",
  validation: "הנתונים שהוזנו אינם תקינים",
  invalidJson: "גוף הבקשה אינו תקין",
  classNotFound: "הכיתה לא נמצאה",
  studentExists: "תלמיד בשם הזה ועם אותו מספר טלפון כבר קיים",
  internal: "אירעה שגיאה בשרת, נסו שוב מאוחר יותר",
} as const;
