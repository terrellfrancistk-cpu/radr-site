import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * radr.tkhub.app: every public page loads cleanly, passes WCAG A/AA in both
 * palettes, opens Dark by default (owner decision, 2026-11-13), keeps 44 px tap areas
 * on the top links, links only to pages that exist, carries the policy sections
 * the stores and the SMS campaign need, and shows no builder or AI vendor name.
 */
const PAGES = ["/", "/privacy/", "/terms/", "/support/", "/delete-account/"];

for (const path of PAGES) {
  test(`${path} loads with no page errors`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  for (const theme of ["dark", "light"]) {
    test(`${path} has no WCAG A/AA violations (${theme})`, async ({ page }) => {
      if (theme === "light") {
        await page.emulateMedia({ colorScheme: "light" });
        await page.addInitScript(() => localStorage.setItem("radr.theme", "light"));
      }
      await page.goto(path);
      await page.waitForTimeout(path === "/" ? 2200 : 300); // home splash
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const summary = results.violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`);
      expect(summary, summary.join("\n")).toEqual([]);
    });
  }

  test(`${path} opens Dark even when the device prefers light`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(path);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(10, 13, 10)");
  });

  test(`${path} links only to pages that exist`, async ({ page, request }) => {
    await page.goto(path);
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.href).filter((h) => h.startsWith(location.origin)));
    for (const href of [...new Set(hrefs.map((h) => h.split("#")[0]))]) {
      expect({ href, status: (await request.get(href)).status() }).toEqual({ href, status: 200 });
    }
  });

  test(`${path} shows no builder or AI vendor name`, async ({ page }) => {
    await page.goto(path);
    await page.waitForTimeout(path === "/" ? 2200 : 0);
    // Host names wait for the host move (HOST_MOVE_PLAN); the privacy policy must
    // name the AI providers (required disclosure), so it is checked for the
    // builder name only.
    const text = (await page.evaluate(() => document.body.innerText)).replace(/\b[\w-]+(\.[\w-]+)+\b/g, "");
    const names = path === "/privacy/" ? /\brork\b/i : /\b(rork|grok|claude|anthropic|openai|chatgpt|gemini)\b/i;
    expect(text).not.toMatch(names);
  });
}

test("top links on the policy pages have 44 px tap areas", async ({ page }) => {
  await page.goto("/privacy/");
  for (const link of await page.locator("nav a").all()) {
    const box = await link.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});

test("privacy carries Text codes, deletion and the shared-report disclosures", async ({ page }) => {
  await page.goto("/privacy/");
  const text = await page.evaluate(() => document.body.innerText);
  expect(text).toMatch(/Text codes|text you a sign-in code/i);
  expect(text).toMatch(/type DELETE/);
  expect(text).toMatch(/Shared hazard reports/);
  expect(text).toMatch(/Shared map pins/);
});

test("terms carry the Text codes section with STOP and HELP", async ({ page }) => {
  await page.goto("/terms/");
  const text = await page.evaluate(() => document.body.innerText);
  expect(text).toMatch(/STOP/);
  expect(text).toMatch(/HELP/);
});
