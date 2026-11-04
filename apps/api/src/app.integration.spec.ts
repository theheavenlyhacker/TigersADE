import { Test } from '@nestjs/testing';
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { AppModule } from './app.module';
import { CLOCK } from './clock';
import { DB, Db } from './db/db.module';
import { setupApiDocs } from './main';

describe('API foundation (Postgres)', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterAll(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  async function createTestApp(nodeEnv: string, fixedNow: Date) {
    process.env.NODE_ENV = nodeEnv;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CLOCK)
      .useValue({ now: () => fixedNow })
      .compile();
    const app = module.createNestApplication();
    setupApiDocs(app);
    await app.init();
    return app;
  }

  it('boots against Postgres and exposes an overridable Manila clock', async () => {
    const fixedNow = new Date('2026-11-04T12:34:56+08:00');
    const app = await createTestApp('test', fixedNow);
    try {
      await expect(app.get<Db>(DB).execute(sql`select 1`)).resolves.toBeDefined();
      expect(app.get<{ now(): Date }>(CLOCK).now().toISOString()).toBe('2026-11-04T04:34:56.000Z');
    } finally {
      await app.close();
    }
  });

  it('serves Swagger outside production and omits the route in production', async () => {
    const devApp = await createTestApp('test', new Date());
    try {
      await request(devApp.getHttpServer()).get('/docs').expect(200);
      await request(devApp.getHttpServer()).get('/docs-json').expect(200);
    } finally {
      await devApp.close();
    }

    const prodApp = await createTestApp('production', new Date());
    try {
      await request(prodApp.getHttpServer()).get('/docs').expect(404);
      await request(prodApp.getHttpServer()).get('/docs-json').expect(404);
    } finally {
      await prodApp.close();
    }
  });

  it('lets only the owner manage users, resets passwords, and ends every session on deactivation', async () => {
    const app = await createTestApp('test', new Date());
    const db = app.get<Db>(DB);
    const email = `issue14-${randomUUID()}@tigerscafe.ph`;
    const suffix = randomUUID();
    const staffName = `Issue 14 Roster ${suffix}`;
    const updatedStaffName = `Updated Roster ${suffix}`;
    const staffIds: string[] = [];
    try {
      const login = async (address: string, password = process.env.DEV_PASSWORD ?? 'tigers123') => {
        const r = await request(app.getHttpServer()).post('/auth/login').send({ email: address, password });
        return r;
      };
      const owner = await login('roy@tigerscafe.ph');
      const ownerCookie = owner.headers['set-cookie'][0].split(';')[0];
      const branch = await db.execute(sql`select id from branches where code='main'`);
      const mainId = branch.rows[0].id as string;
      await request(app.getHttpServer()).post('/users').set('Cookie', ownerCookie).send({ email: `bad-branch-${suffix}@tigerscafe.ph`, name: 'Invalid branch', password: 'initial-pass-14', role: 'cashier', branchIds: [randomUUID()] }).expect(422);
      const created = await request(app.getHttpServer()).post('/users').set('Cookie', ownerCookie).send({ email, name: 'Issue 14 User', password: 'initial-pass-14', role: 'cashier', branchIds: [mainId] }).expect(201);
      const manager = await login('main@tigerscafe.ph');
      const managerCookie = manager.headers['set-cookie'][0].split(';')[0];
      await request(app.getHttpServer()).get('/users').set('Cookie', managerCookie).expect(403);
      await request(app.getHttpServer()).get('/branches/not-a-uuid/staff-members').set('Cookie', ownerCookie).expect(422);
      await request(app.getHttpServer()).post('/branches/not-a-uuid/staff-members').set('Cookie', ownerCookie).send({ name: staffName, position: 'Barista', shiftStart: '06:00', shiftEnd: '14:00' }).expect(422);
      await request(app.getHttpServer()).post(`/branches/${randomUUID()}/staff-members`).set('Cookie', ownerCookie).send({ name: staffName, position: 'Barista', shiftStart: '06:00', shiftEnd: '14:00' }).expect(422);
      const staff = await request(app.getHttpServer()).post(`/branches/${mainId}/staff-members`).set('Cookie', managerCookie).send({ name: staffName, position: 'Barista', shiftStart: '06:00', shiftEnd: '14:00' }).expect(201);
      staffIds.push(staff.body.id);
      await request(app.getHttpServer()).post(`/branches/${mainId}/staff-members`).set('Cookie', managerCookie).send({ name: staffName, position: 'Barista', shiftStart: '06:00', shiftEnd: '14:00' }).expect(409);
      const otherStaffName = `Other Roster ${suffix}`;
      const otherStaff = await request(app.getHttpServer()).post(`/branches/${mainId}/staff-members`).set('Cookie', managerCookie).send({ name: otherStaffName, position: 'Barista', shiftStart: '06:00', shiftEnd: '14:00' }).expect(201);
      staffIds.push(otherStaff.body.id);
      const otherBranch = await db.execute(sql`select id from branches where code='annex'`);
      await request(app.getHttpServer()).patch(`/branches/${otherBranch.rows[0].id}/staff-members/${staff.body.id}`).set('Cookie', managerCookie).send({ active: false }).expect(403);
      await request(app.getHttpServer()).patch(`/branches/not-a-uuid/staff-members/${staff.body.id}`).set('Cookie', ownerCookie).send({ active: false }).expect(422);
      await request(app.getHttpServer()).patch(`/branches/${mainId}/staff-members/${staff.body.id}`).set('Cookie', managerCookie).send({ name: updatedStaffName, position: 'Cashier', shiftStart: '07:00', shiftEnd: '15:00' }).expect(200);
      await request(app.getHttpServer()).patch(`/branches/${mainId}/staff-members/${staff.body.id}`).set('Cookie', managerCookie).send({ name: otherStaffName, position: 'Cashier', shiftStart: '07:00', shiftEnd: '15:00' }).expect(409);
      await request(app.getHttpServer()).patch(`/users/${created.body.id}`).set('Cookie', ownerCookie).send({ role: 'cashier', branchIds: [mainId], staffMemberId: staff.body.id }).expect(200);
      await request(app.getHttpServer()).patch(`/users/${created.body.id}`).set('Cookie', ownerCookie).send({ role: 'manager', branchIds: [mainId] }).expect(200);
      const linkedUser = await db.execute(sql`select staff_member_id from users where id=${created.body.id}`);
      expect(linkedUser.rows[0].staff_member_id).toBe(staff.body.id);
      await request(app.getHttpServer()).patch(`/branches/${mainId}/staff-members/${staff.body.id}`).set('Cookie', managerCookie).send({ active: false }).expect(200);
      const oldLogin = await login(email, 'initial-pass-14');
      expect(oldLogin.status).toBe(201);
      await request(app.getHttpServer()).post(`/users/${created.body.id}/password`).set('Cookie', managerCookie).send({ password: 'reset-pass-14' }).expect(403);
      await request(app.getHttpServer()).post(`/users/${created.body.id}/password`).set('Cookie', ownerCookie).send({ password: 'reset-pass-14' }).expect(201);
      expect((await login(email, 'initial-pass-14')).status).toBe(401);
      const loggedIn = await login(email, 'reset-pass-14');
      expect(loggedIn.status).toBe(201);
      const userCookie = loggedIn.headers['set-cookie'][0].split(';')[0];
      await request(app.getHttpServer()).get('/me').set('Cookie', userCookie).expect(200);
      await request(app.getHttpServer()).post(`/users/${created.body.id}/deactivate`).set('Cookie', ownerCookie).send({}).expect(201);
      await request(app.getHttpServer()).get('/me').set('Cookie', userCookie).expect(401);
      const sessions = await db.execute(sql`select count(*)::int as count from sessions where user_id=${created.body.id}`);
      expect(sessions.rows[0].count).toBe(0);
      const activity = await db.execute(sql`select action from activity_log where payload->>'userId'=${created.body.id}`);
      expect(activity.rows.map(r => r.action)).toEqual(expect.arrayContaining(['user.created','user.deactivated']));
    } finally {
      await db.execute(sql`delete from users where email=${email}`);
      for (const staffId of staffIds) await db.execute(sql`delete from staff_members where id=${staffId}`);
      await app.close();
    }
  });

  it('limits a branch manager to their assigned branch on the API', async () => {
    const app = await createTestApp('test', new Date());
    try {
      const db = app.get<Db>(DB);
      const branches = await db.execute(sql`select id, code from branches order by code`);
      const main = (branches.rows as Array<{ id: string; code: string }>).find(b => b.code === 'main')!;
      const other = (branches.rows as Array<{ id: string; code: string }>).find(b => b.code !== 'main')!;
      const login = await request(app.getHttpServer()).post('/auth/login').send({ email: 'main@tigerscafe.ph', password: process.env.DEV_PASSWORD ?? 'tigers123' }).expect(201);
      const cookie = login.headers['set-cookie'][0].split(';')[0];
      const token = cookie.slice('ade_session='.length);
      const tokenHash = createHash('sha256').update(token).digest('hex');
      await db.execute(sql`update sessions set expires_at = now() + interval '1 day' where token_hash = ${tokenHash}`);
      await request(app.getHttpServer()).get(`/branches/${main.id}`).set('Cookie', cookie).expect(200);
      await request(app.getHttpServer()).get(`/branches/${other.id}`).set('Cookie', cookie).expect(403);
      const session = await db.execute(sql`select expires_at > now() + interval '6 days' as extended from sessions where token_hash = ${tokenHash}`);
      expect(session.rows[0].extended).toBe(true);
      await request(app.getHttpServer()).post('/auth/logout').set('Cookie', cookie).expect(201);
      await request(app.getHttpServer()).get('/me').set('Cookie', cookie).expect(401);
      const badPassword = await request(app.getHttpServer()).post('/auth/login').send({ email: 'main@tigerscafe.ph', password: 'wrong' }).expect(401);
      const badEmail = await request(app.getHttpServer()).post('/auth/login').send({ email: 'missing@tigerscafe.ph', password: 'wrong' }).expect(401);
      expect(badEmail.body).toEqual(badPassword.body);
    } finally { await app.close(); }
  });

  it('lets only the owner change branch settings and lists immutable audit entries newest first with paging', async () => {
    const app = await createTestApp('test', new Date());
    try {
      const db = app.get<Db>(DB);
      const branches = await db.execute(sql`select id, code from branches order by code`);
      const main = (branches.rows as Array<{ id: string; code: string }>).find(b => b.code === 'main')!;
      const annex = (branches.rows as Array<{ id: string; code: string }>).find(b => b.code === 'annex')!;
      await db.execute(sql`delete from activity_log where branch_id = ${main.id}`);
      await db.execute(sql`update branches set daily_target = null, day_cutoff = '00:00' where id = ${main.id}`);
      await db.execute(sql`delete from users where email = 'issue5-cashier@tigerscafe.ph'`);
      await db.execute(sql`insert into users (email, password_hash, name, role) select 'issue5-cashier@tigerscafe.ph', password_hash, 'Test Cashier', 'cashier' from users where email = 'main@tigerscafe.ph'`);
      await db.execute(sql`insert into user_branches (user_id, branch_id) select u.id, ${main.id} from users u where u.email = 'issue5-cashier@tigerscafe.ph'`);
      const login = async (email: string) => {
        const result = await request(app.getHttpServer()).post('/auth/login').send({ email, password: process.env.DEV_PASSWORD ?? 'tigers123' }).expect(201);
        expect(result.headers['x-catalog-version']).toBeTruthy();
        return result.headers['set-cookie'][0].split(';')[0];
      };
      const owner = await login('roy@tigerscafe.ph');
      const manager = await login('main@tigerscafe.ph');
      const cashier = await login('issue5-cashier@tigerscafe.ph');
      await request(app.getHttpServer()).patch(`/branches/${main.id}`).set('Cookie', manager).send({ dailyTarget: '2500000' }).expect(403);
      await request(app.getHttpServer()).patch(`/branches/${main.id}`).set('Cookie', cashier).send({ dailyTarget: '2500000' }).expect(403);
      await request(app.getHttpServer()).patch(`/branches/${main.id}`).set('Cookie', owner).send({ dailyTarget: '2500000' }).expect(200);
      await request(app.getHttpServer()).patch(`/branches/${main.id}`).set('Cookie', owner).send({ dayCutoff: '04:30' }).expect(200);
      const settings = await db.execute(sql`select daily_target, day_cutoff from branches where id = ${main.id}`);
      expect(settings.rows[0]).toMatchObject({ daily_target: '2500000', day_cutoff: '04:30:00' });
      const audited = await db.execute(sql`select count(*)::int as count from activity_log where branch_id = ${main.id}`);
      expect(audited.rows[0].count).toBe(2);
      const filtered = await request(app.getHttpServer()).get(`/activity?branch=${main.id}&limit=1`).set('Cookie', owner).expect(200);
      expect(filtered.body.items).toHaveLength(1);
      const ownerId = await db.execute(sql`select id from users where email = 'roy@tigerscafe.ph'`);
      expect(filtered.body.items[0]).toMatchObject({ branchId: main.id, actorId: ownerId.rows[0].id, actorName: 'Roy Fabay', action: 'branch.cutoff_changed', payload: { dayCutoff: { before: '00:00', after: '04:30' } } });
      expect(filtered.body.nextBefore).toBeTruthy();
      const older = await request(app.getHttpServer()).get(`/activity?branch=${main.id}&limit=1&before=${filtered.body.nextBefore}`).set('Cookie', owner).expect(200);
      expect(older.body.items[0]).toMatchObject({ action: 'branch.target_changed', payload: { dailyTarget: { before: null, after: '2500000' } } });
      await request(app.getHttpServer()).get('/activity?before=99999999999999999999').set('Cookie', owner).expect(422);
      await request(app.getHttpServer()).get(`/activity?branch=${annex.id}`).set('Cookie', manager).expect(403);
      await request(app.getHttpServer()).patch(`/activity/${filtered.body.items[0].id}`).set('Cookie', owner).send({ action: 'edited' }).expect(404);
      await request(app.getHttpServer()).delete(`/activity/${filtered.body.items[0].id}`).set('Cookie', owner).expect(404);
    } finally { await app.close(); }
  });

  it('manages products and categories as the owner and versions every catalog response', async () => {
    const app = await createTestApp('test', new Date());
    try {
      const db = app.get<Db>(DB);
      const login = async (email: string) => {
        const result = await request(app.getHttpServer()).post('/auth/login').send({ email, password: process.env.DEV_PASSWORD ?? 'tigers123' }).expect(201);
        return result.headers['set-cookie'][0].split(';')[0];
      };
      const owner = await login('roy@tigerscafe.ph');
      const manager = await login('main@tigerscafe.ph');
      const suffix = Date.now().toString();
      const category = await request(app.getHttpServer()).post('/product-categories').set('Cookie', owner).send({ name: `Issue6 test category ${suffix}` }).expect(201);
      await request(app.getHttpServer()).post('/product-categories').set('Cookie', owner).send({ name: `Issue6 test category ${suffix}` }).expect(409);
      const product = await request(app.getHttpServer()).post('/products').set('Cookie', owner).send({ name: `Issue6 test product ${suffix}`, categoryId: category.body.id, price: '25000', unitCost: '9000' }).expect(201);
      const created = await request(app.getHttpServer()).get('/catalog').set('Cookie', manager).expect(200);
      expect(created.headers['x-catalog-version']).toBe(created.body.version);
      expect(created.body.products).toContainEqual(expect.objectContaining({ id: product.body.id, price: '25000', unitCost: '9000' }));
      await request(app.getHttpServer()).get('/catalog').set('Cookie', manager).set('If-None-Match', created.body.version).expect(304).expect('X-Catalog-Version', created.body.version);
      await request(app.getHttpServer()).post('/products').set('Cookie', manager).send({ name: 'Denied', categoryId: category.body.id, price: '1', unitCost: '1' }).expect(403);
      const priceChange = await request(app.getHttpServer()).patch(`/products/${product.body.id}`).set('Cookie', owner).send({ price: '27000' }).expect(200);
      const changed = await request(app.getHttpServer()).get('/catalog').set('Cookie', manager).expect(200);
      expect(changed.body.version).not.toBe(created.body.version);
      expect(priceChange.headers['x-catalog-version']).toBe(changed.body.version);
      await request(app.getHttpServer()).patch(`/products/${product.body.id}`).set('Cookie', owner).send({ active: false }).expect(200);
      const archived = await request(app.getHttpServer()).get('/catalog').set('Cookie', manager).expect(200);
      expect(archived.body.products.some((p: { id: string }) => p.id === product.body.id)).toBe(false);
      const audit = await db.execute(sql`select action, payload from activity_log where payload->>'productId' = ${product.body.id} order by id`);
      expect(audit.rows).toEqual(expect.arrayContaining([
        expect.objectContaining({ action: 'product.created' }),
        expect.objectContaining({ action: 'price.changed', payload: expect.objectContaining({ price: { before: '25000', after: '27000' } }) }),
        expect.objectContaining({ action: 'product.archived' }),
      ]));
      expect((await request(app.getHttpServer()).get('/me').set('Cookie', manager)).headers['x-catalog-version']).toBe(archived.body.version);
      const persisted = await db.execute(sql`select active from products where id = ${product.body.id}`);
      expect(persisted.rows[0].active).toBe(false);
      await request(app.getHttpServer()).patch(`/product-categories/${category.body.id}`).set('Cookie', owner).send({ name: `Issue6 renamed category ${suffix}` }).expect(200);
      const renamed = await request(app.getHttpServer()).get('/catalog').set('Cookie', manager).expect(200);
      expect(renamed.body.version).not.toBe(archived.body.version);
      await request(app.getHttpServer()).patch(`/product-categories/${category.body.id}`).set('Cookie', owner).send({ active: false }).expect(200);
      const categoriesArchived = await request(app.getHttpServer()).get('/catalog').set('Cookie', manager).expect(200);
      expect(categoriesArchived.body.productCategories.some((c: { id: string }) => c.id === category.body.id)).toBe(false);
      expect(categoriesArchived.headers['x-catalog-version']).toBe(categoriesArchived.body.version);
      const main = await db.execute(sql`select id from branches where code = 'main'`);
      const branchEdit = await request(app.getHttpServer()).patch(`/branches/${main.rows[0].id}`).set('Cookie', owner).send({ dailyTarget: '2600000' }).expect(200);
      const branchVersion = await request(app.getHttpServer()).get('/catalog').set('Cookie', manager).expect(200);
      expect(branchEdit.headers['x-catalog-version']).toBe(branchVersion.body.version);
      const expenseCategory = await db.execute(sql`select id from expense_categories limit 1`);
      const expenseEdit = await request(app.getHttpServer()).patch(`/expense-categories/${expenseCategory.rows[0].id}`).set('Cookie', owner).send({ name: `Issue6 expense ${suffix}` }).expect(200);
      const expenseVersion = await request(app.getHttpServer()).get('/catalog').set('Cookie', manager).expect(200);
      expect(expenseEdit.headers['x-catalog-version']).toBe(expenseVersion.body.version);
    } finally { await app.close(); }
  });

  it('records idempotent sales with catalog snapshots, cutoff business days, and gapless concurrent numbers', async () => {
    const fixedNow = new Date('2026-11-03T19:59:00Z'); // 03:59 Manila
    const app = await createTestApp('test', fixedNow);
    const db = app.get<Db>(DB);
    let branchId: string | undefined;
    let originalCutoff = '00:00';
    let archivedProductId: string | undefined;
    try {
      const branch = await db.execute(sql`select id, next_sale_no, to_char(day_cutoff, 'HH24:MI') as day_cutoff from branches where code = 'main'`);
      branchId = branch.rows[0].id as string;
      originalCutoff = branch.rows[0].day_cutoff as string;
      const firstSaleNo = Number(branch.rows[0].next_sale_no);
      await db.execute(sql`update branches set day_cutoff = '04:00' where id = ${branchId}`);
      const product = await db.execute(sql`select p.id from products p join product_categories c on c.id = p.category_id where p.active and c.active limit 1`);
      const productId = product.rows[0].id as string;
      const login = await request(app.getHttpServer()).post('/auth/login').send({ email: 'cashier@tigerscafe.ph', password: process.env.DEV_PASSWORD ?? 'tigers123' }).expect(201);
      const cookie = login.headers['set-cookie'][0].split(';')[0];
      const managerLogin = await request(app.getHttpServer()).post('/auth/login').send({ email: 'main@tigerscafe.ph', password: process.env.DEV_PASSWORD ?? 'tigers123' }).expect(201);
      const managerCookie = managerLogin.headers['set-cookie'][0].split(';')[0];
      const sale = { id: randomUUID(), paymentMethod: 'cash', lines: [{ productId, qty: 2 }] };
      const created = await request(app.getHttpServer()).post(`/branches/${branchId}/sales`).set('Cookie', cookie).send(sale).expect(201);
      expect(created.body).toMatchObject({ saleNo: firstSaleNo, businessDate: '2026-11-03', total: expect.any(String), lines: [expect.objectContaining({ productId, qty: 2, productName: expect.any(String), unitPrice: expect.any(String), unitCost: expect.any(String) })] });
      await request(app.getHttpServer()).post(`/branches/${branchId}/sales`).set('Cookie', cookie).send(sale).expect(200).expect(({ body }) => expect(body.id).toBe(sale.id));
      const next = await Promise.all(Array.from({ length: 6 }, () => request(app.getHttpServer()).post(`/branches/${branchId}/sales`).set('Cookie', cookie).send({ ...sale, id: randomUUID(), paymentMethod: 'gcash' }).expect(201)));
      expect(next.map(r => r.body.saleNo).sort((a, b) => a - b)).toEqual([firstSaleNo + 1, firstSaleNo + 2, firstSaleNo + 3, firstSaleNo + 4, firstSaleNo + 5, firstSaleNo + 6]);
      await request(app.getHttpServer()).get(`/branches/${branchId}/sales?from=2026-11-03&to=2026-11-04`).set('Cookie', cookie).expect(403);
      const listing = await request(app.getHttpServer()).get(`/branches/${branchId}/sales?from=2026-11-03&to=2026-11-04`).set('Cookie', managerCookie).expect(200);
      expect(listing.body.map((row: { id: string }) => row.id)).toEqual(expect.arrayContaining([sale.id, ...next.map(r => r.body.id)]));
      await db.execute(sql`update branches set day_cutoff = '02:00' where id = ${branchId}`);
      const afterCutoffChange = await request(app.getHttpServer()).get(`/branches/${branchId}/sales?from=2026-11-03&to=2026-11-04`).set('Cookie', managerCookie).expect(200);
      expect(afterCutoffChange.body.find((row: { id: string }) => row.id === sale.id).businessDate).toBe('2026-11-03');
      const archived = await db.execute(sql`select id from products where active limit 1`);
      archivedProductId = archived.rows[0].id as string;
      await db.execute(sql`update products set active = false where id = ${archived.rows[0].id}`);
      await request(app.getHttpServer()).post(`/branches/${branchId}/sales`).set('Cookie', cookie).send({ ...sale, id: 'f83a7013-5054-4d0c-8764-2091dbdb2c3d', lines: [{ productId: archived.rows[0].id, qty: 1 }] }).expect(422);
    } finally {
      if (archivedProductId) await db.execute(sql`update products set active = true where id = ${archivedProductId}`);
      if (branchId) await db.execute(sql`update branches set day_cutoff = ${originalCutoff} where id = ${branchId}`);
      await app.close();
    }
  });

  it('voids sales with a reason, enforces cashier business days, and logs every void', async () => {
    const fixedNow = new Date('2026-11-03T10:00:00Z');
    const app = await createTestApp('test', fixedNow);
    const db = app.get<Db>(DB);
    try {
      const branch = await db.execute(sql`select id from branches where code = 'main'`);
      const branchId = branch.rows[0].id as string;
      const login = async (email: string) => {
        const result = await request(app.getHttpServer()).post('/auth/login').send({ email, password: process.env.DEV_PASSWORD ?? 'tigers123' }).expect(201);
        return result.headers['set-cookie'][0].split(';')[0];
      };
      const cashier = await login('cashier@tigerscafe.ph');
      const manager = await login('main@tigerscafe.ph');
      const product = await db.execute(sql`select id from products where active limit 1`);
      const record = async () => {
        const result = await request(app.getHttpServer()).post(`/branches/${branchId}/sales`).set('Cookie', cashier)
          .send({ id: randomUUID(), paymentMethod: 'cash', lines: [{ productId: product.rows[0].id, qty: 1 }] }).expect(201);
        return result.body as { id: string; saleNo: number; businessDate: string };
      };
      const previousDaySale = await record();
      fixedNow.setUTCDate(fixedNow.getUTCDate() + 1);
      await request(app.getHttpServer()).post(`/branches/${branchId}/sales/${previousDaySale.id}/void`).set('Cookie', cashier).send({ reason: 'wrong item' }).expect(403);
      const todaySale = await record();
      await request(app.getHttpServer()).post(`/branches/${branchId}/sales/${todaySale.id}/void`).set('Cookie', cashier).send({ reason: ' ' }).expect(422);
      const voided = await request(app.getHttpServer()).post(`/branches/${branchId}/sales/${todaySale.id}/void`).set('Cookie', cashier).send({ reason: '  wrong item  ' }).expect(201);
      expect(voided.body).toMatchObject({ id: todaySale.id, saleNo: todaySale.saleNo, businessDate: todaySale.businessDate, voidedBy: expect.any(String), voidReason: 'wrong item' });
      expect(voided.body.voidedAt).toBe(fixedNow.toISOString());
      await request(app.getHttpServer()).post(`/branches/${branchId}/sales/${todaySale.id}/void`).set('Cookie', cashier).send({ reason: 'duplicate' }).expect(409);
      const activity = await db.execute(sql`select action, actor_id, payload from activity_log where payload->>'saleId' = ${todaySale.id}`);
      expect(activity.rows).toHaveLength(1);
      expect(activity.rows[0]).toMatchObject({ action: 'sale.voided', payload: { saleId: todaySale.id, reason: 'wrong item' } });
      const listing = await request(app.getHttpServer()).get(`/branches/${branchId}/sales?from=2026-11-04&to=2026-11-04`).set('Cookie', manager).expect(200);
      expect(listing.body.find((sale: { id: string }) => sale.id === todaySale.id)).toMatchObject({ voidedBy: activity.rows[0].actor_id, voidReason: 'wrong item' });
      await request(app.getHttpServer()).post(`/branches/${branchId}/sales/${previousDaySale.id}/void`).set('Cookie', manager).send({ reason: 'manager correction' }).expect(201);
    } finally { await app.close(); }
  });

  it('records, edits and deletes branch expenses, reports their share of sales, and uses them in the summary', async () => {
    const app = await createTestApp('test', new Date('2025-03-01T01:00:00+08:00'));
    const db = app.get<Db>(DB);
    try {
      const branches = await db.execute(sql`select id, code from branches order by code`);
      const main = (branches.rows as Array<{ id: string; code: string }>).find(b => b.code === 'main')!;
      const annex = (branches.rows as Array<{ id: string; code: string }>).find(b => b.code === 'annex')!;
      await db.execute(sql`update branches set day_cutoff = '04:00' where id = ${annex.id}`);
      const category = await db.execute(sql`select id from expense_categories order by name limit 1`);
      const login = async (email: string) => {
        const result = await request(app.getHttpServer()).post('/auth/login').send({ email, password: process.env.DEV_PASSWORD ?? 'tigers123' }).expect(201);
        return result.headers['set-cookie'][0].split(';')[0];
      };
      const owner = await login('roy@tigerscafe.ph');
      const manager = await login('main@tigerscafe.ph');
      const cashier = await login('cashier@tigerscafe.ph');
      const body = { categoryId: category.rows[0].id, businessDate: '2025-02-28', amount: '12345', note: 'Milk delivery' };
      await request(app.getHttpServer()).post(`/branches/${main.id}/expenses`).set('Cookie', cashier).send(body).expect(403);
      await request(app.getHttpServer()).post(`/branches/${main.id}/expenses`).set('Cookie', manager).send({ ...body, amount: '0' }).expect(422);
      const created = await request(app.getHttpServer()).post(`/branches/${main.id}/expenses`).set('Cookie', manager).send(body).expect(201);
      expect(created.body).toMatchObject({ branchId: main.id, categoryId: category.rows[0].id, businessDate: body.businessDate, amount: body.amount, note: body.note });
      await request(app.getHttpServer()).get(`/branches/${annex.id}/expenses?from=2025-02-01&to=2025-02-28`).set('Cookie', manager).expect(403);
      const updated = await request(app.getHttpServer()).patch(`/branches/${main.id}/expenses/${created.body.id}`).set('Cookie', manager).send({ amount: '23456', note: 'Updated invoice' }).expect(200);
      expect(updated.body).toMatchObject({ amount: '23456', note: 'Updated invoice' });
      await request(app.getHttpServer()).get(`/branches/${main.id}/expenses?from=2025-02-01&to=2025-02-28`).set('Cookie', manager).expect(200).expect(({ body: rows }) => expect(rows).toContainEqual(expect.objectContaining({ id: created.body.id, amount: '23456' })));
      await request(app.getHttpServer()).delete(`/branches/${main.id}/expenses/${created.body.id}`).set('Cookie', owner).expect(200);
      const audit = await db.execute(sql`select action, payload from activity_log where payload->>'expenseId' = ${created.body.id} order by id`);
      expect(audit.rows.map(r => r.action)).toEqual(['expense.created', 'expense.updated', 'expense.deleted']);
      expect(audit.rows[1].payload).toMatchObject({ before: { amount: '12345' }, after: { amount: '23456' } });
      expect((audit.rows[2].payload as any).before).toMatchObject({ amount: '23456', note: 'Updated invoice' });
      const beforeReport = await request(app.getHttpServer()).get('/reports/expenses?branch=all&month=2025-02').set('Cookie', owner).expect(200);
      const beforeCategoryTotal = BigInt(beforeReport.body.categories.find((c: { categoryId: string }) => c.categoryId === category.rows[0].id).total);
      const beforeSummary = await request(app.getHttpServer()).get(`/reports/summary?branch=${annex.id}`).set('Cookie', owner).expect(200);
      const anyBranchExpense = await request(app.getHttpServer()).post(`/branches/${annex.id}/expenses`).set('Cookie', owner).send(body).expect(201);
      const report = await request(app.getHttpServer()).get('/reports/expenses?branch=all&month=2025-02').set('Cookie', owner).expect(200);
      expect(BigInt(report.body.categories.find((c: { categoryId: string }) => c.categoryId === category.rows[0].id).total)).toBe(beforeCategoryTotal + 12345n);
      expect(report.body.shareOfSales === null || typeof report.body.shareOfSales === 'number').toBe(true);
      const summary = await request(app.getHttpServer()).get(`/reports/summary?branch=${annex.id}`).set('Cookie', owner).expect(200);
      expect(BigInt(summary.body.expenses)).toBe(BigInt(beforeSummary.body.expenses) + 12345n);
      expect(summary.body).toMatchObject({ operatingContribution: (BigInt(summary.body.sales) - BigInt(summary.body.expenses)).toString() });
      await request(app.getHttpServer()).delete(`/branches/${annex.id}/expenses/${anyBranchExpense.body.id}`).set('Cookie', owner).expect(200);
    } finally { await app.close(); }
  });
});
