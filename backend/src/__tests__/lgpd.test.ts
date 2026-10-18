import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { buildServer } from '../server';
import { LgpdService } from '../services/lgpd.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_ID = '22222222-2222-4222-8222-222222222222';
const CONV_ID = '33333333-3333-4333-8333-333333333333';
const MSG_ID = '44444444-4444-4444-8444-444444444444';

// Mock DB
const mockUser = {
  id: USER_ID,
  accountId: ACCOUNT_ID,
  name: 'Maria Titular',
  email: 'maria@empresa.com',
  passwordHash: bcrypt.hashSync('senhaCorreta123', 8),
  role: 'member',
  status: 'active',
  avatarUrl: 'https://avatar.com/maria.png',
  createdAt: new Date('2026-01-01T10:00:00Z'),
  updatedAt: new Date('2026-01-01T10:00:00Z'),
  lastSeenAt: new Date('2026-02-01T15:00:00Z'),
};

const mockAccount = {
  id: ACCOUNT_ID,
  name: 'Empresa Teste',
  plan: 'pro',
  status: 'active',
  createdAt: new Date('2026-01-01T09:00:00Z'),
};

const mockDb = {
  query: {
    users: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    accounts: {
      findFirst: vi.fn(),
    },
    messages: {
      findMany: vi.fn(),
    },
    conversationMembers: {
      findMany: vi.fn(),
    },
    messageReceipts: {
      findMany: vi.fn(),
    },
  },
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn().mockResolvedValue({ rowCount: 1 }),
    })),
  })),
  delete: vi.fn(() => ({
    where: vi.fn().mockResolvedValue({ rowCount: 1 }),
  })),
};

describe('LGPD Privacy, Data Export & Deletion (T-36)', () => {
  let lgpdService: LgpdService;
  let server: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    lgpdService = new LgpdService(mockDb as any);
    server = buildServer({ lgpdService });
    await server.ready();
  });

  describe('1. Privacy Policy & DPO Contact (GET /api/lgpd/privacy-policy)', () => {
    it('returns privacy policy, legal bases, retention rules, and DPO contacts without authentication', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/lgpd/privacy-policy',
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.version).toBe('2026.1');
      expect(data.dpoContact).toBe('dpo@nextmsg.com.br');
      expect(data.rights.length).toBeGreaterThanOrEqual(9);
      expect(data.retentionPolicies.free).toContain('Zero retenção');
      expect(data.retentionPolicies.pro).toContain('5 dias');
      expect(data.legalBases.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('2. Data Export (GET /api/lgpd/export)', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/lgpd/export',
      });

      expect(response.statusCode).toBe(401);
    });

    it('exports all personal, message, and membership data in structured JSON for titular', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(mockUser);
      mockDb.query.accounts.findFirst.mockResolvedValue(mockAccount);
      mockDb.query.messages.findMany.mockResolvedValue([
        {
          id: MSG_ID,
          conversationId: CONV_ID,
          content: 'Olá a todos',
          type: 'text',
          metadata: {},
          createdAt: new Date('2026-02-01T12:00:00Z'),
        },
      ]);
      mockDb.query.conversationMembers.findMany.mockResolvedValue([
        {
          conversationId: CONV_ID,
          role: 'member',
          joinedAt: new Date('2026-01-02T10:00:00Z'),
        },
      ]);
      mockDb.query.messageReceipts.findMany.mockResolvedValue([
        {
          messageId: MSG_ID,
          deliveredAt: new Date('2026-02-01T10:30:00Z'),
          readAt: new Date('2026-02-01T11:00:00Z'),
        },
      ]);

      const token = server.jwt.sign({
        userId: USER_ID,
        accountId: ACCOUNT_ID,
        role: 'member',
      });

      const response = await server.inject({
        method: 'GET',
        url: '/api/lgpd/export',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.user.email).toBe('maria@empresa.com');
      expect(data.account.name).toBe('Empresa Teste');
      expect(data.sentMessages).toHaveLength(1);
      expect(data.sentMessages[0].content).toBe('Olá a todos');
      expect(data.conversationMemberships).toHaveLength(1);
      expect(data.receipts).toHaveLength(1);
      expect(data.privacyPolicyAccepted.version).toBe('2026.1');
    });
  });

  describe('3. Right to Erasure / Anonymization (POST /api/lgpd/delete-account)', () => {
    it('validates required fields (password & confirmation text)', async () => {
      const token = server.jwt.sign({
        userId: USER_ID,
        accountId: ACCOUNT_ID,
        role: 'member',
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/lgpd/delete-account',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          password: '',
          confirmationText: 'INVALIDO',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('rejects deletion with incorrect password', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(mockUser);

      const token = server.jwt.sign({
        userId: USER_ID,
        accountId: ACCOUNT_ID,
        role: 'member',
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/lgpd/delete-account',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          password: 'senhaErrada123',
          confirmationText: 'EXCLUIR',
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().message).toContain('Senha incorreta');
    });

    it('blocks deletion if user is the sole owner of the organization', async () => {
      const ownerUser = {
        ...mockUser,
        id: USER_ID,
        role: 'owner',
      };
      mockDb.query.users.findFirst.mockResolvedValue(ownerUser);
      mockDb.query.users.findMany.mockResolvedValue([ownerUser]); // only 1 owner

      const token = server.jwt.sign({
        userId: USER_ID,
        accountId: ACCOUNT_ID,
        role: 'owner',
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/lgpd/delete-account',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          password: 'senhaCorreta123',
          confirmationText: 'EXCLUIR',
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().message).toContain('único Proprietário');
    });

    it('successfully anonymizes personal data, terminates sessions and returns confirmation', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(mockUser);

      const token = server.jwt.sign({
        userId: USER_ID,
        accountId: ACCOUNT_ID,
        role: 'member',
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/lgpd/delete-account',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          password: 'senhaCorreta123',
          confirmationText: 'EXCLUIR',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.anonymizedAt).toBeDefined();

      // Ensure update was called to anonymize
      expect(mockDb.update).toHaveBeenCalled();
      // Ensure refresh tokens were deleted
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});
