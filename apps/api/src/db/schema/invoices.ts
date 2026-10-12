import { pgTable, uuid, varchar, timestamp, integer } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { accounts } from './accounts';
import { subscriptions } from './subscriptions';

export const invoices = pgTable('invoices', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  accountId: uuid('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  subscriptionId: uuid('subscription_id')
    .references(() => subscriptions.id, { onDelete: 'set null' }),
  gatewayInvoiceId: varchar('gateway_invoice_id', { length: 255 }).unique(),
  amountCents: integer('amount_cents').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending' | 'paid' | 'overdue' | 'refunded' | 'canceled'
  paymentMethod: varchar('payment_method', { length: 50 }).notNull(), // 'pix' | 'credit_card' | 'boleto'
  pdfUrl: varchar('pdf_url', { length: 1000 }),
  bankSlipUrl: varchar('bank_slip_url', { length: 1000 }),
  pixQrCode: varchar('pix_qr_code', { length: 2000 }),
  pixCopyPaste: varchar('pix_copy_paste', { length: 2000 }),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const invoicesRelations = relations(invoices, ({ one }) => ({
  account: one(accounts, {
    fields: [invoices.accountId],
    references: [accounts.id],
  }),
  subscription: one(subscriptions, {
    fields: [invoices.subscriptionId],
    references: [subscriptions.id],
  }),
}));

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
