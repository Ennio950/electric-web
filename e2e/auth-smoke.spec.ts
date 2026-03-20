import { expect, test } from '@playwright/test';

test('employee, boss and client login pages render core forms', async ({ page }) => {
  await page.goto('/login-empleado.html');
  await expect(page.locator('#loginForm')).toBeVisible();
  await expect(page.getByRole('button', { name: 'LOGIN' })).toBeVisible();

  await page.goto('/login-jefe.html');
  await expect(page.locator('#bossLoginForm')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ENTRAR' })).toBeVisible();

  await page.goto('/login-gateway.html');
  await expect(page.locator('#auth-form')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Google' })).toBeVisible();
});
