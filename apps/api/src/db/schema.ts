import { bigint, boolean, index, integer, jsonb, pgTable, primaryKey, text, time, timestamp, uuid, bigserial, unique } from 'drizzle-orm/pg-core';

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
