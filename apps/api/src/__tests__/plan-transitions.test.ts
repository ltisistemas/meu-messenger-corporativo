import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../server';
import { AccountService } from '../services/account.service';
import { BillingService } from '../services/billing.service';
import { MessageService } from '../services/message.service';
import { InvitationService } from '../services/invitation.service';
import { PlanType } from '@corpchat/shared';

describe('Plan Transitions, Downgrades, Over Quota & Inadimplência (T-29)', () => {
  const accountId = '11111111-1111-1111-1111-111111111111';
  const ownerUserId = '22222222-2222-2222-2222-222222222222';
  const adminUserId = '33333333-3333-3333-3333-333333333333';
  const memberUserId = '44444444-4444-4444-4444-444444444444';

  let mockAccountData: any;
  let mockUsersData: any[];
  let mockSubscriptionsData: any[];
  let mockInvoicesData: any[];

  const createMockDb = () => {
    return {
      query: {
        accounts: {
          findFirst: vi.fn(async ({ where }: any) => {
            return mockAccountData ? { ...mockAccountData } : undefined;
          }),
          findMany: vi.fn(async () => {
            return mockAccountData ? [{ ...mockAccountData }] : [];
          }),
        },
        users: {
          findFirst: vi.fn(async (query: any) => {
            const targetId = query?.where?.value ?? query?.where?.right?.value ?? query?.where?.right;
            if (targetId && typeof targetId === 'string') {
              const found = mockUsersData.find((x) => x.id === targetId || x.email === targetId);
              if (found) return { ...found };
            }
            return mockUsersData[0] ? { ...mockUsersData[0] } : undefined;
          }),
          findMany: vi.fn(async (query: any) => {
            let result = mockUsersData;
            if (query?.where) {
              const findStatus = (obj: any): string | null => {
                if (!obj || typeof obj !== 'object') return null;
                if (obj.value === 'active' || obj.value === 'inactive') return obj.value;
                if (Array.isArray(obj.values)) {
                  if (obj.values.includes('active')) return 'active';
                  if (obj.values.includes('inactive')) return 'inactive';
                }
                if (Array.isArray(obj.queryChunks)) {
                  for (const chunk of obj.queryChunks) {
                    const st = findStatus(chunk);
                    if (st) return st;
                  }
                }
                return null;
              };

              const st = findStatus(query.where);
              if (st) {
                result = result.filter((u) => u.status === st);
              }
            }
            return result.map((u) => ({ ...u }));
          }),
        },
        subscriptions: {
          findFirst: vi.fn(async () => {
            return mockSubscriptionsData[0] ? { ...mockSubscriptionsData[0] } : undefined;
          }),
          findMany: vi.fn(async () => {
            return mockSubscriptionsData.map((s) => ({ ...s }));
          }),
        },
        invoices: {
          findFirst: vi.fn(async () => {
            return mockInvoicesData[0] ? { ...mockInvoicesData[0] } : undefined;
          }),
          findMany: vi.fn(async () => {
            return mockInvoicesData.map((i) => ({ ...i }));
          }),
        },
      },
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => {
            const activeCount = mockUsersData.filter((u) => u.status === 'active').length;
            return [{ count: activeCount }];
          }),
        })),
      })),
      update: vi.fn((table: any) => ({
        set: vi.fn((values: any) => ({
          where: vi.fn((whereClause: any) => {
            const execute = async () => {
              if (values.plan !== undefined) mockAccountData.plan = values.plan;
              if (values.status !== undefined) {
                if (values.status === 'active' || values.status === 'over_quota' || values.status === 'suspended') {
                  mockAccountData.status = values.status;
                }
              }
              const targetId = whereClause?.value ?? whereClause?.right?.value ?? whereClause?.right;
              if (targetId && typeof targetId === 'string') {
                const u = mockUsersData.find((x) => x.id === targetId);
                if (u) {
                  Object.assign(u, values);
                  return [{ ...u }];
                }
              }
              return [{ ...mockAccountData, ...values }];
            };

            const promise = execute();
            return Object.assign(promise, {
              returning: vi.fn(async () => execute()),
            });
          }),
        })),
      })),
      insert: vi.fn((table: any) => ({
        values: vi.fn((vals: any) => ({
          returning: vi.fn(async () => [vals]),
        })),
      })),
    } as any;
  };

  beforeEach(() => {
    mockAccountData = {
      id: accountId,
      name: 'Acme Corp',
      plan: 'pro',
      status: 'active',
      trialUntil: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    // 15 active users (1 owner + 1 admin + 13 members)
    mockUsersData = [
      {
        id: ownerUserId,
        accountId,
        name: 'Carlos Owner',
        email: 'owner@acme.com',
        role: 'owner',
        status: 'active',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: adminUserId,
        accountId,
        name: 'Ana Admin',
        email: 'admin@acme.com',
        role: 'admin',
        status: 'active',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      ...Array.from({ length: 13 }, (_, i) => ({
        id: `44444444-4444-4444-4444-4444444440${i < 10 ? '0' + i : i}`,
        accountId,
        name: `Member ${i + 1}`,
        email: `member${i + 1}@acme.com`,
        role: 'member',
        status: 'active',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      })),
    ];

    mockSubscriptionsData = [];
    mockInvoicesData = [];
  });

  describe('AccountService Unit Tests', () => {
    it('returns complete account details, trial days remaining and active/inactive counts', async () => {
      const mockDb = createMockDb();
      const accountService = new AccountService(mockDb);

      const details = await accountService.getAccountDetails(accountId);

      expect(details.id).toBe(accountId);
      expect(details.plan).toBe('pro');
      expect(details.status).toBe('active');
      expect(details.isTrialing).toBe(true);
      expect(details.trialDaysRemaining).toBeGreaterThanOrEqual(9);
      expect(details.activeUsersCount).toBe(15);
      expect(details.maxUsers).toBe(80);
      expect(details.isOverQuota).toBe(false);
      expect(details.excessUsersCount).toBe(0);
    });

    it('downgrading from Pro (15 active members) to Free puts account in over_quota status', async () => {
      const mockDb = createMockDb();
      const accountService = new AccountService(mockDb);

      const result = await accountService.changePlan(accountId, 'owner', 'free');

      expect(result.plan).toBe('free');
      expect(result.status).toBe('over_quota');
      expect(result.isOverQuota).toBe(true);
      expect(result.maxUsers).toBe(12);
      expect(result.activeUsersCount).toBe(15);
      expect(result.excessUsersCount).toBe(3);
      expect(mockAccountData.plan).toBe('free');
      expect(mockAccountData.status).toBe('over_quota');
    });

    it('blocks non-admin/non-owner from changing the plan (403 / Forbidden)', async () => {
      const mockDb = createMockDb();
      const accountService = new AccountService(mockDb);

      await expect(
        accountService.changePlan(accountId, 'member', 'free')
      ).rejects.toThrow(/Apenas Administradores e o Proprietário/i);
    });

    it('deactivating excess members restores account status from over_quota back to active', async () => {
      mockAccountData.plan = 'free';
      mockAccountData.status = 'over_quota';

      const mockDb = createMockDb();
      // Customize findFirst to return the target member
      const targetUserId = mockUsersData[2].id;
      mockDb.query.users.findFirst = vi.fn(async () => mockUsersData[2]);

      const accountService = new AccountService(mockDb);

      // Deactivate 3 members
      mockUsersData[2].status = 'inactive';
      mockUsersData[3].status = 'inactive';
      mockUsersData[4].status = 'inactive';

      const updated = await accountService.updateMemberStatus(
        accountId,
        adminUserId,
        'admin',
        targetUserId,
        'inactive'
      );

      expect(updated.status).toBe('inactive');
      // With 12 active users on Free (max 12), status reconciles to 'active'
      expect(mockAccountData.status).toBe('active');
    });

    it('blocks deactivating the account owner', async () => {
      const mockDb = createMockDb();
      mockDb.query.users.findFirst = vi.fn(async () => mockUsersData[0]); // Owner user

      const accountService = new AccountService(mockDb);

      await expect(
        accountService.updateMemberStatus(accountId, adminUserId, 'admin', ownerUserId, 'inactive')
      ).rejects.toThrow(/O Proprietário da organização não pode ser desativado/i);
    });

    it('blocks activating a member when account is already at max plan user limit', async () => {
      mockAccountData.plan = 'free';
      // 12 active users
      mockUsersData = mockUsersData.slice(0, 12);
      const inactiveUser = {
        id: '55555555-5555-5555-5555-555555555555',
        accountId,
        name: 'Inactive User',
        email: 'inactive@acme.com',
        role: 'member',
        status: 'inactive',
        createdAt: new Date(),
      };

      const mockDb = createMockDb();
      mockDb.query.users.findFirst = vi.fn(async () => inactiveUser);

      const accountService = new AccountService(mockDb);

      await expect(
        accountService.updateMemberStatus(accountId, adminUserId, 'admin', inactiveUser.id, 'active')
      ).rejects.toThrow(/Limite de 12 usuários atingido/i);
    });

    it('upgrading account from Free (with 15 members) to Pro sets status back to active', async () => {
      mockAccountData.plan = 'free';
      mockAccountData.status = 'over_quota';

      const mockDb = createMockDb();
      const accountService = new AccountService(mockDb);

      const upgraded = await accountService.changePlan(accountId, 'owner', 'pro');

      expect(upgraded.plan).toBe('pro');
      expect(upgraded.status).toBe('active');
      expect(upgraded.isOverQuota).toBe(false);
      expect(mockAccountData.status).toBe('active');
    });

    it('auto-reconciles expired Pro trial to Free plan on getAccountDetails', async () => {
      // Trial expired yesterday
      mockAccountData.plan = 'pro';
      mockAccountData.trialUntil = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const mockDb = createMockDb();
      const accountService = new AccountService(mockDb);

      const details = await accountService.getAccountDetails(accountId);

      expect(details.plan).toBe('free');
      expect(details.status).toBe('over_quota'); // 15 users > 12
      expect(details.isTrialing).toBe(false);
      expect(mockAccountData.plan).toBe('free');
    });

    it('processes expired trials via batch job processTrialExpirations', async () => {
      mockAccountData.plan = 'pro';
      mockAccountData.trialUntil = new Date(Date.now() - 48 * 60 * 60 * 1000);

      const mockDb = createMockDb();
      const accountService = new AccountService(mockDb);

      const result = await accountService.processTrialExpirations();

      expect(result.processedCount).toBe(1);
      expect(result.downgradedAccountIds).toContain(accountId);
      expect(mockAccountData.plan).toBe('free');
      expect(mockAccountData.status).toBe('over_quota');
    });

    it('suspends delinquent accounts past grace period via processOverdueInvoices', async () => {
      mockInvoicesData = [
        {
          id: 'inv_111',
          accountId,
          status: 'overdue',
          dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days overdue (> 3 days grace)
        },
      ];

      const mockDb = createMockDb();
      const accountService = new AccountService(mockDb);

      const result = await accountService.processOverdueInvoices(3);

      expect(result.suspendedCount).toBe(1);
      expect(result.suspendedAccountIds).toContain(accountId);
      expect(mockAccountData.status).toBe('suspended');
    });

    it('restores suspended account to active when Asaas webhook confirms payment', async () => {
      mockAccountData.status = 'suspended';
      mockAccountData.plan = 'pro';
      mockSubscriptionsData = [
        {
          id: 'sub_111',
          accountId,
          gatewaySubscriptionId: 'sub_asaas_123',
          plan: 'pro',
          billingCycle: 'monthly',
          status: 'overdue',
        },
      ];
      mockInvoicesData = [
        {
          id: 'inv_111',
          accountId,
          subscriptionId: 'sub_111',
          gatewayInvoiceId: 'pay_asaas_123',
          status: 'overdue',
        },
      ];

      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);

      const webhookResult = await billingService.handleWebhook('PAYMENT_CONFIRMED', {
        id: 'pay_asaas_123',
        subscription: 'sub_asaas_123',
        paymentDate: new Date().toISOString(),
      });

      expect(webhookResult.handled).toBe(true);
      expect(mockAccountData.status).toBe('active');
    });
  });

  describe('Invitation & Message Services Over Quota Enforcement', () => {
    it('blocks creating invitations when account is over_quota', async () => {
      mockAccountData.plan = 'free';
      mockAccountData.status = 'over_quota';

      const mockDb = createMockDb();
      const invitationService = new InvitationService(mockDb);

      await expect(
        invitationService.createInvitation(accountId, ownerUserId, 'owner', {
          email: 'newuser@acme.com',
          role: 'member',
        })
      ).rejects.toThrow(/Sua conta atingiu o limite de usuários do plano/i);
    });

    it('blocks sending messages when account is over_quota', async () => {
      mockAccountData.plan = 'free';
      mockAccountData.status = 'over_quota';

      const mockDb = createMockDb();
      const messageService = new MessageService(mockDb);

      await expect(
        messageService.sendMessage(accountId, ownerUserId, {
          conversationId: '99999999-9999-9999-9999-999999999999',
          content: 'Hello team',
        })
      ).rejects.toThrow(/somente leitura/i);
    });
  });

  describe('Fastify Accounts Routes Integration (/api/accounts)', () => {
    let app: FastifyInstance;
    let token: string;
    let mockDb: any;
    let accountService: AccountService;

    beforeEach(async () => {
      mockDb = createMockDb();
      accountService = new AccountService(mockDb);

      app = buildServer({ accountService });
      await app.ready();

      token = app.jwt.sign({
        userId: ownerUserId,
        accountId,
        role: 'owner',
        email: 'owner@acme.com',
      });
    });

    it('GET /api/accounts/me returns 200 with plan info and limits', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/accounts/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(accountId);
      expect(body.plan).toBe('pro');
      expect(body.activeUsersCount).toBe(15);
      expect(body.maxUsers).toBe(80);
      expect(body.isOverQuota).toBe(false);
    });

    it('GET /api/accounts/members returns 200 with all organization members', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/accounts/members',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.members)).toBe(true);
      expect(body.members.length).toBe(15);
    });

    it('POST /api/accounts/downgrade to free transitions account to over_quota and returns 200', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/accounts/downgrade',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          plan: 'free',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.plan).toBe('free');
      expect(body.status).toBe('over_quota');
      expect(body.isOverQuota).toBe(true);
      expect(body.excessUsersCount).toBe(3);
    });

    it('PATCH /api/accounts/members/:id/status updates member status', async () => {
      const targetUserId = mockUsersData[2].id;
      mockDb.query.users.findFirst = vi.fn(async () => mockUsersData[2]);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/accounts/members/${targetUserId}/status`,
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          status: 'inactive',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.member.status).toBe('inactive');
    });

    it('POST /api/accounts/check-quota returns 200 and quota evaluation', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/accounts/check-quota',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.accountStatus).toBeDefined();
      expect(body.activeUsersCount).toBe(15);
    });

    it('POST /api/accounts/cron/process-trials returns 200 with processed count', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/accounts/cron/process-trials',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.processedCount).toBeDefined();
    });

    it('POST /api/accounts/cron/process-overdue returns 200 with suspended count', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/accounts/cron/process-overdue',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.suspendedCount).toBeDefined();
    });

    it('updateMemberRole and processTrialExpirations handle missing user and suspended accounts', async () => {
      // 1. updateMemberRole user not found
      const mockDbMissing: any = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(null) },
        },
      };
      const customAccountService = new AccountService(mockDbMissing);
      await expect(
        customAccountService.updateMemberRole('acc-test-id', 'caller-1', 'owner', 'missing-user-id', 'admin')
      ).rejects.toThrow('Membro não encontrado nesta organização.');

      // 2. processTrialExpirations for suspended and over_quota accounts
      const mockDb: any = {
        query: {
          accounts: {
            findMany: vi.fn().mockResolvedValue([
              { id: 'acc-susp', plan: 'pro', status: 'suspended', trialUntil: new Date(Date.now() - 1000) },
              { id: 'acc-over', plan: 'pro', status: 'active', trialUntil: new Date(Date.now() - 1000) },
            ]),
          },
          subscriptions: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
          users: {
            findMany: vi.fn().mockResolvedValue(Array(15).fill({ status: 'active' })),
          },
        },
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(undefined),
          })),
        })),
      };

      const svc = new AccountService(mockDb);
      const result = await svc.processTrialExpirations();
      expect(result.processedCount).toBe(2);
    });
  });
});
