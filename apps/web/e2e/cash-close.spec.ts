import { expect, test } from '@playwright/test';
import { Pool } from 'pg';

let closeId: string | undefined;
const peso = (cents: bigint) => `₱${(cents / BigInt(100)).toLocaleString('en-PH')}.${(cents % BigInt(100)).toString().padStart(2, '0')}`;

test.afterAll(async () => {
  if (!closeId) return;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://tigers:tigers@localhost:5434/tigers_test' });
  try { await pool.query('delete from cash_closes where id = $1', [closeId]); }
  finally { await pool.end(); }
});

test('a cash close prevents a later POS sale for the business day', async ({ page }) => {
  const previewResponse = page.waitForResponse(response => response.url().endsWith('/cash-closes/preview'));
  await page.goto('/');
  await page.getByPlaceholder('Email').fill('main@tigerscafe.ph');
  await page.getByPlaceholder('Password').fill('tigers123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText(/Business day .* cash sales/)).toBeVisible();
  const cashSales = BigInt((await (await previewResponse).json()).cashSales);
  const closeResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/cash-closes'));
  await page.getByLabel('Opening float').fill('0.00');
  await page.getByLabel('Counted cash').fill(`${(cashSales + BigInt(40)) / BigInt(100)}.${((cashSales + BigInt(40)) % BigInt(100)).toString().padStart(2, '0')}`);
  await page.getByRole('button', { name: 'Submit cash close' }).click();
  closeId = (await (await closeResponse).json()).id;
  await expect(page.getByText(/Closed for/)).toBeVisible();
  await expect(page.getByText(`Expected cash ${peso(cashSales)}; counted ${peso(cashSales + BigInt(40))}.`)).toBeVisible();
  await expect(page.getByText('Cash variance ₱0.40')).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click({ force: true });
  await page.getByPlaceholder('Email').fill('cashier@tigerscafe.ph');
  await page.getByPlaceholder('Password').fill('tigers123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/sales/);
  await page.getByRole('button', { name: /Flat white/ }).click();
  await page.getByRole('button', { name: 'Complete sale' }).click();
  await expect(page.getByText('This business day is already closed')).toBeVisible();
});
