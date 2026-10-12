import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import {
  accounts,
  users,
  conversations,
  conversationMembers,
  messages,
  messageReceipts,
} from '../db/schema/index';

describe('Database Schema & Table Definitions (T-02)', () => {
  it('should define accounts table with all required fields', () => {
    const cols = getTableColumns(accounts);
    expect(cols.id).toBeDefined();
    expect(cols.name).toBeDefined();
    expect(cols.plan).toBeDefined();
    expect(cols.status).toBeDefined();
    expect(cols.trialUntil).toBeDefined();
    expect(cols.createdAt).toBeDefined();
    expect(cols.updatedAt).toBeDefined();
  });

  it('should define users table with account foreign key and roles', () => {
    const cols = getTableColumns(users);
    expect(cols.id).toBeDefined();
    expect(cols.accountId).toBeDefined();
    expect(cols.email).toBeDefined();
    expect(cols.passwordHash).toBeDefined();
    expect(cols.role).toBeDefined();
    expect(cols.status).toBeDefined();
    expect(cols.lastSeenAt).toBeDefined();
  });

  it('should define conversations table with temporary group support', () => {
    const cols = getTableColumns(conversations);
    expect(cols.id).toBeDefined();
    expect(cols.accountId).toBeDefined();
    expect(cols.type).toBeDefined();
    expect(cols.title).toBeDefined();
    expect(cols.isTemporary).toBeDefined();
    expect(cols.expiresAt).toBeDefined();
    expect(cols.status).toBeDefined();
  });

  it('should define conversation_members table', () => {
    const cols = getTableColumns(conversationMembers);
    expect(cols.id).toBeDefined();
    expect(cols.conversationId).toBeDefined();
    expect(cols.userId).toBeDefined();
    expect(cols.role).toBeDefined();
    expect(cols.joinedAt).toBeDefined();
  });

  it('should define messages table with metadata and sender', () => {
    const cols = getTableColumns(messages);
    expect(cols.id).toBeDefined();
    expect(cols.conversationId).toBeDefined();
    expect(cols.senderId).toBeDefined();
    expect(cols.type).toBeDefined();
    expect(cols.content).toBeDefined();
    expect(cols.metadata).toBeDefined();
  });

  it('should define message_receipts table for delivery and read receipts', () => {
    const cols = getTableColumns(messageReceipts);
    expect(cols.id).toBeDefined();
    expect(cols.messageId).toBeDefined();
    expect(cols.userId).toBeDefined();
    expect(cols.deliveredAt).toBeDefined();
    expect(cols.readAt).toBeDefined();
  });
});
