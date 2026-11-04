import { bigint, boolean, integer, pgTable, primaryKey, text, time, timestamp, uuid } from 'drizzle-orm/pg-core';

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
});
