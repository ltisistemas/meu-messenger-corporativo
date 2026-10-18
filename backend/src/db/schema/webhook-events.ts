import { pgTable, varchar, timestamp, integer, text, jsonb, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { accounts } from './accounts';

export const webhookEvents = pgTable('webhook_eventos', {
  id: varchar('id', { length: 255 }).primaryKey(), // Asaas event ID (evt_...)
  evento: varchar('evento', { length: 100 }).notNull(),
  gateway: varchar('gateway', { length: 50 }).notNull().default('asaas'),
  status: varchar('status', { length: 50 }).notNull().default('sucesso'), // 'sucesso' | 'aviso' | 'erro' | 'duplicado'
  acao: varchar('acao', { length: 100 }), // 'PLAN_ACTIVATED' | 'DOWNGRADE_TO_FREE' | 'ADMIN_DOWNGRADE_SKIPPED' | 'DUPLICATE_SKIPPED' | 'UNMATCHED_ACCOUNT'
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  duracaoMs: integer('duracao_ms'),
  erroMensagem: text('erro_mensagem'),
  payload: jsonb('payload'),
  processadoEm: timestamp('processado_em', { withTimezone: true }).notNull().defaultNow(),
});

export const webhookEventsRelations = relations(webhookEvents, ({ one }) => ({
  account: one(accounts, {
    fields: [webhookEvents.accountId],
    references: [accounts.id],
  }),
}));

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
