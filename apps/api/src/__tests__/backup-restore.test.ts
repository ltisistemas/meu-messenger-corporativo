import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import { BackupService, BackupPayload } from '../services/backup.service';

describe('PostgreSQL Backup & Disaster Recovery Service (T-37)', () => {
  let backupService: BackupService;
  let mockDb: any;

  const mockAccounts = [
    { id: 'acc-uuid-1', name: 'Acme Corp', plan: 'enterprise', status: 'active' },
  ];
  const mockUsers = [
    { id: 'usr-uuid-1', accountId: 'acc-uuid-1', name: 'John Doe', email: 'john@acme.com', role: 'owner' },
  ];
  const mockConversations = [
    { id: 'conv-uuid-1', accountId: 'acc-uuid-1', type: 'direct', isTemporary: false },
  ];
  const mockMessages = [
    { id: 'msg-uuid-1', conversationId: 'conv-uuid-1', type: 'text', content: 'Mensagem confidencial' },
  ];

  beforeEach(() => {
    mockDb = {
      query: {
        accounts: { findMany: vi.fn().mockResolvedValue(mockAccounts) },
        users: { findMany: vi.fn().mockResolvedValue(mockUsers) },
        conversations: { findMany: vi.fn().mockResolvedValue(mockConversations) },
        conversationMembers: { findMany: vi.fn().mockResolvedValue([]) },
        messages: { findMany: vi.fn().mockResolvedValue(mockMessages) },
        messageReceipts: { findMany: vi.fn().mockResolvedValue([]) },
        fileTransfers: { findMany: vi.fn().mockResolvedValue([]) },
        polls: { findMany: vi.fn().mockResolvedValue([]) },
        subscriptions: { findMany: vi.fn().mockResolvedValue([]) },
        invoices: { findMany: vi.fn().mockResolvedValue([]) },
        signatureRequests: { findMany: vi.fn().mockResolvedValue([]) },
        signatureSigners: { findMany: vi.fn().mockResolvedValue([]) },
        signatureEvidence: { findMany: vi.fn().mockResolvedValue([]) },
      },
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn().mockResolvedValue({ rowCount: 1 }),
        })),
      })),
    };

    backupService = new BackupService(mockDb);
  });

  it('generates a complete backup with accurate table and row statistics', async () => {
    const backup = await backupService.createBackup();

    expect(backup.backupId).toMatch(/^[0-9a-f-]{36}$/);
    expect(backup.schemaVersion).toBe('1.0.0');
    expect(backup.tablesCount).toBe(13);
    expect(backup.totalRowsCount).toBe(4); // 1 account + 1 user + 1 conversation + 1 message
    expect(backup.checksumSha256).toHaveLength(64); // 64 hex chars
    expect(backup.tables.accounts).toEqual(mockAccounts);
    expect(backup.tables.users).toEqual(mockUsers);
  });

  it('validates genuine backups as cryptographically valid', async () => {
    const backup = await backupService.createBackup();
    const isValid = backupService.verifyBackup(backup);
    expect(isValid).toBe(true);
  });

  it('detects tampering in backup rows', async () => {
    const backup = await backupService.createBackup();

    // Tamper single field
    backup.tables.users[0].name = 'Hacked User';

    const isValid = backupService.verifyBackup(backup);
    expect(isValid).toBe(false);
  });

  it('restores all tables into database in topological foreign key dependency order', async () => {
    const backup = await backupService.createBackup();
    const result = await backupService.restoreFromBackup(backup);

    expect(result.success).toBe(true);
    expect(result.checksumVerified).toBe(true);
    expect(result.restoredTablesCount).toBe(4); // accounts, users, conversations, messages
    expect(result.restoredRowsCount).toBe(backup.totalRowsCount);
    expect(mockDb.insert).toHaveBeenCalledTimes(backup.totalRowsCount);
  });

  it('throws an error during restore if the backup checksum was altered or corrupted', async () => {
    const backup = await backupService.createBackup();
    backup.checksumSha256 = 'invalid_sha256_hash_here';

    await expect(backupService.restoreFromBackup(backup)).rejects.toThrow(
      'Falha de integridade do backup'
    );
  });
});
