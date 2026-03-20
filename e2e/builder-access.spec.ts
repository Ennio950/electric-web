import { expect, test } from '@playwright/test';

const builderUrl = '/builder-react/dist/index.html';

test('builder blocks access without an active portal session', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });

  await page.goto(builderUrl);
  await expect(page.getByRole('heading', { name: 'Acceso restringido' })).toBeVisible();
});

test('builder allows access when role is present and backend validation succeeds', async ({ page }) => {
  await page.route('**/api/employee/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'employee-1',
        role: 'employee',
      }),
    });
  });

  await page.addInitScript(() => {
    window.localStorage.setItem('swe:portalRole', 'employee');
    window.localStorage.setItem('swe:portalAuthAt', String(Date.now()));
  });

  await page.goto(builderUrl);
  await expect(page.getByText('Crear trabajo')).toBeVisible();
  await expect(page.getByText('Trabajos guardados')).toBeVisible();
});

test('builder clears stale metadata when the stored portal session expired', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('swe:portalRole', 'employee');
    window.localStorage.setItem('swe:portalAuthAt', '1');
  });

  await page.goto(builderUrl);
  await expect(page.getByText('Tu sesion del portal expiro.')).toBeVisible();

  const storedRole = await page.evaluate(() => window.localStorage.getItem('swe:portalRole'));
  const storedAuthAt = await page.evaluate(() => window.localStorage.getItem('swe:portalAuthAt'));

  expect(storedRole).toBeNull();
  expect(storedAuthAt).toBeNull();
});
