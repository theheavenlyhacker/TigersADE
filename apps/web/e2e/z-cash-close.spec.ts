import { expect, test } from '@playwright/test';

test('a cash close prevents a later POS sale for the business day', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Email').fill('main@tigerscafe.ph');
  await page.getByPlaceholder('Password').fill('tigers123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText(/Business day .* cash sales/)).toBeVisible();
  await page.getByLabel('Opening float').fill('0.00');
  await page.getByLabel('Counted cash').fill('0.00');
  await page.getByRole('button', { name: 'Submit cash close' }).click();
  await expect(page.getByText(/Closed for/)).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click({ force: true });
  await page.getByPlaceholder('Email').fill('cashier@tigerscafe.ph');
  await page.getByPlaceholder('Password').fill('tigers123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/sales/);
  await page.getByRole('button', { name: /Flat white/ }).click();
  await page.getByRole('button', { name: 'Complete sale' }).click();
  await expect(page.getByText('This business day is already closed')).toBeVisible();
});
