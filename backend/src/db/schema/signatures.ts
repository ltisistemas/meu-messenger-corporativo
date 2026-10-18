import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { accounts } from './accounts';
import { conversations } from './conversations';
import { messages } from './messages';
import { users } from './users';

export const signatureRequests = pgTable(
  'signature_requests',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id').references(() => messages.id, { onDelete: 'set null' }),
    creatorId: uuid('creator_id').references(() => users.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 255 }).notNull(),
    documentName: varchar('document_name', { length: 255 }).notNull(),
    provider: varchar('provider', { length: 50 }).notNull().default('clicksign'),
    externalDocumentKey: varchar('external_document_key', { length: 255 }).notNull(),
    originalSha256: varchar('original_sha256', { length: 64 }).notNull(),
    signedSha256: varchar('signed_sha256', { length: 64 }),
    status: varchar('status', { length: 50 }).notNull().default('draft'), // 'draft' | 'running' | 'closed' | 'canceled'
    deadlineAt: timestamp('deadline_at', { withTimezone: true }),
    autoClose: boolean('auto_close').notNull().default(true),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('sig_req_account_idx').on(table.accountId),
    index('sig_req_conv_idx').on(table.conversationId),
    index('sig_req_ext_key_idx').on(table.externalDocumentKey),
  ]
);

export const signatureSigners = pgTable(
  'signature_signers',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    signatureRequestId: uuid('signature_request_id')
      .notNull()
      .references(() => signatureRequests.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    externalSignerKey: varchar('external_signer_key', { length: 255 }).notNull(),
    requestSignatureKey: varchar('request_signature_key', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    documentation: varchar('documentation', { length: 50 }),
    phoneNumber: varchar('phone_number', { length: 50 }),
    authType: varchar('auth_type', { length: 50 }).notNull().default('email'),
    signAs: varchar('sign_as', { length: 50 }).notNull().default('sign'),
    groupOrder: integer('group_order').notNull().default(1),
    signUrl: text('sign_url').notNull(),
    status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending' | 'signed' | 'rejected'
    signedAt: timestamp('signed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sig_signers_request_idx').on(table.signatureRequestId),
    index('sig_signers_req_key_idx').on(table.requestSignatureKey),
  ]
);

export const signatureEvidence = pgTable(
  'signature_evidence',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    signatureRequestId: uuid('signature_request_id')
      .notNull()
      .references(() => signatureRequests.id, { onDelete: 'cascade' }),
    signerId: uuid('signer_id').references(() => signatureSigners.id, { onDelete: 'set null' }),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    ipAddress: varchar('ip_address', { length: 100 }),
    userAgent: text('user_agent'),
    token: varchar('token', { length: 255 }),
    details: jsonb('details'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('sig_evidence_req_idx').on(table.signatureRequestId)]
);

export const signatureRequestsRelations = relations(signatureRequests, ({ one, many }) => ({
  account: one(accounts, {
    fields: [signatureRequests.accountId],
    references: [accounts.id],
  }),
  conversation: one(conversations, {
    fields: [signatureRequests.conversationId],
    references: [conversations.id],
  }),
  message: one(messages, {
    fields: [signatureRequests.messageId],
    references: [messages.id],
  }),
  creator: one(users, {
    fields: [signatureRequests.creatorId],
    references: [users.id],
  }),
  signers: many(signatureSigners),
  evidence: many(signatureEvidence),
}));

export const signatureSignersRelations = relations(signatureSigners, ({ one }) => ({
  signatureRequest: one(signatureRequests, {
    fields: [signatureSigners.signatureRequestId],
    references: [signatureRequests.id],
  }),
  user: one(users, {
    fields: [signatureSigners.userId],
    references: [users.id],
  }),
}));

export const signatureEvidenceRelations = relations(signatureEvidence, ({ one }) => ({
  signatureRequest: one(signatureRequests, {
    fields: [signatureEvidence.signatureRequestId],
    references: [signatureRequests.id],
  }),
  signer: one(signatureSigners, {
    fields: [signatureEvidence.signerId],
    references: [signatureSigners.id],
  }),
}));
