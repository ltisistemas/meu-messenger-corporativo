import crypto from 'crypto';
import { db as defaultDb } from '../db/index';
import {
  accounts,
  users,
  conversations,
  conversationMembers,
  messages,
  messageReceipts,
  fileTransfers,
  polls,
  subscriptions,
  invoices,
  signatureRequests,
  signatureSigners,
  signatureEvidence,
} from '../db/schema/index';
import { BackupRestoreResponse } from '@/shared';

export interface BackupPayload {
  backupId: string;
  createdAt: string;
  schemaVersion: string;
  checksumSha256: string;
  tablesCount: number;
  totalRowsCount: number;
  tables: {
    accounts: any[];
    users: any[];
    conversations: any[];
    conversationMembers: any[];
    messages: any[];
    messageReceipts: any[];
    fileTransfers: any[];
    polls: any[];
    subscriptions: any[];
    invoices: any[];
    signatureRequests: any[];
    signatureSigners: any[];
    signatureEvidence: any[];
  };
}

export class BackupService {
  constructor(private db = defaultDb) {}

  /**
   * Generates a complete logical backup of the database with SHA-256 checksum verification.
   */
  async createBackup(): Promise<BackupPayload> {
    const backupId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const schemaVersion = '1.0.0';

    // Fetch data from tables
    const accountsData = (await this.db.query.accounts?.findMany()) || [];
    const usersData = (await this.db.query.users?.findMany()) || [];
    const conversationsData = (await this.db.query.conversations?.findMany()) || [];
    const conversationMembersData = (await this.db.query.conversationMembers?.findMany()) || [];
    const messagesData = (await this.db.query.messages?.findMany()) || [];
    const messageReceiptsData = (await this.db.query.messageReceipts?.findMany()) || [];
    const fileTransfersData = (await this.db.query.fileTransfers?.findMany()) || [];
    const pollsData = (await this.db.query.polls?.findMany()) || [];
    const subscriptionsData = (await this.db.query.subscriptions?.findMany()) || [];
    const invoicesData = (await this.db.query.invoices?.findMany()) || [];
    const signatureRequestsData = (await this.db.query.signatureRequests?.findMany()) || [];
    const signatureSignersData = (await this.db.query.signatureSigners?.findMany()) || [];
    const signatureEvidenceData = (await this.db.query.signatureEvidence?.findMany()) || [];

    const tables = {
      accounts: accountsData,
      users: usersData,
      conversations: conversationsData,
      conversationMembers: conversationMembersData,
      messages: messagesData,
      messageReceipts: messageReceiptsData,
      fileTransfers: fileTransfersData,
      polls: pollsData,
      subscriptions: subscriptionsData,
      invoices: invoicesData,
      signatureRequests: signatureRequestsData,
      signatureSigners: signatureSignersData,
      signatureEvidence: signatureEvidenceData,
    };

    const tablesCount = Object.keys(tables).length;
    const totalRowsCount = Object.values(tables).reduce((acc, rows) => acc + rows.length, 0);

    // Calculate checksum of the tables data
    const checksumSha256 = this.computeTablesChecksum(tables);

    return {
      backupId,
      createdAt,
      schemaVersion,
      checksumSha256,
      tablesCount,
      totalRowsCount,
      tables,
    };
  }

  /**
   * Verifies the SHA-256 integrity checksum of a backup payload.
   */
  verifyBackup(payload: BackupPayload): boolean {
    if (!payload || !payload.checksumSha256 || !payload.tables) {
      return false;
    }
    const computed = this.computeTablesChecksum(payload.tables);
    return computed === payload.checksumSha256;
  }

  /**
   * Restores data from a validated logical backup.
   */
  async restoreFromBackup(payload: BackupPayload): Promise<BackupRestoreResponse> {
    const isChecksumValid = this.verifyBackup(payload);
    if (!isChecksumValid) {
      throw new Error(
        'Falha de integridade do backup: o hash SHA-256 não confere com o conteúdo dos dados.'
      );
    }

    let restoredRowsCount = 0;
    let restoredTablesCount = 0;

    // Restore tables in dependency order
    const tableEntries: Array<[string, any, any[]]> = [
      ['accounts', accounts, payload.tables.accounts],
      ['users', users, payload.tables.users],
      ['conversations', conversations, payload.tables.conversations],
      ['conversationMembers', conversationMembers, payload.tables.conversationMembers],
      ['messages', messages, payload.tables.messages],
      ['messageReceipts', messageReceipts, payload.tables.messageReceipts],
      ['fileTransfers', fileTransfers, payload.tables.fileTransfers],
      ['polls', polls, payload.tables.polls],
      ['subscriptions', subscriptions, payload.tables.subscriptions],
      ['invoices', invoices, payload.tables.invoices],
      ['signatureRequests', signatureRequests, payload.tables.signatureRequests],
      ['signatureSigners', signatureSigners, payload.tables.signatureSigners],
      ['signatureEvidence', signatureEvidence, payload.tables.signatureEvidence],
    ];

    for (const [_name, tableSchema, rows] of tableEntries) {
      if (rows && rows.length > 0) {
        restoredTablesCount++;
        for (const row of rows) {
          if (this.db.insert) {
            await this.db.insert(tableSchema).values(row).onConflictDoNothing();
          }
          restoredRowsCount++;
        }
      }
    }

    return {
      success: true,
      backupId: payload.backupId,
      restoredAt: new Date().toISOString(),
      restoredTablesCount,
      restoredRowsCount,
      checksumVerified: true,
    };
  }

  /**
   * Computes SHA-256 checksum over tables object.
   */
  private computeTablesChecksum(tables: any): string {
    const serialized = JSON.stringify(tables);
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }
}

