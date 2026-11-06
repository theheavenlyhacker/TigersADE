import { Browser, Page, expect, test } from '@playwright/test';

const API = 'http://127.0.0.1:4000';

async function logIn(page: Page, email: string) {
  await page.goto('/');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill('tigers123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/$/);
}

async function newPage(browser: Browser) {
  const context = await browser.newContext();
  return { page: await context.newPage(), close: () => context.close() };
}

test('a branch manager is blocked from another branch, in the app and on the API', async ({ browser }) => {
  const owner = await newPage(browser);
  const manager = await newPage(browser);
  try {
    await logIn(owner.page, 'roy@tigerscafe.ph');
    const { branches } = await (await owner.page.request.get(`${API}/me`)).json() as { branches: { id: string; name: string }[] };
    await logIn(manager.page, 'main@tigerscafe.ph');
    const mine = (await (await manager.page.request.get(`${API}/me`)).json() as { branches: { id: string }[] }).branches;
    expect(mine).toHaveLength(1);
    const other = branches.find(b => b.id !== mine[0].id)!;

    await expect(manager.page.getByRole('button', { name: other.name })).toHaveCount(0);
    for (const path of [`/branches/${other.id}`, `/branches/${other.id}/inventory`, `/branches/${other.id}/staff-members`]) {
      expect((await manager.page.request.get(`${API}${path}`)).status(), path).toBe(403);
    }
    expect((await manager.page.request.get(`${API}/reports/summary?branch=${other.id}`)).status()).toBe(403);
    expect((await manager.page.request.get(`${API}/reports/summary?branch=all`)).status()).toBe(403);
    expect((await manager.page.request.get(`${API}/branches/${mine[0].id}`)).status()).toBe(200);
  } finally {
    await owner.close();
    await manager.close();
  }
});

test("an owner's price change reaches the POS once the catalog refreshes", async ({ browser }) => {
  const owner = await newPage(browser);
  const cashier = await newPage(browser);
  const setPrice = async (pesos: string) => {
    await owner.page.goto('/products');
    const row = owner.page.getByRole('row').filter({ hasText: 'Flat white' });
    await row.getByLabel('Price for Flat white').fill(pesos);
    await row.getByRole('button', { name: 'Save price' }).click();
  };
  try {
    await logIn(cashier.page, 'cashier@tigerscafe.ph');
    const flatWhite = cashier.page.getByRole('button', { name: /Flat white/ });
    await expect(flatWhite).toContainText('₱140');

    await logIn(owner.page, 'roy@tigerscafe.ph');
    await setPrice('141.00');
    await expect(owner.page.getByRole('row').filter({ hasText: 'Flat white' })).toContainText('₱141');

    await cashier.page.reload();
    await expect(flatWhite).toContainText('₱141');
  } finally {
    await setPrice('140.00').catch(() => {});
    await owner.close();
    await cashier.close();
  }
});
