import { pgTable, uuid, varchar, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { accounts } from './accounts';
import { conversationMembers } from './conversation-members';
import { messages } from './messages';
import { messageReceipts } from './message-receipts';

export const users = pgTable(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    role: varchar('role', { length: 50 }).notNull().default('member'), // 'owner' | 'admin' | 'member'
    status: varchar('status', { length: 50 }).notNull().default('active'), // 'active' | 'inactive'
    avatarUrl: text('avatar_url'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('users_account_email_idx').on(table.accountId, table.email),
  ]
);

export const usersRelations = relations(users, ({ one, many }) => ({
  account: one(accounts, {
    fields: [users.accountId],
    references: [accounts.id],
  }),
  memberships: many(conversationMembers),
  messages: many(messages),
  receipts: many(messageReceipts),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
