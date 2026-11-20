import { expect, test } from '@playwright/test';

async function loginAs(page: import('@playwright/test').Page, email: string, dashboardText: RegExp) {
  await page.goto('/');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill('tigers123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/dashboard|sales/);
  await expect(page.getByText(dashboardText).first()).toBeVisible();
}

test('owner scoped to a branch sees API figures in Ask AI', async ({ page }) => {
  await loginAs(page, 'roy@tigerscafe.ph', /Dashboard/);
  await page.getByLabel('Branch').selectOption('main');
  await page.getByRole('button', { name: 'Ask AI about your data' }).click();
  await expect(page.getByRole('textbox', { name: 'Ask about your data' })).toBeVisible();
  // Figures load async; re-ask until the panel has them (first answer may be the loading/error fallback)
  const ask = async (q: string, answer: RegExp) => {
    await expect(async () => {
      await page.getByPlaceholder('Ask about your data').fill(q);
      await page.getByRole('button', { name: 'Send' }).click();
      await expect(page.getByText(answer).last()).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });
  };
  await ask('Which branch is best?', /leads with ₱/);
  await ask('Where are expenses going?', /Total expenses are/);
});

test('manager Ask AI answers without undefined branch names', async ({ page }) => {
  await loginAs(page, 'main@tigerscafe.ph', /Branch dashboard|Tigers cafe Main/);
  await page.getByRole('button', { name: 'Ask AI about your data' }).click();
  await expect(page.getByRole('textbox', { name: 'Ask about your data' })).toBeVisible();
  // Answers are snapshots; re-ask once the API figures have loaded.
  await expect(async () => {
    await page.getByPlaceholder('Ask about your data').fill('Which branch is best?');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText(/You have access to one branch/).last()).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await expect(page.locator('body')).not.toContainText('undefined leads');
});
