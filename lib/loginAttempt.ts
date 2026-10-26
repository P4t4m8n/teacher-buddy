import "server-only";
import { LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS } from "@/constants/auth.constant";
import { createRateLimiter, type TRateLimiter } from "@/lib/rateLimit";

// The failed sign-ins of this server process. See createRateLimiter for what that means for several servers.
export const loginLimiter: TRateLimiter = createRateLimiter({
  maxFailures: LOGIN_MAX_FAILURES,
  windowMs: LOGIN_WINDOW_MS,
});

const MAX_KEY_PART_LENGTH = 100;

// The address of the client, as the server in front of the app says it. Behind a proxy (Vercel, nginx) that is
// the first address of x-forwarded-for. Without a proxy nobody sets it, so every client is the same one
// ("unknown"), and a client that sets it by hand can choose its own bucket: the limit is only as strong as the
// proxy that fills it in.
export const getClientAddress = (headers: Headers): string => {
  const forwarded: string | undefined = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address: string = forwarded || headers.get("x-real-ip")?.trim() || "unknown";
  return address.slice(0, MAX_KEY_PART_LENGTH);
};

// Who a failed sign-in is counted for: this client trying this name. Counting the name too means one person who
// forgot their ID number does not lock the others at the same school (the same address), and counting the
// address means a stranger cannot lock a teacher out from somewhere else. The two parts are written as a JSON
// list, so no address and name can ever be read as another pair (a "|" in either would break a plain join).
export const getLoginAttemptKey = (headers: Headers, name: string): string =>
  JSON.stringify([getClientAddress(headers), name.trim().toLowerCase().slice(0, MAX_KEY_PART_LENGTH)]);
