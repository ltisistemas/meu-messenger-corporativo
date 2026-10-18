import { pgTable, uuid, varchar, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';
import { conversations } from './conversations';

export const accounts = pgTable('accounts', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  plan: varchar('plan', { length: 50 }).notNull().default('free'), // 'free' | 'pro' | 'enterprise'
  status: varchar('status', { length: 50 }).notNull().default('active'), // 'active' | 'over_quota' | 'suspended'
  trialUntil: timestamp('trial_until', { withTimezone: true }),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const accountsRelations = relations(accounts, ({ many }) => ({
  users: many(users),
  conversations: many(conversations),
}));

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
