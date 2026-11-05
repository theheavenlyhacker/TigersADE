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
  await expect(page.getByRole('textbox', { name: 'Ask about your data' })).toBeVisible();
  await expect.poll(async () => page.getByText(/leads with ₱/).textContent().catch(() => '')).toMatch(/leads with ₱/);
  await page.getByPlaceholder('Ask about your data').fill('Where are expenses going?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(/Total expenses are/).last()).toBeVisible();
});

test('manager Ask AI answers without undefined branch names', async ({ page }) => {
  await loginAs(page, 'main@tigerscafe.ph', /Branch dashboard|Tigers cafe Main/);
  // cash-close.spec runs before this in the shared DB and closes main's business day; wait for Ask AI to be open
  await page.getByRole('button', { name: 'Ask AI about your data' }).click();
  await expect(page.getByRole('textbox', { name: 'Ask about your data' })).toBeVisible();
  // Warm-up: summary may be slow; poll until the panel can answer
  await page.getByPlaceholder('Ask about your data').fill('Which branch is best?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect.poll(async () => {
    const text = await page.getByText(/You have access to one branch/).textContent().catch(() => page.getByText(/Could not load/).textContent().catch(() => ''));
    return text ? 'ready' : '';
  }, { timeout: 15000 }).toBe('ready');
  await expect(page.getByText(/You have access to one branch/)).toBeVisible();
  await expect(page.locator('body')).not.toContainText('undefined leads');
});
