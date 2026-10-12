import { pgTable, uuid, varchar, text, boolean, integer, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { conversations } from './conversations';
import { messages } from './messages';
import { users } from './users';

export const polls = pgTable(
  'polls',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id')
      .references(() => messages.id, { onDelete: 'cascade' }),
    creatorId: uuid('creator_id')
      .references(() => users.id, { onDelete: 'set null' }),
    question: text('question').notNull(),
    allowMultiple: boolean('allow_multiple').notNull().default(false),
    isAnonymous: boolean('is_anonymous').notNull().default(false),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    status: varchar('status', { length: 50 }).notNull().default('active'), // 'active' | 'closed'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('polls_conversation_idx').on(table.conversationId),
  ]
);

export const pollOptions = pgTable(
  'poll_options',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    pollId: uuid('poll_id')
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    orderIndex: integer('order_index').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('poll_options_poll_idx').on(table.pollId),
  ]
);

export const pollVotes = pgTable(
  'poll_votes',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    pollId: uuid('poll_id')
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    optionId: uuid('option_id')
      .notNull()
      .references(() => pollOptions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('poll_votes_unique_idx').on(table.pollId, table.optionId, table.userId),
    index('poll_votes_poll_user_idx').on(table.pollId, table.userId),
  ]
);

export const pollsRelations = relations(polls, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [polls.conversationId],
    references: [conversations.id],
  }),
  message: one(messages, {
    fields: [polls.messageId],
    references: [messages.id],
  }),
  creator: one(users, {
    fields: [polls.creatorId],
    references: [users.id],
  }),
  options: many(pollOptions),
  votes: many(pollVotes),
}));

export const pollOptionsRelations = relations(pollOptions, ({ one, many }) => ({
  poll: one(polls, {
    fields: [pollOptions.pollId],
    references: [polls.id],
  }),
  votes: many(pollVotes),
}));

export const pollVotesRelations = relations(pollVotes, ({ one }) => ({
  poll: one(polls, {
    fields: [pollVotes.pollId],
    references: [polls.id],
  }),
  option: one(pollOptions, {
    fields: [pollVotes.optionId],
    references: [pollOptions.id],
  }),
  user: one(users, {
    fields: [pollVotes.userId],
    references: [users.id],
  }),
}));

export type Poll = typeof polls.$inferSelect;
export type NewPoll = typeof polls.$inferInsert;
export type PollOption = typeof pollOptions.$inferSelect;
export type NewPollOption = typeof pollOptions.$inferInsert;
export type PollVote = typeof pollVotes.$inferSelect;
export type NewPollVote = typeof pollVotes.$inferInsert;
