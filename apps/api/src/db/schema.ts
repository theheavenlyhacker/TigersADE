import { integer, pgTable, text } from 'drizzle-orm/pg-core';

export const branches = pgTable('branches', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  today: integer('today').notNull(),
  week: integer('week').notNull(),
  mtd: integer('mtd').notNull(),
  target: integer('target').notNull(),
});
