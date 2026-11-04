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
});
