import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { accounts } from './accounts';
import { conversationMembers } from './conversation-members';
import { messages } from './messages';

export const conversations = pgTable('conversations', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  accountId: uuid('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(), // 'direct' | 'group' | 'broadcast'
  title: text('title'),
  isTemporary: boolean('is_temporary').notNull().default(false),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  status: varchar('status', { length: 50 }).notNull().default('active'), // 'active' | 'archived_readonly'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  account: one(accounts, {
    fields: [conversations.accountId],
    references: [accounts.id],
  }),
  members: many(conversationMembers),
  messages: many(messages),
}));

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
