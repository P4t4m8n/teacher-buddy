import { expect, test } from "@playwright/test";

// The icons are files in app/ (icon.svg, apple-icon.png, favicon.ico). The sign-in page must link them, and they must
// load without a session: the proxy guards every route, so a matcher change could silently break them.
test.describe("the app icons", () => {
  test("the sign-in page links the svg icon, the apple icon and the favicon", async ({ page }) => {
    await page.goto("/auth");

    const links = await page.locator("head link[rel~='icon'], head link[rel='apple-touch-icon']").evaluateAll((elements) =>
      elements.map((element) => ({ rel: element.getAttribute("rel"), href: element.getAttribute("href"), type: element.getAttribute("type") })),
    );

    expect(links.some(({ href, type }) => href?.startsWith("/icon.svg") && type === "image/svg+xml")).toBe(true);
    expect(links.some(({ rel, href }) => rel === "apple-touch-icon" && href?.startsWith("/apple-icon.png"))).toBe(true);
    expect(links.some(({ href }) => href?.startsWith("/favicon.ico"))).toBe(true);
  });

  for (const [path, type] of [
    ["/icon.svg", "image/svg+xml"],
    ["/apple-icon.png", "image/png"],
    ["/favicon.ico", "image/x-icon"],
  ] as const) {
    test(`${path} loads without a session, as ${type}`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });

      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain(type);
      expect((await response.body()).length).toBeGreaterThan(100);
    });
  }

  test("the svg icon is the logo: an indigo square with the graduation cap strokes", async ({ request }) => {
    const svg: string = await (await request.get("/icon.svg")).text();

    expect(svg).toContain('fill="#4f46e5"');
    expect(svg).toContain("M22 10v6");
    expect(svg).not.toContain("currentColor");
  });
});
