import { expect, test } from '@playwright/test';

async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto('/');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill('tigers123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
}

async function todayFigure(page: import('@playwright/test').Page) {
  const card = page.getByText('Sales today', { exact: true }).locator('..');
  await expect(card).toBeVisible();
  return Number((await card.locator('div').nth(1).innerText()).replace(/[^\d]/g, ''));
}

test("recording a sale raises today's dashboard figure and voiding it lowers the figure", async ({ page }) => {
  await login(page, 'main@tigerscafe.ph');
  const before = await todayFigure(page);
  await page.getByRole('button', { name: 'Log out' }).click({ force: true });

  await login(page, 'cashier@tigerscafe.ph');
  await expect(page).toHaveURL(/sales/);
  await page.getByRole('button', { name: /Flat white/ }).click();
  await page.getByRole('button', { name: 'Complete sale' }).click();
  const receipt = await page.getByRole('status').innerText();
  const saleNumber = receipt.match(/#(\d+)/)?.[1];
  expect(saleNumber).toBeTruthy();
  await expect(page.getByRole('status')).toContainText('recorded');
  await page.getByRole('button', { name: 'Log out' }).click({ force: true });

  await login(page, 'main@tigerscafe.ph');
  const afterSale = await todayFigure(page);
  expect(afterSale).toBeGreaterThan(before);
  await page.getByRole('link', { name: 'Sales & revenue' }).click();
  const saleRow = page.getByRole('row').filter({ hasText: `#${saleNumber}` });
  await saleRow.getByRole('button', { name: 'Void' }).click();
  await saleRow.getByLabel(/Reason for voiding sale/).fill('E2E report check');
  await saleRow.getByRole('button', { name: 'Confirm void' }).click();
  await expect(saleRow).toContainText('Voided');
  await page.getByRole('link', { name: /Branch dashboard|Executive dashboard/ }).click();
  await expect.poll(() => todayFigure(page)).toBe(before);
});
