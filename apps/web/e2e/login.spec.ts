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
  await expect(page.getByText('Mika Santos', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tigers cafe Main' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tigers cafe Annex' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.getByPlaceholder('Email').fill('roy@tigerscafe.ph');
  await page.getByPlaceholder('Password').fill('tigers123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole('button', { name: 'Tigers cafe Annex' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tigers cafe Pacol' })).toBeVisible();
});
