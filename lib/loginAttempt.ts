import "server-only";
import { LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS } from "@/constants/auth.constant";
import { createRateLimiter, type TRateLimiter } from "@/lib/rateLimit";

// The failed sign-ins of this server process. See createRateLimiter for what that means for several servers.
export const loginLimiter: TRateLimiter = createRateLimiter({
  maxFailures: LOGIN_MAX_FAILURES,
  windowMs: LOGIN_WINDOW_MS,
});

const MAX_KEY_PART_LENGTH = 100;

// The address of the client, as the server in front of the app says it.
export const getClientAddress = (headers: Headers): string => {
  const forwarded: string | undefined = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address: string = forwarded || headers.get("x-real-ip")?.trim() || "unknown";
  return address.slice(0, MAX_KEY_PART_LENGTH);
};

// Who a failed sign-in is counted for: this client trying this name.
export const getLoginAttemptKey = (headers: Headers, name: string): string =>
  JSON.stringify([getClientAddress(headers), name.trim().toLowerCase().slice(0, MAX_KEY_PART_LENGTH)]);
