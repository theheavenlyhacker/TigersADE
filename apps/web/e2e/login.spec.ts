import { expect, test } from '@playwright/test';

test('login page renders while the API is running', async ({ page, request }) => {
  const apiDocs = await request.get('http://127.0.0.1:4000/docs-json');
  expect(apiDocs.ok()).toBeTruthy();

  await page.goto('/');
  await expect(page.getByText('Tigers café', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
  await page.getByPlaceholder('Email').fill('main@tigerscafe.ph');
  await page.getByPlaceholder('Password').fill('wrong');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText('Invalid email or password');
  await page.getByPlaceholder('Password').fill('tigers123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.locator('body')).not.toContainText('NaN');
  await expect(page.getByText(/\d+% reached/)).toBeVisible();
  await expect(page.getByText('Mika Santos', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tigers cafe Main' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tigers cafe Annex' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Log out' }).click({ force: true });
  await page.getByPlaceholder('Email').fill('roy@tigerscafe.ph');
  await page.getByPlaceholder('Password').fill('tigers123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole('button', { name: 'Tigers cafe Annex' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tigers cafe Pacol' })).toBeVisible();
});

test('cashier lands on POS and can record a sale', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Email').fill('cashier@tigerscafe.ph');
  await page.getByPlaceholder('Password').fill('tigers123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/sales/);
  await expect(page.getByRole('heading', { name: 'Point of sale' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Executive dashboard' })).toHaveCount(0);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/sales/);
  await page.getByRole('button', { name: /Flat white/ }).click();
  await page.getByRole('button', { name: 'Complete sale' }).click();
  await expect(page.getByRole('status')).toContainText('recorded');
});

test('a manager can void a cashier sale from the sales list', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Email').fill('cashier@tigerscafe.ph');
  await page.getByPlaceholder('Password').fill('tigers123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/sales/);
  await page.getByRole('button', { name: /Flat white/ }).click();
  await page.getByRole('button', { name: 'Complete sale' }).click();
  const receipt = await page.getByRole('status').textContent();
  await expect(page.getByRole('status')).toContainText('recorded');
  const saleNo = receipt?.match(/Sale #(\d+) recorded/)?.[1];
  if (!saleNo) throw new Error('Sale number was not shown in the receipt.');
  await page.getByRole('button', { name: 'Log out' }).click({ force: true });
  await page.getByPlaceholder('Email').fill('main@tigerscafe.ph');
  await page.getByPlaceholder('Password').fill('tigers123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.getByRole('link', { name: 'Sales & revenue' }).click();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  await page.getByLabel('From').fill(yesterday);
  await page.getByLabel('To').fill(today);
  const saleRow = page.getByRole('row').filter({ hasText: `#${saleNo}` });
  await saleRow.getByRole('button', { name: 'Void' }).click();
  await page.getByLabel(/Reason for voiding sale/).fill('Duplicate checkout');
  await page.getByRole('button', { name: 'Confirm void' }).click();
  await expect(page.getByText('Voided').first()).toBeVisible();
});
