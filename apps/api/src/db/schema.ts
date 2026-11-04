import { bigint, boolean, check, index, integer, jsonb, pgTable, primaryKey, text, time, timestamp, uuid, bigserial, unique, date } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const branches = pgTable('branches', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  dailyTarget: bigint('daily_target', { mode: 'bigint' }),
  dayCutoff: time('day_cutoff').notNull().default('00:00'),
  nextSaleNo: integer('next_sale_no').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const productCategories = pgTable('product_categories', {
  id: uuid('id').defaultRandom().primaryKey(), name: text('name').notNull().unique(),
  active: boolean('active').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  categoryId: uuid('category_id').notNull().references(() => productCategories.id),
  name: text('name').notNull(), price: bigint('price', { mode: 'bigint' }).notNull(),
  unitCost: bigint('unit_cost', { mode: 'bigint' }).notNull(), active: boolean('active').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [unique('products_category_name_unique').on(t.categoryId, t.name)]);
export const expenseCategories = pgTable('expense_categories', {
  id: uuid('id').defaultRandom().primaryKey(), name: text('name').notNull().unique(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(), passwordHash: text('password_hash').notNull(), name: text('name').notNull(),
  role: text('role', { enum: ['owner', 'manager', 'cashier'] }).notNull(), active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const userBranches = pgTable('user_branches', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'cascade' }),
}, t => [primaryKey({ columns: [t.userId, t.branchId] })]);
export const sessions = pgTable('sessions', {
  tokenHash: text('token_hash').primaryKey(), userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, t => [index('sessions_user_id_idx').on(t.userId)]);
export const activityLog = pgTable('activity_log', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  branchId: uuid('branch_id').references(() => branches.id),
  actorId: uuid('actor_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('activity_log_branch_created_idx').on(t.branchId, t.createdAt.desc())]);
export const sales = pgTable('sales', {
  id: uuid('id').primaryKey(), branchId: uuid('branch_id').notNull().references(() => branches.id),
  saleNo: integer('sale_no').notNull(), businessDate: date('business_date').notNull(),
  paymentMethod: text('payment_method', { enum: ['cash', 'gcash', 'maya', 'card'] }).notNull(),
  total: bigint('total', { mode: 'bigint' }).notNull(), cashierId: uuid('cashier_id').notNull().references(() => users.id),
  voidedAt: timestamp('voided_at', { withTimezone: true }), voidedBy: uuid('voided_by').references(() => users.id), voidReason: text('void_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [unique('sales_branch_sale_no_unique').on(t.branchId, t.saleNo), index('sales_branch_business_date_idx').on(t.branchId, t.businessDate),
  check('sales_sale_no_positive', sql`${t.saleNo} > 0`), check('sales_total_nonnegative', sql`${t.total} >= 0`),
  check('sales_payment_method_valid', sql`${t.paymentMethod} in ('cash', 'gcash', 'maya', 'card')`),
  check('sales_void_fields_consistent', sql`(${t.voidedAt} is null and ${t.voidedBy} is null and ${t.voidReason} is null) or (${t.voidedAt} is not null and ${t.voidedBy} is not null and ${t.voidReason} is not null)`)]);
export const saleLines = pgTable('sale_lines', {
  id: uuid('id').defaultRandom().primaryKey(), saleId: uuid('sale_id').notNull().references(() => sales.id),
  productId: uuid('product_id').notNull().references(() => products.id), productName: text('product_name').notNull(),
  unitPrice: bigint('unit_price', { mode: 'bigint' }).notNull(), unitCost: bigint('unit_cost', { mode: 'bigint' }).notNull(), qty: integer('qty').notNull(),
}, t => [check('sale_lines_qty_positive', sql`${t.qty} > 0`), check('sale_lines_unit_price_nonnegative', sql`${t.unitPrice} >= 0`), check('sale_lines_unit_cost_nonnegative', sql`${t.unitCost} >= 0`)]);
