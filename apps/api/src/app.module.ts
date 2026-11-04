import { CallHandler, ExecutionContext, HttpStatus, Injectable, MiddlewareConsumer, Module, NestInterceptor, NestModule, RequestMethod, ValidationPipe } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { NextFunction, Request, Response } from 'express';
import { Pool } from 'pg';
import { mergeMap } from 'rxjs';
import { DB_POOL, DbModule } from './db/db.module';
import { CLOCK, SystemClock } from './clock';
import { AuthModule } from './auth/auth.module';
import { catalogVersion } from './catalog-version';

@Injectable()
class CatalogVersionHeader {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}
  async use(_req: Request, res: Response, next: NextFunction) {
    const version = await catalogVersion(this.pool);
    res.locals.catalogVersion = version;
    res.setHeader('X-Catalog-Version', version);
    next();
  }
}

@Injectable()
class CatalogVersionInterceptor implements NestInterceptor {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const res = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(mergeMap(async value => {
      res.setHeader('X-Catalog-Version', await catalogVersion(this.pool));
      return value;
    }));
  }
}

@Module({
  imports: [DbModule, AuthModule],
  providers: [{ provide: CLOCK, useClass: SystemClock }, { provide: APP_INTERCEPTOR, useClass: CatalogVersionInterceptor }, { provide: APP_PIPE, useFactory: () => new ValidationPipe({ transform: true, errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }) }],
  exports: [CLOCK],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CatalogVersionHeader).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
