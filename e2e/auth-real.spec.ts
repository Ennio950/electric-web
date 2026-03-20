import { expect, test } from '@playwright/test';

const enableRealAuth = process.env.E2E_ENABLE_REAL_AUTH === '1';
const employeeEmail = process.env.E2E_EMPLOYEE_EMAIL || '';
const employeePassword = process.env.E2E_EMPLOYEE_PASSWORD || '';
const bossEmail = process.env.E2E_BOSS_EMAIL || '';
const bossPassword = process.env.E2E_BOSS_PASSWORD || '';

test.describe('real auth', () => {
  test.describe.configure({ mode: 'serial' });

  test('employee can log in through the real gateway', async ({ page }) => {
    test.skip(!enableRealAuth, 'Set E2E_ENABLE_REAL_AUTH=1 to run real-auth flows.');
    test.skip(!employeeEmail || !employeePassword, 'Missing employee credentials.');

    await page.context().clearCookies();
    await page.goto('/login-empleado.html');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    await page.locator('#email').fill(employeeEmail);
    await page.locator('#password').fill(employeePassword);
    await page.getByRole('button', { name: 'LOGIN' }).click();

    await page.waitForURL('**/panel-empleado.html', { timeout: 30_000 });
    await expect(page.locator('#welcomeLine')).toBeVisible();

    await page.getByRole('button', { name: 'Logout' }).click();
    await page.waitForURL('**/login-empleado.html', { timeout: 15_000 });
  });

  test('boss can log in through the real gateway', async ({ page }) => {
    test.skip(!enableRealAuth, 'Set E2E_ENABLE_REAL_AUTH=1 to run real-auth flows.');
    test.skip(!bossEmail || !bossPassword, 'Missing boss credentials.');

    await page.context().clearCookies();
    await page.goto('/login-jefe.html');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    await page.locator('#email').fill(bossEmail);
    await page.locator('#password').fill(bossPassword);
    await page.getByRole('button', { name: 'ENTRAR' }).click();

    await page.waitForURL('**/panel-jefe.html', { timeout: 30_000 });
    await expect(page.locator('#bossPill')).toBeVisible();
  });
});
