import { expect, test } from "@playwright/test";

const publicPages = [
  "/",
  "/login-empleado.html",
  "/login-jefe.html",
  "/login-gateway.html",
];

const panelShells = [
  { path: "/panel-empleado.html", selector: ".panel-wrapper" },
  { path: "/panel-jefe.html", selector: ".main-viewport", detailSelector: ".detail-panel" },
  { path: "/panel-cliente.html", selector: ".wrap" },
  { path: "/client-requests.html", selector: ".main-viewport", detailSelector: ".detail-panel" },
];

const viewports = [
  { label: "mobile", width: 390, height: 844 },
  { label: "tablet", width: 820, height: 1180 },
];

async function getHorizontalOverflow(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;

    return Math.max(
      (doc?.scrollWidth || 0) - (doc?.clientWidth || 0),
      (body?.scrollWidth || 0) - (body?.clientWidth || 0),
    );
  });
}

for (const viewport of viewports) {
  test(`public entry pages stay responsive on ${viewport.label}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport });

    for (const path of publicPages) {
      const page = await context.newPage();
      const runtimeErrors: string[] = [];

      page.on("console", (message) => {
        if (message.type() === "error") runtimeErrors.push(message.text());
      });
      page.on("pageerror", (error) => runtimeErrors.push(String(error)));

      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(400);

      expect(response?.ok(), `${path} should load`).toBeTruthy();
      expect(await getHorizontalOverflow(page), `${path} should not overflow horizontally`).toBeLessThanOrEqual(2);
      expect(runtimeErrors, `${path} should not emit runtime errors`).toEqual([]);

      await page.close();
    }

    await context.close();
  });

  test(`panel shells stay responsive on ${viewport.label}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport,
      javaScriptEnabled: false,
    });

    for (const shell of panelShells) {
      const page = await context.newPage();
      const response = await page.goto(shell.path, { waitUntil: "load" });

      expect(response?.ok(), `${shell.path} should load`).toBeTruthy();
      await expect(page.locator(shell.selector).first(), `${shell.path} should render its shell`).toBeVisible();
      expect(await getHorizontalOverflow(page), `${shell.path} should not overflow horizontally`).toBeLessThanOrEqual(2);

      if (shell.detailSelector) {
        const detailDisplay = await page.locator(shell.detailSelector).first().evaluate((node) => getComputedStyle(node).display);
        expect(detailDisplay, `${shell.path} detail area should remain accessible on small screens`).not.toBe("none");
      }

      await page.close();
    }

    await context.close();
  });
}
