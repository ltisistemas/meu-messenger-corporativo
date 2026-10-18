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

describe('Asaas Billing Integration & Reverse Engineering Specs (T-28 / DOCUMENTACAO_TECNICA)', () => {
  const accountId = '11111111-1111-1111-1111-111111111111';
  const adminUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  let mockAccountData: any;
  let mockUsersData: any[];
  let mockSubscriptionsData: any[];
  let mockInvoicesData: any[];
  let mockWebhookEventsData: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    mockAccountData = {
      id: accountId,
      name: 'Acme Corporativa',
      plan: 'free',
      status: 'active',
      isProtected: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockUsersData = [
      {
        id: adminUserId,
        accountId,
        name: 'Lucas Admin',
        email: 'lucas@acme.com',
        role: 'admin',
        status: 'active',
      },
    ];

    mockSubscriptionsData = [];
    mockInvoicesData = [];
    mockWebhookEventsData = [];
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
            return mockUsersData.filter(
              (u) => strings.includes(u.accountId) || strings.includes(u.id)
            );
          }),
          findFirst: vi.fn(async ({ where }: any) => {
            const strings = getStringsFrom(where);
            return (
              mockUsersData.find((u) => strings.includes(u.accountId) || strings.includes(u.id)) ||
              null
            );
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
                  strings.includes(s.gatewaySubscriptionId) ||
                  strings.includes(s.gatewayCustomerId)
              ) || null
            );
          }),
          findMany: vi.fn(async () => mockSubscriptionsData),
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
        webhookEvents: {
          findFirst: vi.fn(async ({ where }: any) => {
            const strings = getStringsFrom(where);
            return mockWebhookEventsData.find((e) => strings.includes(e.id)) || null;
          }),
          findMany: vi.fn(async () => mockWebhookEventsData),
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
          } else if (val.evento) {
            record = {
              ...val,
              processadoEm: new Date(),
            };
            mockWebhookEventsData.push(record);
          } else {
            record = { id: crypto.randomUUID(), ...val };
          }
          return {
            returning: () => [record],
            onConflictDoNothing: () => Promise.resolve([record]),
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
            const sub = mockSubscriptionsData.find(
              (s) => strings.includes(s.id) || strings.includes(s.accountId)
            );
            if (sub) {
              Object.assign(sub, setVals);
            }

            // Update invoice
            const inv = mockInvoicesData.find(
              (i) => strings.includes(i.id) || strings.includes(i.gatewayInvoiceId)
            );
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

  describe('1. Idempotência e Deduplicação (webhook_eventos)', () => {
    it('skips duplicate webhook events when eventId was already processed', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);

      const eventId = 'evt_test_123456789';
      mockWebhookEventsData.push({
        id: eventId,
        evento: 'PAYMENT_RECEIVED',
        status: 'sucesso',
        accountId,
      });

      const res = await billingService.handleWebhook(
        'PAYMENT_RECEIVED',
        { id: 'pay_123', externalReference: accountId },
        undefined,
        eventId
      );

      expect(res.handled).toBe(true);
      expect(res.duplicate).toBe(true);
      expect(res.action).toBe('DUPLICATE_SKIPPED');
    });
  });

  describe('2. Algoritmo Multi-Chave de Resolução', () => {
    it('resolves account via externalReference when present in webhook payload', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);

      // Create subscription
      const sub = await billingService.createSubscription(accountId, adminUserId, 'admin', {
        plan: 'pro',
        billingCycle: 'monthly',
        paymentMethod: 'pix',
        customer: { name: 'Lucas', email: 'l@a.com', cpfCnpj: '12345678901' },
      });

      const res = await billingService.handleWebhook(
        'PAYMENT_RECEIVED',
        {
          id: 'pay_external_test',
          externalReference: accountId,
          paymentDate: new Date().toISOString(),
        },
        undefined,
        'evt_ext_1'
      );

      expect(res.handled).toBe(true);
      expect(res.action).toBe('payment_confirmed_and_plan_activated');
      expect(mockAccountData.plan).toBe('pro');
    });

    it('returns UNMATCHED_ACCOUNT without throwing if no entity matches payload', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);

      const res = await billingService.handleWebhook(
        'PAYMENT_RECEIVED',
        {
          id: 'pay_unknown_123',
          externalReference: '99999999-9999-9999-9999-999999999999',
          customer: 'cus_unknown',
        },
        undefined,
        'evt_unmatched_1'
      );

      expect(res.handled).toBe(true);
      expect(res.action).toBe('UNMATCHED_ACCOUNT');
    });
  });

  describe('3. Proteção de Contas Administrativas contra Downgrade', () => {
    it('skips downgrade when account has isProtected = true', async () => {
      const mockDb = createMockDb();
      mockAccountData.isProtected = true;
      mockAccountData.plan = 'pro';

      const billingService = new BillingService(mockDb);

      const sub = await billingService.createSubscription(accountId, adminUserId, 'admin', {
        plan: 'pro',
        billingCycle: 'monthly',
        paymentMethod: 'credit_card',
        customer: { name: 'Lucas', email: 'l@a.com', cpfCnpj: '12345678901' },
      });

      // Period has expired
      mockSubscriptionsData[0].currentPeriodEnd = new Date(Date.now() - 1000);

      const res = await billingService.handleWebhook(
        'SUBSCRIPTION_CANCELED',
        {
          id: 'pay_del_1',
          subscription: sub.subscription.gatewaySubscriptionId,
        },
        undefined,
        'evt_admin_protect_1'
      );

      expect(res.handled).toBe(true);
      expect(res.action).toBe('ADMIN_DOWNGRADE_SKIPPED');
      expect(mockAccountData.plan).toBe('pro'); // Kept as Pro!
    });
  });

  describe('4. Política de Tolerância (Grace Period de 3 Dias)', () => {
    it('keeps subscription in overdue status without immediate downgrade if within 3 days', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);

      const sub = await billingService.createSubscription(accountId, adminUserId, 'admin', {
        plan: 'pro',
        billingCycle: 'monthly',
        paymentMethod: 'pix',
        customer: { name: 'Lucas', email: 'l@a.com', cpfCnpj: '12345678901' },
      });

      // Due date was 1 day ago (within 3-day grace period)
      mockInvoicesData[0].dueDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

      const res = await billingService.handleWebhook(
        'PAYMENT_OVERDUE',
        {
          id: sub.invoice.gatewayInvoiceId,
          subscription: sub.subscription.gatewaySubscriptionId,
        },
        undefined,
        'evt_overdue_grace'
      );

      expect(res.handled).toBe(true);
      expect(res.action).toBe('payment_marked_overdue');
      expect(mockAccountData.plan).toBe('free'); // initial state before payment
    });

    it('downgrades to Free if payment is overdue past 3 days grace period', async () => {
      const mockDb = createMockDb();
      mockAccountData.plan = 'pro';
      const billingService = new BillingService(mockDb);

      const sub = await billingService.createSubscription(accountId, adminUserId, 'admin', {
        plan: 'pro',
        billingCycle: 'monthly',
        paymentMethod: 'pix',
        customer: { name: 'Lucas', email: 'l@a.com', cpfCnpj: '12345678901' },
      });

      // Due date was 5 days ago (past 3-day grace period)
      mockInvoicesData[0].dueDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

      const res = await billingService.handleWebhook(
        'PAYMENT_OVERDUE',
        {
          id: sub.invoice.gatewayInvoiceId,
          subscription: sub.subscription.gatewaySubscriptionId,
        },
        undefined,
        'evt_overdue_expired'
      );

      expect(res.handled).toBe(true);
      expect(res.action).toBe('DOWNGRADE_TO_FREE');
      expect(mockAccountData.plan).toBe('free');
    });
  });

  describe('5. Agendamento e Reativação de Cancelamento', () => {
    it('schedules cancellation at period end and allows reactivation', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);

      await billingService.createSubscription(accountId, adminUserId, 'admin', {
        plan: 'pro',
        billingCycle: 'monthly',
        paymentMethod: 'credit_card',
        customer: { name: 'Lucas', email: 'l@a.com', cpfCnpj: '12345678901' },
      });

      // 1. Agendar cancelamento
      const scheduled = await billingService.cancelSubscription(accountId, adminUserId, 'admin', {
        acao: 'agendar',
        reason: 'Teste agendamento',
      });
      expect(scheduled.cancelAtPeriodEnd).toBe(true);

      // 2. Reativar cancelamento
      const reactivated = await billingService.cancelSubscription(accountId, adminUserId, 'admin', {
        acao: 'reativar',
      });
      expect(reactivated.cancelAtPeriodEnd).toBe(false);
      expect(reactivated.canceledAt).toBeNull();
    });
  });

  describe('6. Polling de Status do Checkout e Simulação Sandbox', () => {
    it('returns PENDING if not confirmed, and PAID if simulated with simulateCheckoutStatus', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);

      const sub = await billingService.createSubscription(accountId, adminUserId, 'admin', {
        plan: 'pro',
        billingCycle: 'monthly',
        paymentMethod: 'pix',
        customer: { name: 'Lucas', email: 'l@a.com', cpfCnpj: '12345678901' },
      });

      const chargeId = sub.invoice.gatewayInvoiceId!;

      // 1. Initial status is PENDING
      const initialStatus = await billingService.getCheckoutStatus(accountId, chargeId);
      expect(initialStatus.status).toBe('PENDING');
      expect(initialStatus.isPro).toBe(false);

      // 2. Simulate payment confirmation in sandbox
      const simResult = await billingService.simulateCheckoutStatus(accountId, chargeId);
      expect(simResult.status).toBe('PAID');
      expect(simResult.isPro).toBe(true);
      expect(simResult.plan).toBe('pro');
      expect(mockAccountData.plan).toBe('pro');
    });
  });

  describe('7. HTTP Routes: Fastify Integration', () => {
    it('GET /api/billing/checkout/status returns status and POST simulates payment', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);
      const app = await buildServer({ billingService });

      const token = app.jwt.sign({
        userId: adminUserId,
        accountId,
        role: 'admin',
        email: 'lucas@acme.com',
      });

      const sub = await billingService.createSubscription(accountId, adminUserId, 'admin', {
        plan: 'pro',
        billingCycle: 'monthly',
        paymentMethod: 'pix',
        customer: { name: 'Lucas', email: 'l@a.com', cpfCnpj: '12345678901' },
      });
      const chargeId = sub.invoice.gatewayInvoiceId!;

      // 1. GET /api/billing/checkout/status
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/billing/checkout/status?chargeId=${chargeId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(getRes.statusCode).toBe(200);
      const getBody = JSON.parse(getRes.payload);
      expect(getBody.status).toBe('PENDING');

      // 2. POST /api/billing/checkout/status (simulate)
      const postRes = await app.inject({
        method: 'POST',
        url: '/api/billing/checkout/status',
        headers: { authorization: `Bearer ${token}` },
        payload: { chargeId, simulatePaid: true },
      });
      expect(postRes.statusCode).toBe(200);
      const postBody = JSON.parse(postRes.payload);
      expect(postBody.status).toBe('PAID');
      expect(postBody.isPro).toBe(true);
    });

    it('GET /api/billing/admin/webhooks lists events for admin and blocks members', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);
      const app = await buildServer({ billingService });

      const adminToken = app.jwt.sign({
        userId: adminUserId,
        accountId,
        role: 'admin',
        email: 'lucas@acme.com',
      });
      const memberToken = app.jwt.sign({
        userId: 'm-1',
        accountId,
        role: 'member',
        email: 'm@a.com',
      });

      // Admin access succeeds
      const adminRes = await app.inject({
        method: 'GET',
        url: '/api/billing/admin/webhooks?page=1&limit=10',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(adminRes.statusCode).toBe(200);

      // Member access is forbidden (403)
      const memberRes = await app.inject({
        method: 'GET',
        url: '/api/billing/admin/webhooks',
        headers: { authorization: `Bearer ${memberToken}` },
      });
      expect(memberRes.statusCode).toBe(403);
    });

    it('handles route error branches gracefully (400 responses)', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);
      const app = await buildServer({ billingService });

      const adminToken = app.jwt.sign({
        userId: adminUserId,
        accountId,
        role: 'admin',
        email: 'lucas@acme.com',
      });

      // 1. GET /api/billing/checkout/status without chargeId
      const resNoCharge = await app.inject({
        method: 'GET',
        url: '/api/billing/checkout/status',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(resNoCharge.statusCode).toBe(400);

      // 2. GET /api/billing/checkout/status when service throws
      vi.spyOn(billingService, 'getCheckoutStatus').mockRejectedValueOnce(
        new Error('Falha no banco')
      );
      const resThrowGet = await app.inject({
        method: 'GET',
        url: '/api/billing/checkout/status?chargeId=pay_123',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(resThrowGet.statusCode).toBe(400);

      // 3. POST /api/billing/checkout/status with invalid body
      const resInvalidPost = await app.inject({
        method: 'POST',
        url: '/api/billing/checkout/status',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { chargeId: '' },
      });
      expect(resInvalidPost.statusCode).toBe(400);

      // 4. POST /api/billing/checkout/status when service throws
      vi.spyOn(billingService, 'simulateCheckoutStatus').mockRejectedValueOnce(
        new Error('Simulação falhou')
      );
      const resThrowPost = await app.inject({
        method: 'POST',
        url: '/api/billing/checkout/status',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { chargeId: 'pay_123', simulatePaid: true },
      });
      expect(resThrowPost.statusCode).toBe(400);

      // 5. GET /api/billing/admin/webhooks when service throws
      vi.spyOn(billingService, 'listWebhookEvents').mockRejectedValueOnce(
        new Error('Falha ao listar')
      );
      const resThrowAdmin = await app.inject({
        method: 'GET',
        url: '/api/billing/admin/webhooks',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(resThrowAdmin.statusCode).toBe(400);

      // 6. GET /api/billing/summary when service throws
      vi.spyOn(billingService, 'getAccountBillingSummary').mockRejectedValueOnce(
        new Error('Erro resumo')
      );
      const resThrowSummary = await app.inject({
        method: 'GET',
        url: '/api/billing/summary',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(resThrowSummary.statusCode).toBe(400);
    });

    it('listWebhookEvents returns formatted events with pagination', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);

      mockWebhookEventsData.push({
        id: 'evt_1',
        evento: 'PAYMENT_RECEIVED',
        gateway: 'asaas',
        status: 'sucesso',
        acao: 'PLAN_ACTIVATED',
        accountId,
        duracaoMs: 50,
        erroMensagem: null,
        payload: { id: 'pay_1' },
        processadoEm: new Date(),
      });

      const res = await billingService.listWebhookEvents({ page: 1, limit: 10 });
      expect(res.events).toHaveLength(1);
      expect(res.events[0].id).toBe('evt_1');
      expect(res.total).toBe(1);
    });

    it('handleWebhook logs error to webhook_eventos when processing fails', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);

      // Create subscription so targetSub exists
      await billingService.createSubscription(accountId, adminUserId, 'admin', {
        plan: 'pro',
        billingCycle: 'monthly',
        paymentMethod: 'pix',
        customer: { name: 'Lucas', email: 'l@a.com', cpfCnpj: '12345678901' },
      });

      // Mock update to throw
      vi.spyOn(mockDb, 'update').mockImplementation(() => {
        throw new Error('Database disk error');
      });

      await expect(
        billingService.handleWebhook(
          'PAYMENT_RECEIVED',
          { id: 'pay_err_1', externalReference: accountId },
          undefined,
          'evt_error_log_test'
        )
      ).rejects.toThrow('Database disk error');

      const loggedError = mockWebhookEventsData.find((e) => e.id === 'evt_error_log_test');
      expect(loggedError).toBeDefined();
      expect(loggedError.status).toBe('erro');
      expect(loggedError.erroMensagem).toBe('Database disk error');
    });

    it('getCheckoutStatus returns PAID when invoice is already paid and OVERDUE when overdue', async () => {
      const mockDb = createMockDb();
      const billingService = new BillingService(mockDb);

      // Create subscription
      const sub = await billingService.createSubscription(accountId, adminUserId, 'admin', {
        plan: 'pro',
        billingCycle: 'monthly',
        paymentMethod: 'pix',
        customer: { name: 'Lucas', email: 'l@a.com', cpfCnpj: '12345678901' },
      });

      const chargeId = sub.invoice.gatewayInvoiceId!;

      // 1. Mark as paid in local DB
      mockInvoicesData[0].status = 'paid';
      mockAccountData.plan = 'pro';
      const paidStatus = await billingService.getCheckoutStatus(accountId, chargeId);
      expect(paidStatus.status).toBe('PAID');
      expect(paidStatus.isPro).toBe(true);

      // 2. Mark as overdue in local DB
      mockInvoicesData[0].status = 'overdue';
      mockAccountData.plan = 'free';
      const overdueStatus = await billingService.getCheckoutStatus(accountId, chargeId);
      expect(overdueStatus.status).toBe('OVERDUE');
      expect(overdueStatus.isPro).toBe(false);
    });

    it('listWebhookEvents returns empty fallback when query table is absent', async () => {
      const bareDb = { query: {} } as any;
      const billingService = new BillingService(bareDb);

      const res = await billingService.listWebhookEvents({});
      expect(res.events).toEqual([]);
      expect(res.total).toBe(0);
    });

    it('covers getters, missing account, invalid plan and missing subscription error branches', async () => {
      const mockDb = createMockDb();
      const asaasService = new AsaasGatewayService('my-key', 'https://api.asaas.com/v3');
      expect(asaasService.getApiKey()).toBe('my-key');
      expect(asaasService.getBaseUrl()).toBe('https://api.asaas.com/v3');

      const billingService = new BillingService(mockDb, asaasService);

      // 1. getCheckoutStatus with unknown account
      await expect(
        billingService.getCheckoutStatus('99999999-9999-9999-9999-999999999999', 'pay_1')
      ).rejects.toThrow('Organização não encontrada.');

      // 2. createSubscription with unknown account
      await expect(
        billingService.createSubscription(
          '99999999-9999-9999-9999-999999999999',
          adminUserId,
          'admin',
          {
            plan: 'pro',
            billingCycle: 'monthly',
            paymentMethod: 'pix',
            customer: { name: 'Lucas', email: 'l@a.com', cpfCnpj: '12345678901' },
          }
        )
      ).rejects.toThrow('Organização não encontrada.');

      // 3. createSubscription with invalid plan
      await expect(
        billingService.createSubscription(accountId, adminUserId, 'admin', {
          plan: 'invalid_plan' as any,
          billingCycle: 'monthly',
          paymentMethod: 'pix',
          customer: { name: 'Lucas', email: 'l@a.com', cpfCnpj: '12345678901' },
        })
      ).rejects.toThrow('Plano inválido para assinatura.');

      // 4. cancelSubscription when user is not admin/owner
      await expect(
        billingService.cancelSubscription(accountId, adminUserId, 'member')
      ).rejects.toThrow('Apenas administradores ou proprietários podem cancelar a assinatura.');

      // 5. cancelSubscription when no subscription found
      await expect(
        billingService.cancelSubscription(accountId, adminUserId, 'admin')
      ).rejects.toThrow('Nenhuma assinatura ativa encontrada para esta organização.');

      // 6. getAccountBillingSummary with unknown account
      await expect(
        billingService.getAccountBillingSummary('99999999-9999-9999-9999-999999999999')
      ).rejects.toThrow('Organização não encontrada.');
    });

    it('cancelSubscription continues local scheduling even if Asaas gateway cancel throws', async () => {
      const mockDb = createMockDb();
      const asaasService = new AsaasGatewayService('my-key', 'https://api.asaas.com/v3');
      vi.spyOn(asaasService, 'cancelSubscription').mockRejectedValueOnce(
        new Error('Gateway timeout or already cancelled')
      );

      mockSubscriptionsData.push({
        id: 'sub_test_catch',
        accountId,
        gateway: 'asaas',
        gatewaySubscriptionId: 'sub_gateway_err',
        status: 'active',
        plan: 'pro',
        billingCycle: 'monthly',
        paymentMethod: 'pix',
        amountCents: 7990,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
        cancelAtPeriodEnd: false,
        canceledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const billingService = new BillingService(mockDb, asaasService);
      const res = await billingService.cancelSubscription(accountId, adminUserId, 'admin', {
        acao: 'agendar',
      });

      expect(res.cancelAtPeriodEnd).toBe(true);
      expect(res.status).toBe('active');
    });

    it('logWebhookEvent swallows database insert errors without breaking webhook processing', async () => {
      const brokenDb = {
        ...createMockDb(),
        insert: () => ({
          values: () => {
            throw new Error('Database connection failed during audit logging');
          },
        }),
      };

      const asaasService = new AsaasGatewayService('my-key', 'https://api.asaas.com/v3');
      const billingService = new BillingService(brokenDb, asaasService);

      // Should not throw even though insert throws
      await expect(
        (billingService as any).logWebhookEvent({
          id: 'evt_fail_safe_1',
          evento: 'PAYMENT_RECEIVED',
          gateway: 'asaas',
          status: 'SUCCESS',
        })
      ).resolves.toBeUndefined();
    });
  });
});
