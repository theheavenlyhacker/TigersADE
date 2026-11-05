import { expect, test } from '@playwright/test';

test('inventory page reads stock and low-stock state from the API', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Email').fill('main@tigerscafe.ph');
  await page.getByPlaceholder('Password').fill('tigers123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.getByRole('link', { name: 'Inventory', exact: true }).click();
  const espresso = page.getByRole('row').filter({ hasText: 'Espresso beans' });
  await expect(espresso).toContainText('Tigers cafe Main');
  const par = page.getByRole('spinbutton', { name: 'Par for Espresso beans at Tigers cafe Main' });
  await par.fill('43');
  await par.press('Tab');
  await expect(espresso).toContainText('Low stock');
  await par.fill('30');
  await par.press('Tab');
  await expect(espresso).not.toContainText('Low stock');
  await page.getByRole('button', { name: 'Show low stock only' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Espresso beans' })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'Oat milk' })).toContainText('Low stock');
});

test('inventory page flags negative stock for an item with no par set', async ({ page, request }) => {
  const api = 'http://127.0.0.1:4000';
  const login = await request.post(`${api}/auth/login`, { data: { email: 'roy@tigerscafe.ph', password: 'tigers123' } });
  expect(login.ok()).toBeTruthy();
  const main = (await (await request.get(`${api}/me`)).json()).branches.find((b: { code: string }) => b.code === 'main');
  const name = `E2E no par ${Date.now()}`;
  const item = await (await request.post(`${api}/inventory-items`, { data: { name, unit: 'kg', unitCost: '100' } })).json();
  try {
    expect((await request.post(`${api}/branches/${main.id}/stock-movements`, { data: { itemId: item.id, type: 'adjustment', quantity: '-1' } })).ok()).toBeTruthy();
    await page.goto('/');
    await page.getByPlaceholder('Email').fill('main@tigerscafe.ph');
    await page.getByPlaceholder('Password').fill('tigers123');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await page.getByRole('link', { name: 'Inventory', exact: true }).click();
    const row = page.getByRole('row').filter({ hasText: name });
    await expect(row).toContainText('Negative stock');
    await expect(page.getByRole('spinbutton', { name: `Par for ${name} at Tigers cafe Main` })).toHaveValue('');
    await page.getByRole('button', { name: 'Show low stock only' }).click();
    await expect(row).toContainText('Negative stock');
  } finally {
    await request.patch(`${api}/inventory-items/${item.id}`, { data: { active: false } });
  }
});
