import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
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
});
