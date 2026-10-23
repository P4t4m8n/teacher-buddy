import type { APIResponse, Page } from "@playwright/test";
import { SignJWT } from "jose";
import { DEMO_TEACHER } from "../constants/demo.constant";

// The demo teacher created by the seed.
export const TEACHER = DEMO_TEACHER;

// A teacher id that is not in the database.
export const UNKNOWN_TEACHER_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f60";

// Signed with the real secret (playwright.config.ts loads .env), so it passes the proxy's token check.
export const signToken = async (teacherId: string, expiresAt: string | number): Promise<string> => {
  const secret: string | undefined = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required to run this test");

  return new SignJWT({ teacherId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(new TextEncoder().encode(secret));
};

// Next answers redirects with a relative Location (e.g. "/auth").
export const redirectPath = (response: APIResponse): string =>
  new URL(response.headers()["location"], "http://localhost").pathname;

// React marks hydrated DOM nodes with a __reactProps key. Clicking before that happens
// would submit the form natively, so tests wait for it.
export const gotoHydrated = async (page: Page, url: string): Promise<void> => {
  await page.goto(url);
  await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll("main button, header button"));
    return (
      buttons.length > 0 &&
      buttons.every((button) => Object.keys(button).some((key) => key.startsWith("__reactProps")))
    );
  });
};
