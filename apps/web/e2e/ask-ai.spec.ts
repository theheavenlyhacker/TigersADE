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
  await loginAs(page, 'roy@tigerscafe.ph', /Executive dashboard/);
  await page.getByLabel('Branch').selectOption('main');
  await page.getByRole('button', { name: 'Ask AI about your data' }).click();
  await page.getByRole('button', { name: 'Which branch is best?' }).click();
  await expect(page.getByText(/leads with ₱/)).toBeVisible();
  await page.getByPlaceholder('Ask about your data').fill('Where are expenses going?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(/Total expenses are/).last()).toBeVisible();
});

test('manager Ask AI answers without undefined branch names', async ({ page }) => {
  await loginAs(page, 'main@tigerscafe.ph', /Branch dashboard|Tigers cafe Main/);
  await page.getByRole('button', { name: 'Ask AI about your data' }).click();
  await page.getByPlaceholder('Ask about your data').fill('Which branch is best?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(/You have access to one branch/)).toBeVisible();
  await expect(page.locator('body')).not.toContainText('undefined leads');
});
