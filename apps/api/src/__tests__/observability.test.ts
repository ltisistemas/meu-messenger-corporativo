import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildServer } from '../server';
import { HealthService } from '../services/health.service';
import { MetricsService } from '../services/metrics.service';
import { BackupService } from '../services/backup.service';

// Mock DB
const mockDb = {
  execute: vi.fn().mockResolvedValue([{ 1: 1 }]),
  query: {
    accounts: { findMany: vi.fn().mockResolvedValue([{ id: 'acc-1', name: 'Corp A' }]) },
    users: { findMany: vi.fn().mockResolvedValue([{ id: 'usr-1', name: 'Alice' }]) },
    conversations: { findMany: vi.fn().mockResolvedValue([]) },
    conversationMembers: { findMany: vi.fn().mockResolvedValue([]) },
    messages: { findMany: vi.fn().mockResolvedValue([]) },
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

describe('Observability, Metrics, Health & Backups (T-37)', () => {
  let healthService: HealthService;
  let metricsService: MetricsService;
  let backupService: BackupService;
  let server: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    metricsService = new MetricsService();
    healthService = new HealthService(mockDb as any, metricsService);
    backupService = new BackupService(mockDb as any);

    server = buildServer({
      healthService,
      metricsService,
      backupService,
    });
    await server.ready();
  });

  describe('1. Health Checks & Kubernetes Probes (/health, /live, /ready)', () => {
    it('returns healthy status (200) when database is responsive', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.status).toBe('healthy');
      expect(data.checks.database.status).toBe('up');
      expect(data.checks.database.latencyMs).toBeDefined();
      expect(data.checks.memory.heapUsedMb).toBeGreaterThan(0);
      expect(data.checks.websocket.activeConnections).toBe(0);
    });

    it('returns unhealthy status (503) when database connection fails', async () => {
      const failingDb = {
        execute: vi.fn().mockRejectedValue(new Error('Connection timeout to Postgres')),
      };
      const failingHealthService = new HealthService(failingDb as any, metricsService);
      const failingServer = buildServer({ healthService: failingHealthService, metricsService });
      await failingServer.ready();

      const response = await failingServer.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(503);
      const data = response.json();
      expect(data.status).toBe('unhealthy');
      expect(data.checks.database.status).toBe('down');
      expect(data.checks.database.error).toContain('Connection timeout');

      await failingServer.close();
    });

    it('returns 200 on /live probe for shallow container liveness', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/live',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('alive');
    });

    it('returns 200 on /ready probe when database is available', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('ready');
      expect(response.json().database).toBe('up');
    });
  });

  describe('2. Metrics & Telemetry (/api/metrics and Prometheus /metrics)', () => {
    it('records HTTP request status codes and latency in JSON metrics', async () => {
      // Send sample requests to trigger metrics
      await server.inject({ method: 'GET', url: '/live' });
      await server.inject({ method: 'GET', url: '/live' });

      const response = await server.inject({
        method: 'GET',
        url: '/api/metrics',
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.http.requestsTotal).toBeGreaterThanOrEqual(2);
      expect(data.http.statusCodes['200']).toBeGreaterThanOrEqual(2);
      expect(data.http.averageLatencyMs).toBeDefined();
      expect(data.system.heapUsedMb).toBeGreaterThan(0);
    });

    it('tracks realtime counters (WebSocket, messages, files, signatures)', () => {
      metricsService.incrementWsConnections();
      metricsService.incrementWsConnections();
      metricsService.decrementWsConnections();
      metricsService.incrementMessages();
      metricsService.incrementFiles();
      metricsService.incrementSignatures();

      const metrics = metricsService.getMetrics();
      expect(metrics.realtime.activeWsConnections).toBe(1);
      expect(metrics.realtime.messagesSentTotal).toBe(1);
      expect(metrics.realtime.filesTransferredTotal).toBe(1);
      expect(metrics.realtime.signaturesCreatedTotal).toBe(1);
    });

    it('returns metrics in Prometheus scraping text format on /metrics', async () => {
      metricsService.incrementMessages();

      const response = await server.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      const body = response.body;
      expect(body).toContain('# HELP http_requests_total');
      expect(body).toContain('realtime_messages_total 1');
      expect(body).toContain('process_heap_used_bytes');
    });
  });

  describe('3. Database Logical Backup & Disaster Recovery (T-37)', () => {
    it('blocks unauthenticated or non-admin users from creating backups', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/backup',
      });
      expect(response.statusCode).toBe(401);

      const memberToken = server.jwt.sign({
        userId: 'usr-member',
        accountId: 'acc-1',
        role: 'member',
      });

      const memberResponse = await server.inject({
        method: 'POST',
        url: '/api/backup',
        headers: { authorization: `Bearer ${memberToken}` },
      });
      expect(memberResponse.statusCode).toBe(403);
    });

    it('creates logical backup with SHA-256 integrity checksum', async () => {
      const ownerToken = server.jwt.sign({
        userId: 'usr-owner',
        accountId: 'acc-1',
        role: 'owner',
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/backup',
        headers: { authorization: `Bearer ${ownerToken}` },
      });

      expect(response.statusCode).toBe(200);
      const backup = response.json();
      expect(backup.backupId).toBeDefined();
      expect(backup.schemaVersion).toBe('1.0.0');
      expect(backup.checksumSha256).toBeDefined();
      expect(backup.tablesCount).toBe(13);
      expect(backup.totalRowsCount).toBe(2); // acc-1 and usr-1 from mock
      expect(backup.tables.accounts).toHaveLength(1);
    });

    it('verifies SHA-256 integrity and executes safe database restore', async () => {
      const backup = await backupService.createBackup();

      // Integrity check of original backup
      expect(backupService.verifyBackup(backup)).toBe(true);

      const ownerToken = server.jwt.sign({
        userId: 'usr-owner',
        accountId: 'acc-1',
        role: 'owner',
      });

      const restoreResponse = await server.inject({
        method: 'POST',
        url: '/api/backup/restore',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: backup,
      });

      expect(restoreResponse.statusCode).toBe(200);
      const data = restoreResponse.json();
      expect(data.success).toBe(true);
      expect(data.checksumVerified).toBe(true);
      expect(data.restoredRowsCount).toBe(2);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('rejects tampered backups where data was modified without updating hash', async () => {
      const backup = await backupService.createBackup();

      // Tamper backup data
      const tamperedBackup = {
        ...backup,
        tables: {
          ...backup.tables,
          accounts: [{ id: 'injected-id', name: 'Malicious Corp' }],
        },
      };

      expect(backupService.verifyBackup(tamperedBackup)).toBe(false);

      const ownerToken = server.jwt.sign({
        userId: 'usr-owner',
        accountId: 'acc-1',
        role: 'owner',
      });

      const restoreResponse = await server.inject({
        method: 'POST',
        url: '/api/backup/restore',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: tamperedBackup,
      });

      expect(restoreResponse.statusCode).toBe(400);
      expect(restoreResponse.json().message).toContain('Falha de integridade do backup');
    });
  });
});
