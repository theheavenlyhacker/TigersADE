import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DB, Db } from '../../db/db.module';
import { branches, expenseCategories, productCategories, products } from '../../db/schema';
import { Executor } from '../../db/unit-of-work';
import { UNIQUE_VIOLATION, pgCode } from '../../shared/pg-error';
import { asText } from '../../shared/sql';
import { CatalogRepository, ProductRecord } from '../application/catalog.repository';

const productView = { id: products.id, categoryId: products.categoryId, name: products.name, price: asText(products.price), unitCost: asText(products.unitCost) };
const productRecord = { ...productView, active: products.active };

async function unique<T>(work: Promise<T>): Promise<T> {
  try { return await work; } catch (error) {
    if (pgCode(error) === UNIQUE_VIOLATION) throw new ConflictException('A record with this name already exists');
    throw error;
  }
}

@Injectable()
export class DrizzleCatalogRepository extends CatalogRepository {
  constructor(@Inject(DB) private readonly db: Db) { super(); }

  async version() {
    const result = await this.db.execute<{ version: string | null }>(sql`select to_char(max(updated_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as version from (
      select updated_at from branches union all select updated_at from products
      union all select updated_at from product_categories union all select updated_at from expense_categories
    ) catalog_updates`);
    return result.rows[0].version ?? new Date(0).toISOString();
  }

  branches() { return this.db.select({ id: branches.id, code: branches.code, name: branches.name }).from(branches).orderBy(asc(branches.code)); }
  productCategories() { return this.db.select({ id: productCategories.id, name: productCategories.name }).from(productCategories).where(eq(productCategories.active, true)).orderBy(asc(productCategories.name)); }
  expenseCategories() { return this.db.select({ id: expenseCategories.id, name: expenseCategories.name }).from(expenseCategories).orderBy(asc(expenseCategories.name)); }

  products() {
    return this.db.select({ ...productView, categoryName: productCategories.name }).from(products)
      .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
      .where(and(eq(products.active, true), eq(productCategories.active, true))).orderBy(asc(products.name));
  }

  async createProductCategory(name: string) {
    return unique(this.db.insert(productCategories).values({ name, updatedAt: sql`now()` }).returning({ id: productCategories.id, name: productCategories.name }).then(r => r[0]));
  }

  async updateProductCategory(id: string, change: { name?: string; archive: boolean }) {
    const rows = await unique(this.db.update(productCategories).set({
      ...(change.name !== undefined && { name: change.name }), ...(change.archive && { active: false }), updatedAt: sql`now()`,
    }).where(eq(productCategories.id, id)).returning({ id: productCategories.id, name: productCategories.name, active: productCategories.active }));
    return rows[0] ?? null;
  }

  async hasActiveProductCategory(tx: Executor, id: string) {
    const rows = await tx.select({ id: productCategories.id }).from(productCategories).where(and(eq(productCategories.id, id), eq(productCategories.active, true)));
    return rows.length > 0;
  }

  async insertProduct(tx: Executor, p: { categoryId: string; name: string; price: string; unitCost: string }) {
    if (!(await this.hasActiveProductCategory(tx, p.categoryId))) return null;
    const rows = await unique(tx.insert(products).values({ categoryId: p.categoryId, name: p.name, price: BigInt(p.price), unitCost: BigInt(p.unitCost), updatedAt: sql`now()` }).returning(productView));
    return rows[0];
  }

  async lockProduct(tx: Executor, id: string) {
    const [row] = await tx.select(productRecord).from(products).where(eq(products.id, id)).for('update');
    return row ?? null;
  }

  async saveProduct(tx: Executor, id: string, next: ProductRecord) {
    const rows = await unique(tx.update(products).set({
      categoryId: next.categoryId, name: next.name, price: BigInt(next.price), unitCost: BigInt(next.unitCost), active: next.active, updatedAt: sql`now()`,
    }).where(eq(products.id, id)).returning(productRecord));
    return rows[0];
  }

  createExpenseCategory(name: string) {
    return unique(this.db.insert(expenseCategories).values({ name, updatedAt: sql`now()` }).returning({ id: expenseCategories.id, name: expenseCategories.name }).then(r => r[0]));
  }

  async renameExpenseCategory(id: string, name: string) {
    const rows = await unique(this.db.update(expenseCategories).set({ name, updatedAt: sql`now()` }).where(eq(expenseCategories.id, id)).returning({ id: expenseCategories.id, name: expenseCategories.name }));
    return rows[0] ?? null;
  }
}
