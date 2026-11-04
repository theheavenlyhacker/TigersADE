import { Test } from '@nestjs/testing';
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
});
