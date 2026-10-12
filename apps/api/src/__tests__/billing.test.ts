import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingService } from '../services/billing.service';
import { AsaasGatewayService } from '../services/asaas.service';
import { buildServer } from '../server';

// Helper to safely extract string values from Drizzle AST objects without circular errors
function getStringsFrom(obj: any, visited = new Set<any>()): string[] {
  if (!obj || visited.has(obj)) return [];
  visited.add(obj);
  const results: string[] = [];
  if (typeof obj === 'string') {
    results.push(obj);
    return results;
  }
  if (typeof obj === 'object') {
    for (const key of Object.getOwnPropertyNames(obj)) {
      try {
        results.push(...getStringsFrom(obj[key], visited));
      } catch (_) {}
    }
    for (const sym of Object.getOwnPropertySymbols(obj)) {
      try {
        results.push(...getStringsFrom((obj as any)[sym], visited));
      } catch (_) {}
    }
  }
  return results;
}

describe('Payment Gateway & Subscriptions (T-28)', () => {
  const accountId = '11111111-1111-1111-1111-111111111111';
  const adminUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const memberUserId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  let mockAccountData: any;
  let mockUsersData: any[];
  let mockSubscriptionsData: any[];
  let mockInvoicesData: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    mockAccountData = {
      id: accountId,
      name: 'Acme Corporativa',
      plan: 'free',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockUsersData = [
      { id: adminUserId, accountId, name: 'Lucas Admin', email: 'lucas@acme.com', role: 'admin', status: 'active' },
      { id: memberUserId, accountId, name: 'Marcos Dev', email: 'marcos@acme.com', role: 'member', status: 'active' },
    ];

    mockSubscriptionsData = [];
    mockInvoicesData = [];
  });

  const createMockDb = () => {
    return {
      query: {
        accounts: {
          findFirst: vi.fn(async ({ where }: any) => {
            const strings = getStringsFrom(where);
            if (strings.includes(accountId) || !where) return mockAccountData;
            return null;
          }),
        },
        users: {
          findMany: vi.fn(async ({ where }: any) => {
            const strings = getStringsFrom(where);
            return mockUsersData.filter((u) => strings.includes(u.accountId) || strings.includes(u.id));
          }),
        },
        subscriptions: {
          findFirst: vi.fn(async ({ where }: any) => {
            const strings = getStringsFrom(where);
            return (
              mockSubscriptionsData.find(
                (s) =>
                  strings.includes(s.id) ||
                  strings.includes(s.accountId) ||
                  strings.includes(s.gatewaySubscriptionId)
              ) || null
            );
          }),
        },
        invoices: {
          findFirst: vi.fn(async ({ where }: any) => {
            const strings = getStringsFrom(where);
            return (
              mockInvoicesData.find(
                (i) =>
                  strings.includes(i.id) ||
                  strings.includes(i.gatewayInvoiceId) ||
                  strings.includes(i.accountId)
              ) || null
            );
          }),
          findMany: vi.fn(async ({ where }: any) => {
            const strings = getStringsFrom(where);
            return mockInvoicesData.filter((i) => strings.includes(i.accountId));
          }),
        },
      },
      insert: vi.fn((table: any) => ({
        values: vi.fn((val: any) => {
          let record: any;
          if (val.plan && val.gateway) {
            record = {
              id: crypto.randomUUID(),
              ...val,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockSubscriptionsData.push(record);
          } else if (val.amountCents && val.paymentMethod) {
            record = {
              id: crypto.randomUUID(),
              ...val,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockInvoicesData.push(record);
          } else {
            record = { id: crypto.randomUUID(), ...val };
          }
          return {
            returning: () => [record],
            then: (resolve: any) => Promise.resolve([record]).then(resolve),
          };
        }),
      })),
      update: vi.fn((table: any) => ({
        set: vi.fn((setVals: any) => ({
          where: vi.fn((whereClause: any) => {
            const strings = getStringsFrom(whereClause);

            // Update account if matching
            if (strings.includes(accountId)) {
              Object.assign(mockAccountData, setVals);
            }

            // Update subscription
            const sub = mockSubscriptionsData.find((s) => strings.includes(s.id) || strings.includes(s.accountId));
            if (sub) {
              Object.assign(sub, setVals);
            }

            // Update invoice
            const inv = mockInvoicesData.find((i) => strings.includes(i.id) || strings.includes(i.gatewayInvoiceId));
            if (inv) {
              Object.assign(inv, setVals);
            }

            const returned = sub ? [sub] : inv ? [inv] : [mockAccountData];
            return {
              returning: () => returned,
              then: (resolve: any) => Promise.resolve(returned).then(resolve),
            };
          }),
        })),
      })),
    } as any;
  };

  describe('BillingService Unit Tests', () => {
    it('blocks non-admin members from creating a subscription (403 / Forbidden)', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);

      await expect(
        billingService.createSubscription(accountId, memberUserId, 'member', {
          plan: 'pro',
          billingCycle: 'monthly',
          paymentMethod: 'pix',
          customer: {
            name: 'Marcos Dev',
            email: 'marcos@acme.com',
            cpfCnpj: '12345678901',
          },
        })
      ).rejects.toThrow(/Apenas administradores/i);
    });

    it('creates a Pro subscription with PIX, returning pending status and QR Code', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);

      const result = await billingService.createSubscription(accountId, adminUserId, 'admin', {
        plan: 'pro',
        billingCycle: 'monthly',
        paymentMethod: 'pix',
        customer: {
          name: 'Lucas Admin',
          email: 'lucas@acme.com',
          cpfCnpj: '12345678901',
        },
      });

      expect(result.subscription.plan).toBe('pro');
      expect(result.subscription.paymentMethod).toBe('pix');
      expect(result.subscription.status).toBe('pending');
      expect(result.invoice.status).toBe('pending');
      expect(result.checkout?.pixCopyPaste).toBeDefined();
      expect(result.checkout?.pixQrCode).toBeDefined();
      expect(mockAccountData.plan).toBe('free'); // remains free until payment is confirmed
    });

    it('creates an Enterprise subscription with Credit Card and activates immediately', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);

      const result = await billingService.createSubscription(accountId, adminUserId, 'owner', {
        plan: 'enterprise',
        billingCycle: 'monthly',
        paymentMethod: 'credit_card',
        customer: {
          name: 'Lucas Admin',
          email: 'lucas@acme.com',
          cpfCnpj: '12345678901',
        },
        creditCard: {
          holderName: 'LUCAS ADMIN',
          number: '4111111111111111',
          expiryMonth: '12',
          expiryYear: '2028',
          ccv: '123',
        },
      });

      expect(result.subscription.plan).toBe('enterprise');
      expect(result.subscription.status).toBe('active');
      expect(result.invoice.status).toBe('paid');
      expect(mockAccountData.plan).toBe('enterprise');
      expect(mockAccountData.status).toBe('active');
    });

    it('processes Asaas Webhook PAYMENT_CONFIRMED: marks invoice paid and upgrades account to Pro', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);

      // 1. Create pending subscription
      const initial = await billingService.createSubscription(accountId, adminUserId, 'admin', {
        plan: 'pro',
        billingCycle: 'monthly',
        paymentMethod: 'pix',
        customer: {
          name: 'Lucas Admin',
          email: 'lucas@acme.com',
          cpfCnpj: '12345678901',
        },
      });

      expect(mockAccountData.plan).toBe('free');

      // 2. Simulate Asaas webhook webhook event PAYMENT_CONFIRMED
      const webhookRes = await billingService.handleWebhook('PAYMENT_CONFIRMED', {
        id: initial.invoice.gatewayInvoiceId,
        subscription: initial.subscription.gatewaySubscriptionId,
        paymentDate: new Date().toISOString(),
        value: 79.9,
      });

      expect(webhookRes.handled).toBe(true);
      expect(webhookRes.action).toBe('payment_confirmed_and_plan_activated');
      expect(mockAccountData.plan).toBe('pro');
      expect(mockAccountData.status).toBe('active');
    });

    it('processes Asaas Webhook PAYMENT_OVERDUE: marks invoice and subscription as overdue', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);

      const initial = await billingService.createSubscription(accountId, adminUserId, 'admin', {
        plan: 'pro',
        billingCycle: 'monthly',
        paymentMethod: 'boleto',
        customer: {
          name: 'Lucas Admin',
          email: 'lucas@acme.com',
          cpfCnpj: '12345678901',
        },
      });

      const webhookRes = await billingService.handleWebhook('PAYMENT_OVERDUE', {
        id: initial.invoice.gatewayInvoiceId,
        subscription: initial.subscription.gatewaySubscriptionId,
      });

      expect(webhookRes.handled).toBe(true);
      expect(webhookRes.action).toBe('payment_marked_overdue');
    });

    it('allows admin to schedule subscription cancellation at end of billing cycle', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);

      // Create and activate subscription
      await billingService.createSubscription(accountId, adminUserId, 'admin', {
        plan: 'pro',
        billingCycle: 'monthly',
        paymentMethod: 'credit_card',
        customer: {
          name: 'Lucas Admin',
          email: 'lucas@acme.com',
          cpfCnpj: '12345678901',
        },
      });

      expect(mockAccountData.plan).toBe('pro');

      // Cancel subscription
      const canceled = await billingService.cancelSubscription(accountId, adminUserId, 'admin', {
        reason: 'Redução de custos',
      });

      expect(canceled.cancelAtPeriodEnd).toBe(true);
      expect(canceled.canceledAt).toBeDefined();
    });

    it('processes SUBSCRIPTION_CANCELED webhook after period expiration, downgrading to Free plan', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);

      const initial = await billingService.createSubscription(accountId, adminUserId, 'admin', {
        plan: 'pro',
        billingCycle: 'monthly',
        paymentMethod: 'credit_card',
        customer: {
          name: 'Lucas Admin',
          email: 'lucas@acme.com',
          cpfCnpj: '12345678901',
        },
      });

      expect(mockAccountData.plan).toBe('pro');

      // Set subscription periodEnd to past
      mockSubscriptionsData[0].currentPeriodEnd = new Date(Date.now() - 1000);

      await billingService.handleWebhook('SUBSCRIPTION_CANCELED', {
        id: 'pay_123',
        subscription: initial.subscription.gatewaySubscriptionId,
      });

      expect(mockAccountData.plan).toBe('free');
    });

    it('returns complete billing summary with account metrics and invoice history', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);

      await billingService.createSubscription(accountId, adminUserId, 'admin', {
        plan: 'pro',
        billingCycle: 'monthly',
        paymentMethod: 'credit_card',
        customer: {
          name: 'Lucas Admin',
          email: 'lucas@acme.com',
          cpfCnpj: '12345678901',
        },
      });

      const summary = await billingService.getAccountBillingSummary(accountId);

      expect(summary.account.name).toBe('Acme Corporativa');
      expect(summary.account.activeUsersCount).toBe(2);
      expect(summary.subscription?.plan).toBe('pro');
      expect(summary.invoices.length).toBe(1);
    });
  });

  describe('Fastify Billing Routes Integration (/api/billing)', () => {
    it('POST /api/billing/subscribe creates subscription and returns 201', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);

      const app = buildServer({ billingService });
      await app.ready();

      const adminToken = app.jwt.sign({
        userId: adminUserId,
        accountId,
        role: 'admin',
        email: 'lucas@acme.com',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/subscribe',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          plan: 'pro',
          billingCycle: 'monthly',
          paymentMethod: 'pix',
          customer: {
            name: 'Lucas Admin',
            email: 'lucas@acme.com',
            cpfCnpj: '12345678901',
          },
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.payload);
      expect(json.subscription.plan).toBe('pro');
      expect(json.invoice.paymentMethod).toBe('pix');
      expect(json.checkout.pixCopyPaste).toBeDefined();

      await app.close();
    });

    it('POST /api/billing/subscribe returns 403 for regular members', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);

      const app = buildServer({ billingService });
      await app.ready();

      const memberToken = app.jwt.sign({
        userId: memberUserId,
        accountId,
        role: 'member',
        email: 'marcos@acme.com',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/subscribe',
        headers: { authorization: `Bearer ${memberToken}` },
        payload: {
          plan: 'pro',
          billingCycle: 'monthly',
          paymentMethod: 'pix',
          customer: {
            name: 'Marcos Dev',
            email: 'marcos@acme.com',
            cpfCnpj: '12345678901',
          },
        },
      });

      expect(res.statusCode).toBe(403);
      await app.close();
    });

    it('GET /api/billing/summary returns 200 with billing data', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);

      const app = buildServer({ billingService });
      await app.ready();

      const token = app.jwt.sign({
        userId: adminUserId,
        accountId,
        role: 'admin',
        email: 'lucas@acme.com',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/billing/summary',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.account.name).toBe('Acme Corporativa');

      await app.close();
    });

    it('POST /api/billing/webhook/asaas handles webhook events and returns 200', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);

      const app = buildServer({ billingService });
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/webhook/asaas',
        payload: {
          event: 'PAYMENT_CONFIRMED',
          payment: {
            id: 'pay_99999',
            value: 79.9,
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.received).toBe(true);
      expect(json.event).toBe('PAYMENT_CONFIRMED');

      await app.close();
    });
  });
});
