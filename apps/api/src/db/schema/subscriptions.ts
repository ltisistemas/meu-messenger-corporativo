import { pgTable, uuid, varchar, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { accounts } from './accounts';

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  accountId: uuid('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  gateway: varchar('gateway', { length: 50 }).notNull().default('asaas'),
  gatewaySubscriptionId: varchar('gateway_subscription_id', { length: 255 }).unique(),
  gatewayCustomerId: varchar('gateway_customer_id', { length: 255 }),
  plan: varchar('plan', { length: 50 }).notNull(), // 'pro' | 'enterprise'
  billingCycle: varchar('billing_cycle', { length: 50 }).notNull().default('monthly'), // 'monthly' | 'yearly'
  paymentMethod: varchar('payment_method', { length: 50 }).notNull(), // 'pix' | 'credit_card' | 'boleto'
  status: varchar('status', { length: 50 }).notNull().default('pending'), // 'active' | 'pending' | 'overdue' | 'canceled' | 'trialing'
  amountCents: integer('amount_cents').notNull(),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull().defaultNow(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  canceledAt: timestamp('canceled_at', { withTimezone: true }),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  account: one(accounts, {
    fields: [subscriptions.accountId],
    references: [accounts.id],
  }),
}));

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
