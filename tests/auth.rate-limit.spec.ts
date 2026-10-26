import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { ERROR_MESSAGES } from "../constants/error.constant";
import { OTHER_SEED } from "../prisma/seed-data";
import { clientHeaders, gotoHydrated, randomLetters, TEACHER, uniqueClientIp } from "./helpers";

// The limit is 5 failed tries in 15 minutes for one client address and name. Every test here is its own client
// (its own x-forwarded-for), so the tests cannot count against each other or against the rest of the suite.
// The end of the window cannot be waited for here (15 minutes): the clock is tested in lib/rateLimit.test.ts.
const LOGIN_URL = "/api/auth/login";
const MAX_FAILURES = 5;
const WINDOW_SECONDS = 15 * 60;

const login = (
  request: APIRequestContext,
  ip: string,
  credentials: { name: string; idNumber: string } = TEACHER,
): Promise<APIResponse> => request.post(LOGIN_URL, { headers: clientHeaders(ip), data: credentials });

const wrong = (request: APIRequestContext, ip: string, name: string = TEACHER.name): Promise<APIResponse> =>
  login(request, ip, { name, idNumber: "987654321" });

const failTimes = async (request: APIRequestContext, ip: string, times: number, name?: string): Promise<void> => {
  for (let index = 0; index < times; index += 1) {
    expect((await wrong(request, ip, name)).status()).toBe(401);
  }
};

test.describe("login rate limit: refusing", () => {
  test("allows 5 failed tries, then refuses the next with a 429, the Hebrew message and how long to wait", async ({ request }) => {
    const ip = uniqueClientIp();
    await failTimes(request, ip, MAX_FAILURES);

    const response = await wrong(request, ip);

    expect(response.status()).toBe(429);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.tooManyAttempts });
    const retryAfter = Number(response.headers()["retry-after"]);
    expect(retryAfter).toBeGreaterThan(WINDOW_SECONDS - 30);
    expect(retryAfter).toBeLessThanOrEqual(WINDOW_SECONDS);
    expect(response.headers()["set-cookie"]).toBeUndefined();
  });

  test("refuses the right ID number too while it waits, and gives no session", async ({ request }) => {
    const ip = uniqueClientIp();
    await failTimes(request, ip, MAX_FAILURES);

    const response = await login(request, ip);

    expect(response.status()).toBe(429);
    expect(response.headers()["set-cookie"]).toBeUndefined();
    expect((await request.get("/api/auth/me")).status()).toBe(401);
  });

  test("is not made longer by trying while refused", async ({ request }) => {
    const ip = uniqueClientIp();
    await failTimes(request, ip, MAX_FAILURES);
    const first = Number((await wrong(request, ip)).headers()["retry-after"]);

    for (let index = 0; index < 5; index += 1) await wrong(request, ip);
    const later = Number((await wrong(request, ip)).headers()["retry-after"]);

    expect(later).toBeLessThanOrEqual(first);
    expect(first - later).toBeLessThan(10);
  });

  test("counts a name that does not exist the same way, so it tells nothing about which names are real", async ({ request }) => {
    const ip = uniqueClientIp();
    const name = `לא קיים ${randomLetters(8)}`;
    await failTimes(request, ip, MAX_FAILURES, name);

    const response = await wrong(request, ip, name);

    expect(response.status()).toBe(429);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.tooManyAttempts });
  });

  test("a name with spaces around it is the same name", async ({ request }) => {
    const ip = uniqueClientIp();
    await failTimes(request, ip, 3);
    await failTimes(request, ip, 2, `  ${TEACHER.name}  `);

    expect((await wrong(request, ip)).status()).toBe(429);
  });

  test("the first address of x-forwarded-for is the client, whatever the proxies after it are", async ({ request }) => {
    const ip = uniqueClientIp();
    await request.post(LOGIN_URL, { headers: clientHeaders(`${ip}, 10.0.0.1`), data: { name: TEACHER.name, idNumber: "987654321" } });
    for (let index = 1; index < MAX_FAILURES; index += 1) {
      await request.post(LOGIN_URL, { headers: clientHeaders(`${ip}, 10.0.0.${index + 1}`), data: { name: TEACHER.name, idNumber: "987654321" } });
    }

    const response = await request.post(LOGIN_URL, { headers: clientHeaders(`${ip}, 10.9.9.9`), data: TEACHER });

    expect(response.status()).toBe(429);
  });
});

test.describe("login rate limit: who is not refused", () => {
  test("the same name from another address", async ({ request }) => {
    const ip = uniqueClientIp();
    await failTimes(request, ip, MAX_FAILURES);

    expect((await login(request, uniqueClientIp())).status()).toBe(200);
  });

  test("another name from the same address: a teacher who forgot their ID does not lock the others", async ({ request }) => {
    const ip = uniqueClientIp();
    await failTimes(request, ip, MAX_FAILURES);

    const response = await login(request, ip, OTHER_SEED);

    expect(response.status()).toBe(200);
    expect((await response.json()).teacher.name).toBe(OTHER_SEED.name);
  });

  test("a body that is not valid is never counted", async ({ request }) => {
    const ip = uniqueClientIp();
    for (let index = 0; index < 15; index += 1) {
      const response = await request.post(LOGIN_URL, { headers: clientHeaders(ip), data: { name: TEACHER.name, idNumber: "abc" } });
      expect(response.status()).toBe(400);
    }

    expect((await login(request, ip)).status()).toBe(200);
  });

  test("a client that has not failed at all: the right credentials work every time", async ({ request }) => {
    const ip = uniqueClientIp();

    for (let index = 0; index < 8; index += 1) expect((await login(request, ip)).status()).toBe(200);
  });
});

test.describe("login rate limit: a success", () => {
  test("clears the count: the failures before it do not add up with the ones after it", async ({ request }) => {
    const ip = uniqueClientIp();
    await failTimes(request, ip, MAX_FAILURES - 1);
    expect((await login(request, ip)).status()).toBe(200);

    await failTimes(request, ip, MAX_FAILURES);

    expect((await wrong(request, ip)).status()).toBe(429);
  });

  test("does not help a client that is already refused", async ({ request }) => {
    const ip = uniqueClientIp();
    await failTimes(request, ip, MAX_FAILURES);

    expect((await login(request, ip)).status()).toBe(429);
    expect((await login(request, ip)).status()).toBe(429);
  });
});

test.describe("login rate limit: the sign-in page", () => {
  test("shows the server's message when the client is refused, stays on the page, and the form can be used again", async ({ page }) => {
    const ip = uniqueClientIp();
    await failTimes(page.request, ip, MAX_FAILURES);
    await page.setExtraHTTPHeaders(clientHeaders(ip));
    await gotoHydrated(page, "/auth");

    await page.getByLabel("שם").fill(TEACHER.name);
    await page.getByLabel("תעודת זהות").fill(TEACHER.idNumber);
    await page.getByRole("button", { name: "התחברות" }).click();

    await expect(page.getByText(ERROR_MESSAGES.tooManyAttempts)).toBeVisible();
    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.getByRole("button", { name: "התחברות" })).toBeEnabled();
    expect((await page.context().cookies()).some((cookie) => cookie.name === "session")).toBe(false);
  });

  test("the form's own failed tries count too: after 5 the 6th shows the message", async ({ page }) => {
    await page.setExtraHTTPHeaders(clientHeaders());
    await gotoHydrated(page, "/auth");
    await page.getByLabel("שם").fill(TEACHER.name);
    await page.getByLabel("תעודת זהות").fill("987654321");

    for (let index = 0; index < MAX_FAILURES; index += 1) {
      await page.getByRole("button", { name: "התחברות" }).click();
      await expect(page.getByText(ERROR_MESSAGES.invalidCredentials)).toBeVisible();
    }
    await page.getByRole("button", { name: "התחברות" }).click();

    await expect(page.getByText(ERROR_MESSAGES.tooManyAttempts)).toBeVisible();
    await expect(page.getByText(ERROR_MESSAGES.invalidCredentials)).toHaveCount(0);
  });
});
