import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { accounts } from './accounts';
import { conversations } from './conversations';
import { messages } from './messages';
import { users } from './users';

export const fileTransfers = pgTable(
  'file_transfers',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id')
      .references(() => messages.id, { onDelete: 'set null' }),
    uploaderId: uuid('uploader_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    fileSize: integer('file_size').notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull().default('application/octet-stream'),
    storageKey: text('storage_key').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    totalRecipientsCount: integer('total_recipients_count').notNull().default(1),
    pendingDownloadsCount: integer('pending_downloads_count').notNull().default(1),
    status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending' | 'uploaded' | 'completed' | 'expired' | 'deleted'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('file_transfers_account_idx').on(table.accountId),
    index('file_transfers_conversation_idx').on(table.conversationId),
    index('file_transfers_message_idx').on(table.messageId),
    index('file_transfers_expires_at_idx').on(table.expiresAt),
    index('file_transfers_status_idx').on(table.status),
  ]
);

export const fileTransferDownloads = pgTable(
  'file_transfer_downloads',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    transferId: uuid('transfer_id')
      .notNull()
      .references(() => fileTransfers.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    downloadedAt: timestamp('downloaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('file_transfer_user_download_unique_idx').on(table.transferId, table.userId),
    index('file_transfer_downloads_transfer_idx').on(table.transferId),
    index('file_transfer_downloads_user_idx').on(table.userId),
  ]
);

export const fileTransfersRelations = relations(fileTransfers, ({ one, many }) => ({
  account: one(accounts, {
    fields: [fileTransfers.accountId],
    references: [accounts.id],
  }),
  conversation: one(conversations, {
    fields: [fileTransfers.conversationId],
    references: [conversations.id],
  }),
  message: one(messages, {
    fields: [fileTransfers.messageId],
    references: [messages.id],
  }),
  uploader: one(users, {
    fields: [fileTransfers.uploaderId],
    references: [users.id],
  }),
  downloads: many(fileTransferDownloads),
}));

export const fileTransferDownloadsRelations = relations(fileTransferDownloads, ({ one }) => ({
  transfer: one(fileTransfers, {
    fields: [fileTransferDownloads.transferId],
    references: [fileTransfers.id],
  }),
  user: one(users, {
    fields: [fileTransferDownloads.userId],
    references: [users.id],
  }),
}));

export type FileTransfer = typeof fileTransfers.$inferSelect;
export type NewFileTransfer = typeof fileTransfers.$inferInsert;
export type FileTransferDownload = typeof fileTransferDownloads.$inferSelect;
export type NewFileTransferDownload = typeof fileTransferDownloads.$inferInsert;
