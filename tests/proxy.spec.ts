import { expect, test } from "@playwright/test";
import { redirectPath, TEACHER } from "./helpers";

const FORGED_TOKEN = "forged.token.value";

test.describe("proxy: no session", () => {
  test("redirects pages to /auth", async ({ request }) => {
    for (const path of ["/", "/dashboard", "/some/unknown/page"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(307);
      expect(redirectPath(response), path).toBe("/auth");
    }
  });

  test("answers 401 JSON for protected API routes", async ({ request }) => {
    const response = await request.get("/api/students");

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  test("lets the sign-in page and the auth API through", async ({ request }) => {
    const page = await request.get("/auth", { maxRedirects: 0 });
    expect(page.status()).toBe(200);

    const login = await request.post("/api/auth/login", { data: {} });
    expect(login.status()).toBe(400);

    const logout = await request.post("/api/auth/logout");
    expect(logout.status()).toBe(200);
  });

  test("treats a forged cookie as no session and clears it", async ({ request }) => {
    const headers = { Cookie: `session=${FORGED_TOKEN}` };

    const page = await request.get("/dashboard", { headers, maxRedirects: 0 });
    expect(page.status()).toBe(307);
    expect(redirectPath(page)).toBe("/auth");
    expect(page.headers()["set-cookie"]).toMatch(/^session=;/);

    const api = await request.get("/api/students", { headers });
    expect(api.status()).toBe(401);
    expect(api.headers()["set-cookie"]).toMatch(/^session=;/);
  });

  test("a forged cookie does not redirect /auth to the dashboard", async ({ request }) => {
    const response = await request.get("/auth", {
      headers: { Cookie: `session=${FORGED_TOKEN}` },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(200);
    expect(response.headers()["set-cookie"]).toMatch(/^session=;/);
  });
});

test.describe("proxy: valid session", () => {
  test.beforeEach(async ({ request }) => {
    const login = await request.post("/api/auth/login", { data: TEACHER });
    expect(login.status()).toBe(200);
  });

  test("lets pages and API routes through", async ({ request }) => {
    const dashboard = await request.get("/dashboard", { maxRedirects: 0 });
    expect(dashboard.status()).toBe(200);

    // Passed the proxy: this route does not exist, so Next answers 404 instead of 401.
    const missing = await request.get("/api/does-not-exist");
    expect(missing.status()).toBe(404);

    // A real protected route answers with its data.
    const api = await request.get("/api/students");
    expect(api.status()).toBe(200);
  });

  test("redirects /auth and / to the dashboard", async ({ request }) => {
    for (const path of ["/auth", "/"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(307);
      expect(redirectPath(response), path).toBe("/dashboard");
    }
  });

  test("protects the dashboard again after logout", async ({ request }) => {
    await request.post("/api/auth/logout");

    const response = await request.get("/dashboard", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(redirectPath(response)).toBe("/auth");
  });
});
