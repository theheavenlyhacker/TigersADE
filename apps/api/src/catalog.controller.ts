import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Patch, Post, Req, Res, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Pool } from 'pg';
import { Request, Response } from 'express';
import { DB_POOL } from './db/db.module';
import { logActivity } from './db/activity';
import { AccessGuard, Roles } from './auth/access.guard';
import { AuthService, sessionToken } from './auth/auth.service';
import { rethrowUniqueConflict } from './db/unique-conflict';

const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const name = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 120;
const money = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value === 'string' && /^\d+$/.test(value) && BigInt(value) <= 9223372036854775807n) return value;
  return null;
};

@ApiTags('catalog')
@Controller()
@UseGuards(AccessGuard)
export class CatalogController {
  constructor(@Inject(DB_POOL) private readonly pool: Pool, private readonly auth: AuthService) {}

  @Get('catalog')
  async catalog(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const version = res.locals.catalogVersion as string;
    if (req.header('If-None-Match')?.replaceAll('"', '') === version) {
      res.status(304);
      return;
    }
    const [branchRows, categoryRows, productRows, expenseCategoryRows] = await Promise.all([
      this.pool.query('select id, code, name from branches order by code'),
      this.pool.query('select id, name from product_categories where active order by name'),
      this.pool.query(`select p.id, p.category_id as "categoryId", c.name as "categoryName", p.name, p.price::text, p.unit_cost::text as "unitCost"
        from products p join product_categories c on c.id = p.category_id where p.active and c.active order by p.name`),
      this.pool.query('select id, name from expense_categories order by name'),
    ]);
    return { version, branches: branchRows.rows, productCategories: categoryRows.rows, products: productRows.rows, expenseCategories: expenseCategoryRows.rows };
  }

  @Post('product-categories')
  @Roles('owner')
  async createProductCategory(@Body() body: Record<string, unknown>) {
    if (!name(body?.name)) throw new UnprocessableEntityException('name is required');
    let result;
    try { result = await this.pool.query('insert into product_categories (name, updated_at) values ($1, now()) returning id, name', [body.name.trim()]); }
    catch (error) { rethrowUniqueConflict(error); }
    return result.rows[0];
  }

  @Patch('product-categories/:id')
  @Roles('owner')
  async updateProductCategory(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    if (!uuid(id)) throw new BadRequestException('Invalid category');
    const keys = Object.keys(body ?? {});
    if (!keys.length || keys.some(key => !['name', 'active'].includes(key)) || ('name' in body && !name(body.name)) || ('active' in body && body.active !== false)) throw new UnprocessableEntityException('Set a name or archive with active: false');
    let result;
    try { result = await this.pool.query(`update product_categories set name = coalesce($1, name), active = case when $2 then false else active end,
      updated_at = now() where id = $3 returning id, name, active`, [typeof body.name === 'string' ? body.name.trim() : null, body.active === false, id]); }
    catch (error) { rethrowUniqueConflict(error); }
    if (!result.rowCount) throw new NotFoundException();
    return result.rows[0];
  }

  @Post('products')
  @Roles('owner')
  async createProduct(@Body() body: Record<string, unknown>, @Req() req: Request) {
    const price = money(body?.price), unitCost = money(body?.unitCost);
    if (!name(body?.name) || !uuid(body?.categoryId) || price === null || unitCost === null) throw new UnprocessableEntityException('name, categoryId, price and unitCost are required');
    const actor = await this.auth.current(sessionToken(req));
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await client.query(`insert into products (category_id, name, price, unit_cost, updated_at)
        select id, $2, $3, $4, now() from product_categories where id = $1 and active
        returning id, category_id as "categoryId", name, price::text, unit_cost::text as "unitCost"`, [body.categoryId, body.name.trim(), price, unitCost]);
      if (!result.rowCount) throw new NotFoundException('Product category not found');
      await logActivity(client, { branchId: null, actorId: actor.user.id, action: 'product.created', payload: { productId: result.rows[0].id, after: result.rows[0] } });
      await client.query('commit');
      return result.rows[0];
    } catch (error) { await client.query('rollback'); rethrowUniqueConflict(error); }
    finally { client.release(); }
  }

  @Patch('products/:id')
  @Roles('owner')
  async updateProduct(@Param('id') id: string, @Body() body: Record<string, unknown>, @Req() req: Request) {
    if (!uuid(id)) throw new BadRequestException('Invalid product');
    const allowed = ['name', 'categoryId', 'price', 'unitCost', 'active'];
    const keys = Object.keys(body ?? {});
    if (!keys.length || keys.some(key => !allowed.includes(key)) || ('active' in body && body.active !== false)) throw new UnprocessableEntityException('Set product fields or archive with active: false');
    if ('name' in body && !name(body.name)) throw new UnprocessableEntityException('Invalid name');
    if ('categoryId' in body && !uuid(body.categoryId)) throw new UnprocessableEntityException('Invalid categoryId');
    for (const key of ['price', 'unitCost']) if (key in body && money(body[key]) === null) throw new UnprocessableEntityException(`${key} must be non-negative integer centavos`);
    const actor = await this.auth.current(sessionToken(req));
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const current = await client.query('select id, category_id, name, price::text, unit_cost::text, active from products where id = $1 for update', [id]);
      if (!current.rowCount) throw new NotFoundException();
      const before = current.rows[0];
      if (!before.active) throw new NotFoundException();
      if (body.categoryId) {
        const category = await client.query('select id from product_categories where id = $1 and active', [body.categoryId]);
        if (!category.rowCount) throw new NotFoundException('Product category not found');
      }
      const next = { ...before, category_id: body.categoryId ?? before.category_id, name: typeof body.name === 'string' ? body.name.trim() : before.name,
        price: body.price === undefined ? before.price : money(body.price), unit_cost: body.unitCost === undefined ? before.unit_cost : money(body.unitCost),
        active: body.active === false ? false : before.active };
      const result = await client.query(`update products set category_id=$1, name=$2, price=$3, unit_cost=$4, active=$5, updated_at=now()
        where id=$6 returning id, category_id as "categoryId", name, price::text, unit_cost::text as "unitCost", active`,
      [next.category_id, next.name, next.price, next.unit_cost, next.active, id]);
      const after = result.rows[0];
      if (before.price !== after.price) await logActivity(client, { branchId: null, actorId: actor.user.id, action: 'price.changed', payload: { productId: id, price: { before: before.price, after: after.price } } });
      if (before.active && !after.active) await logActivity(client, { branchId: null, actorId: actor.user.id, action: 'product.archived', payload: { productId: id, before: { active: true }, after: { active: false } } });
      await client.query('commit');
      return after;
    } catch (error) { await client.query('rollback'); rethrowUniqueConflict(error); }
    finally { client.release(); }
  }

  @Post('expense-categories')
  @Roles('owner')
  async createExpenseCategory(@Body() body: Record<string, unknown>) {
    if (!name(body?.name)) throw new UnprocessableEntityException('name is required');
    try { return (await this.pool.query('insert into expense_categories (name, updated_at) values ($1, now()) returning id, name', [body.name.trim()])).rows[0]; }
    catch (error) { rethrowUniqueConflict(error); }
  }

  @Patch('expense-categories/:id')
  @Roles('owner')
  async updateExpenseCategory(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    if (!uuid(id)) throw new BadRequestException('Invalid category');
    if (Object.keys(body ?? {}).length !== 1 || !name(body?.name)) throw new UnprocessableEntityException('name is required');
    let result;
    try { result = await this.pool.query('update expense_categories set name=$1, updated_at=now() where id=$2 returning id, name', [body.name.trim(), id]); }
    catch (error) { rethrowUniqueConflict(error); }
    if (!result.rowCount) throw new NotFoundException();
    return result.rows[0];
  }
}
