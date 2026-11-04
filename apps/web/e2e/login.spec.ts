import { expect, test } from '@playwright/test';

test('login page renders while the API is running', async ({ page, request }) => {
  const apiDocs = await request.get('http://127.0.0.1:4000/docs-json');
  expect(apiDocs.ok()).toBeTruthy();

  await page.goto('/');
  await expect(page.getByText('Tigers café', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
});
