import { Body, Controller, Get, Param, Patch, Post, Req, Res, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CurrentUser as Current } from '../../auth/domain/current-user';
import { AccessGuard, CurrentUser } from '../../auth/presentation/access.guard';
import { Roles } from '../../auth/presentation/roles.decorator';
import { isEmptyPatch, uuidPipe } from '../../shared/validation';
import { CatalogService } from '../application/catalog.service';
import { CreateProductDto, NameDto, UpdateProductCategoryDto, UpdateProductDto } from './catalog.dto';

@ApiTags('catalog')
@Controller()
@UseGuards(AccessGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('catalog')
  async read(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const version = res.locals.catalogVersion as string;
    if (req.header('If-None-Match')?.replaceAll('"', '') === version) { res.status(304); return; }
    return this.catalog.read(version);
  }

  @Post('product-categories') @Roles('owner')
  createProductCategory(@Body() body: NameDto) { return this.catalog.createProductCategory(body.name); }

  @Patch('product-categories/:id') @Roles('owner')
  updateProductCategory(@Param('id', uuidPipe) id: string, @Body() body: UpdateProductCategoryDto) {
    if (isEmptyPatch(body)) throw new UnprocessableEntityException('Set a name or archive with active: false');
    return this.catalog.updateProductCategory(id, body);
  }

  @Post('products') @Roles('owner')
  createProduct(@Body() body: CreateProductDto, @CurrentUser() { user }: Current) { return this.catalog.createProduct(user.id, body); }

  @Patch('products/:id') @Roles('owner')
  changeProduct(@Param('id', uuidPipe) id: string, @Body() body: UpdateProductDto, @CurrentUser() { user }: Current) {
    if (isEmptyPatch(body)) throw new UnprocessableEntityException('Set product fields or archive with active: false');
    return this.catalog.changeProduct(user.id, id, body);
  }

  @Post('expense-categories') @Roles('owner')
  createExpenseCategory(@Body() body: NameDto) { return this.catalog.createExpenseCategory(body.name); }

  @Patch('expense-categories/:id') @Roles('owner')
  renameExpenseCategory(@Param('id', uuidPipe) id: string, @Body() body: NameDto) { return this.catalog.renameExpenseCategory(id, body.name); }
}
