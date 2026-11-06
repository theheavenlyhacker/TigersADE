import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module';
import { CatalogRepository } from './application/catalog.repository';
import { CatalogService } from './application/catalog.service';
import { DrizzleCatalogRepository } from './infrastructure/drizzle-catalog.repository';
import { CatalogController } from './presentation/catalog.controller';
import { CatalogVersionInterceptor, CatalogVersionMiddleware } from './presentation/catalog-version';

@Module({
  imports: [AuthModule],
  controllers: [CatalogController],
  providers: [CatalogService, { provide: CatalogRepository, useClass: DrizzleCatalogRepository }, { provide: APP_INTERCEPTOR, useClass: CatalogVersionInterceptor }, CatalogVersionMiddleware],
})
export class CatalogModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CatalogVersionMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
