import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { mergeMap } from 'rxjs';
import { CatalogService } from '../application/catalog.service';

/** Every response carries X-Catalog-Version so the browser knows when to refetch the catalog (spec §6). */
@Injectable()
export class CatalogVersionMiddleware {
  constructor(private readonly catalog: CatalogService) {}
  async use(_req: Request, res: Response, next: NextFunction) {
    try {
      const version = await this.catalog.version();
      res.locals.catalogVersion = version;
      res.setHeader('X-Catalog-Version', version);
      next();
    } catch (error) { next(error); }
  }
}

/** Refreshes the header after the handler ran, so a catalog change is visible in its own response. */
@Injectable()
export class CatalogVersionInterceptor implements NestInterceptor {
  constructor(private readonly catalog: CatalogService) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const res = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(mergeMap(async value => { res.setHeader('X-Catalog-Version', await this.catalog.version()); return value; }));
  }
}
