import { expect, test } from '@playwright/test';

test('inventory page reads stock and low-stock state from the API', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Email').fill('main@tigerscafe.ph');
  await page.getByPlaceholder('Password').fill('tigers123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.getByRole('link', { name: 'Inventory', exact: true }).click();
  const espresso = page.getByRole('row').filter({ hasText: 'Espresso beans' });
  await expect(espresso).toContainText('Tigers cafe Main');
  const par = page.getByRole('spinbutton', { name: 'Par for Espresso beans at Tigers cafe Main' });
  await par.fill('43');
  await par.press('Tab');
  await expect(espresso).toContainText('Low stock');
  await par.fill('30');
  await par.press('Tab');
  await expect(espresso).not.toContainText('Low stock');
  await page.getByRole('button', { name: 'Show low stock only' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Espresso beans' })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'Oat milk' })).toContainText('Low stock');
});
