import { eq, and, desc, sql, or } from 'drizzle-orm';
import { db as defaultDb } from '../db/index';
import {
  accounts,
  users,
  subscriptions,
  invoices,
  webhookEvents,
  Subscription,
  Invoice,
} from '../db/schema/index';
import {
  PLAN_CONFIGS,
  PlanType,
  CreateSubscriptionDto,
  CancelSubscriptionDto,
  SubscriptionResponse,
  InvoiceResponse,
  BillingSummaryResponse,
  CheckoutStatusResponse,
  WebhookEventsListResponse,
} from '@corpchat/shared';
import { AsaasGatewayService } from './asaas.service';

export class BillingService {
  constructor(
    private db = defaultDb,
    private asaasService = new AsaasGatewayService()
  ) {}

  /**
   * Creates a new subscription for an account (admin/owner only - T-28)
   */
  async createSubscription(
    accountId: string,
    userId: string,
    userRole: string,
    dto: CreateSubscriptionDto
  ): Promise<{
    subscription: SubscriptionResponse;
    invoice: InvoiceResponse;
    checkout?: {
      pixQrCode?: string;
      pixCopyPaste?: string;
      bankSlipUrl?: string;
      invoiceUrl?: string;
    };
  }> {
    if (userRole !== 'admin' && userRole !== 'owner') {
      throw new Error(
        'Apenas administradores ou proprietários da organização podem gerenciar assinaturas.'
      );
    }

    const account = await this.db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });

    if (!account) {
      throw new Error('Organização não encontrada.');
    }

    const planConfig = PLAN_CONFIGS[dto.plan];
    if (!planConfig) {
      throw new Error('Plano inválido para assinatura.');
    }

    const isYearly = dto.billingCycle === 'yearly';
    // 10% discount on yearly plans
    const amountCents = isYearly
      ? Math.round(planConfig.priceMonthlyCents * 12 * 0.9)
      : planConfig.priceMonthlyCents;
    const amountFloat = amountCents / 100;

    // Check if account already has an active subscription with customer ID
    const existingSub = await this.db.query.subscriptions.findFirst({
      where: eq(subscriptions.accountId, accountId),
      orderBy: [desc(subscriptions.createdAt)],
    });

    // 1. Create or get customer in Asaas using cascade resolution
    const customer = await this.asaasService.createOrGetCustomer({
      name: dto.customer.name,
      email: dto.customer.email,
      cpfCnpj: dto.customer.cpfCnpj,
      phone: dto.customer.phone,
      postalCode: dto.customer.postalCode,
      addressNumber: dto.customer.addressNumber,
      existingCustomerId: existingSub?.gatewayCustomerId || undefined,
      externalReference: accountId,
    });

    // 2. Create subscription in Asaas
    const nextDueDate = new Date(Date.now() + 86400 * 1000).toISOString().split('T')[0];
    const asaasBillingType =
      dto.paymentMethod === 'pix'
        ? 'PIX'
        : dto.paymentMethod === 'credit_card'
          ? 'CREDIT_CARD'
          : 'BOLETO';

    const asaasResult = await this.asaasService.createSubscription({
      customerId: customer.id,
      billingType: asaasBillingType,
      value: amountFloat,
      nextDueDate,
      cycle: isYearly ? 'YEARLY' : 'MONTHLY',
      description: `Assinatura NextMsg - Plano ${planConfig.name} (${dto.billingCycle})`,
      externalReference: accountId,
      maxPayments: isYearly ? 5 : 24,
      creditCard: dto.creditCard,
      creditCardHolderInfo: dto.customer,
    });

    const isCreditCardApproved = dto.paymentMethod === 'credit_card';
    const subStatus = isCreditCardApproved ? 'active' : 'pending';
    const invoiceStatus = isCreditCardApproved ? 'paid' : 'pending';

    const periodDays = isYearly ? 365 : 30;
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date(Date.now() + periodDays * 86400 * 1000);

    // 3. Insert subscription in database
    const [newSub] = await this.db
      .insert(subscriptions)
      .values({
        accountId,
        gateway: 'asaas',
        gatewaySubscriptionId: asaasResult.subscription.id,
        gatewayCustomerId: customer.id,
        plan: dto.plan,
        billingCycle: dto.billingCycle,
        paymentMethod: dto.paymentMethod,
        status: subStatus,
        amountCents,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
        metadata: {
          customerData: dto.customer,
          asaasSubscription: asaasResult.subscription,
        },
      })
      .returning();

    // 4. Insert invoice in database
    const [newInvoice] = await this.db
      .insert(invoices)
      .values({
        accountId,
        subscriptionId: newSub.id,
        gatewayInvoiceId: asaasResult.initialPayment?.id || `inv_${crypto.randomUUID()}`,
        amountCents,
        status: invoiceStatus,
        paymentMethod: dto.paymentMethod,
        pdfUrl: asaasResult.initialPayment?.invoiceUrl,
        bankSlipUrl: asaasResult.initialPayment?.bankSlipUrl,
        pixQrCode: asaasResult.pixQrCode?.encodedImage,
        pixCopyPaste: asaasResult.pixQrCode?.payload,
        dueDate: new Date(nextDueDate),
        paidAt: isCreditCardApproved ? new Date() : null,
      })
      .returning();

    // 5. If immediate payment (credit card), activate account plan right away
    if (isCreditCardApproved) {
      const activeCount = await this.countActiveUsers(accountId);
      const isExceeded = activeCount > planConfig.maxUsers;
      await this.db
        .update(accounts)
        .set({
          plan: dto.plan,
          status: isExceeded ? 'over_quota' : 'active',
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, accountId));
    }

    return {
      subscription: this.formatSubscription(newSub),
      invoice: this.formatInvoice(newInvoice),
      checkout: {
        pixQrCode: asaasResult.pixQrCode?.encodedImage,
        pixCopyPaste: asaasResult.pixQrCode?.payload,
        bankSlipUrl: asaasResult.initialPayment?.bankSlipUrl,
        invoiceUrl: asaasResult.initialPayment?.invoiceUrl,
      },
    };
  }

  /**
   * Handles webhook notifications from Asaas Gateway with idempotency, multi-key resolution,
   * audit logging and protection against unwanted downgrades.
   */
  async handleWebhook(
    event: string,
    paymentData: any,
    webhookToken?: string,
    incomingEventId?: string
  ): Promise<{ handled: boolean; action?: string; duplicate?: boolean }> {
    const startTime = Date.now();
    const expectedSecret = process.env.ASAAS_WEBHOOK_SECRET;
    if (expectedSecret && webhookToken && webhookToken !== expectedSecret) {
      throw new Error('Token de webhook Asaas inválido.');
    }

    if (!paymentData || !paymentData.id) {
      return { handled: false, action: 'ignored_no_payload' };
    }

    // Determine unique event ID for idempotency (Asaas provides event ID e.g. evt_...)
    const eventId =
      incomingEventId ||
      paymentData.eventId ||
      (incomingEventId ? incomingEventId : `evt_${paymentData.id}_${event}`);

    // Check idempotency against webhook_eventos table
    const alreadyProcessed = await this.findWebhookEvent(eventId);
    if (alreadyProcessed) {
      await this.logWebhookEvent({
        id: `dup_${Date.now()}_${eventId}`,
        evento: event,
        status: 'duplicado',
        acao: 'DUPLICATE_SKIPPED',
        accountId: alreadyProcessed.accountId || undefined,
        duracaoMs: Date.now() - startTime,
        payload: paymentData,
      });
      return { handled: true, duplicate: true, action: 'DUPLICATE_SKIPPED' };
    }

    const gatewayPaymentId = paymentData.id;
    const gatewaySubId = paymentData.subscription;
    const externalRef = paymentData.externalReference;
    const customerId = paymentData.customer;

    // 1. Multi-key Resolution:
    // Step A: externalReference (which maps to accountId)
    // Step B: subscriptionId (gateway_subscription_id)
    // Step C: paymentId (gateway_invoice_id)
    // Step D: customerId (gateway_customer_id)
    let targetAccount: any;
    let targetSub: Subscription | undefined;
    let targetInvoice: Invoice | undefined;

    if (externalRef) {
      targetAccount = await this.db.query.accounts.findFirst({
        where: eq(accounts.id, externalRef),
      });
      if (targetAccount) {
        targetSub = await this.db.query.subscriptions.findFirst({
          where: eq(subscriptions.accountId, targetAccount.id),
          orderBy: [desc(subscriptions.createdAt)],
        });
      }
    }

    if (!targetSub && gatewaySubId) {
      targetSub = await this.db.query.subscriptions.findFirst({
        where: eq(subscriptions.gatewaySubscriptionId, gatewaySubId),
      });
    }

    if (gatewayPaymentId) {
      targetInvoice = await this.db.query.invoices.findFirst({
        where: eq(invoices.gatewayInvoiceId, gatewayPaymentId),
      });
      if (targetInvoice?.subscriptionId && !targetSub) {
        targetSub = await this.db.query.subscriptions.findFirst({
          where: eq(subscriptions.id, targetInvoice.subscriptionId),
        });
      }
    }

    if (!targetSub && customerId) {
      targetSub = await this.db.query.subscriptions.findFirst({
        where: eq(subscriptions.gatewayCustomerId, customerId),
        orderBy: [desc(subscriptions.createdAt)],
      });
    }

    if (!targetAccount && targetSub?.accountId) {
      targetAccount = await this.db.query.accounts.findFirst({
        where: eq(accounts.id, targetSub.accountId),
      });
    }

    // If completely unmatched, record audit with status 'aviso' and return 200 OK
    // so Asaas does not retry indefinitely
    if (!targetSub && !targetAccount && !targetInvoice) {
      const duracaoMs = Date.now() - startTime;
      await this.logWebhookEvent({
        id: eventId,
        evento: event,
        status: 'aviso',
        acao: 'UNMATCHED_ACCOUNT',
        duracaoMs,
        payload: paymentData,
      });
      return { handled: true, action: 'UNMATCHED_ACCOUNT' };
    }

    // Determine if account is protected from downgrade (e.g. admin or manual exemption)
    const isAccountProtected = Boolean(
      (targetAccount as any)?.isProtected || (targetSub?.metadata as any)?.manualExemption
    );

    let resultAction = `unhandled_event_${event}`;

    try {
      // 2. Process specific Asaas webhook events
      switch (event) {
        case 'PAYMENT_CONFIRMED':
        case 'PAYMENT_RECEIVED':
        case 'PAYMENT_RECEIVED_IN_CASH': {
          const paidDate = paymentData.paymentDate ? new Date(paymentData.paymentDate) : new Date();

          // Update invoice to paid
          if (targetInvoice) {
            await this.db
              .update(invoices)
              .set({
                status: 'paid',
                paidAt: paidDate,
              })
              .where(eq(invoices.id, targetInvoice.id));
          }

          // Update subscription and account plan
          if (targetSub) {
            const isYearly = targetSub.billingCycle === 'yearly';
            const periodDays = isYearly ? 365 : 30;
            const currentPeriodStart = paidDate;
            const currentPeriodEnd = new Date(paidDate.getTime() + periodDays * 86400 * 1000);

            await this.db
              .update(subscriptions)
              .set({
                status: 'active',
                currentPeriodStart,
                currentPeriodEnd,
                cancelAtPeriodEnd: false,
              })
              .where(eq(subscriptions.id, targetSub.id));

            // Upgrade account to plan and reconcile quota
            const activeCount = await this.countActiveUsers(targetSub.accountId);
            const targetPlanLimits = PLAN_CONFIGS[targetSub.plan as PlanType] || PLAN_CONFIGS.free;
            const isExceeded = activeCount > targetPlanLimits.maxUsers;

            await this.db
              .update(accounts)
              .set({
                plan: targetSub.plan,
                status: isExceeded ? 'over_quota' : 'active',
                updatedAt: new Date(),
              })
              .where(eq(accounts.id, targetSub.accountId));
          }

          resultAction = 'payment_confirmed_and_plan_activated';
          break;
        }

        case 'PAYMENT_OVERDUE': {
          if (targetInvoice) {
            await this.db
              .update(invoices)
              .set({ status: 'overdue' })
              .where(eq(invoices.id, targetInvoice.id));
          }
          if (targetSub) {
            await this.db
              .update(subscriptions)
              .set({ status: 'overdue' })
              .where(eq(subscriptions.id, targetSub.id));
          }

          // Grace period tolerance of 3 calendar days
          const dueDate = targetInvoice?.dueDate ? new Date(targetInvoice.dueDate) : new Date();
          const daysPastDue = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysPastDue > 3 && targetSub) {
            if (isAccountProtected) {
              resultAction = 'ADMIN_DOWNGRADE_SKIPPED';
              break;
            }

            const activeCount = await this.countActiveUsers(targetSub.accountId);
            const isExceeded = activeCount > PLAN_CONFIGS.free.maxUsers;
            await this.db
              .update(accounts)
              .set({
                plan: 'free',
                status: isExceeded ? 'over_quota' : 'active',
                updatedAt: new Date(),
              })
              .where(eq(accounts.id, targetSub.accountId));

            resultAction = 'DOWNGRADE_TO_FREE';
          } else {
            resultAction = 'payment_marked_overdue';
          }
          break;
        }

        case 'PAYMENT_REFUNDED': {
          if (targetInvoice) {
            await this.db
              .update(invoices)
              .set({ status: 'refunded' })
              .where(eq(invoices.id, targetInvoice.id));
          }

          if (isAccountProtected) {
            resultAction = 'ADMIN_DOWNGRADE_SKIPPED';
            break;
          }

          if (targetSub) {
            const activeCount = await this.countActiveUsers(targetSub.accountId);
            const isExceeded = activeCount > PLAN_CONFIGS.free.maxUsers;
            await this.db
              .update(accounts)
              .set({
                plan: 'free',
                status: isExceeded ? 'over_quota' : 'active',
                updatedAt: new Date(),
              })
              .where(eq(accounts.id, targetSub.accountId));
          }

          resultAction = 'payment_refunded';
          break;
        }

        case 'SUBSCRIPTION_CANCELED':
        case 'SUBSCRIPTION_DELETED':
        case 'PAYMENT_DELETED':
        case 'PAYMENT_CHARGEBACK_REQUESTED': {
          if (targetSub) {
            await this.db
              .update(subscriptions)
              .set({
                status: 'canceled',
                canceledAt: new Date(),
              })
              .where(eq(subscriptions.id, targetSub.id));

            // If current period has expired or chargeback, downgrade to Free plan
            const isExpired = new Date(targetSub.currentPeriodEnd) <= new Date();
            const isImmediateRevoke = event === 'PAYMENT_CHARGEBACK_REQUESTED' || isExpired;

            if (isImmediateRevoke) {
              if (isAccountProtected) {
                resultAction = 'ADMIN_DOWNGRADE_SKIPPED';
                break;
              }

              const activeCount = await this.countActiveUsers(targetSub.accountId);
              const isExceeded = activeCount > PLAN_CONFIGS.free.maxUsers;

              await this.db
                .update(accounts)
                .set({
                  plan: 'free',
                  status: isExceeded ? 'over_quota' : 'active',
                  updatedAt: new Date(),
                })
                .where(eq(accounts.id, targetSub.accountId));
            }
          }
          resultAction = 'subscription_canceled';
          break;
        }

        default:
          resultAction = `unhandled_event_${event}`;
          break;
      }

      // Log successful audit
      const duracaoMs = Date.now() - startTime;
      await this.logWebhookEvent({
        id: eventId,
        evento: event,
        status: 'sucesso',
        acao: resultAction,
        accountId: targetAccount?.id || targetSub?.accountId,
        duracaoMs,
        payload: paymentData,
      });

      return { handled: true, action: resultAction };
    } catch (err: any) {
      const duracaoMs = Date.now() - startTime;
      await this.logWebhookEvent({
        id: eventId,
        evento: event,
        status: 'erro',
        acao: 'ERROR',
        erroMensagem: err.message,
        accountId: targetAccount?.id || targetSub?.accountId,
        duracaoMs,
        payload: paymentData,
      });
      throw err;
    }
  }

  /**
   * Queries checkout status for polling and auto-confirms if paid on gateway
   */
  async getCheckoutStatus(accountId: string, chargeId: string): Promise<CheckoutStatusResponse> {
    const account = await this.db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });

    if (!account) {
      throw new Error('Organização não encontrada.');
    }

    // 1. Look up invoice in local DB
    const allInvoices = await this.db.query.invoices.findMany({
      where: eq(invoices.accountId, accountId),
      orderBy: [desc(invoices.createdAt)],
    });

    const invoice = allInvoices.find(
      (inv) => inv.gatewayInvoiceId === chargeId || inv.id === chargeId
    );

    // If marked paid in local DB (via webhook)
    if (invoice?.status === 'paid') {
      return {
        status: 'PAID',
        isPro: account.plan === 'pro' || account.plan === 'enterprise',
        plan: account.plan,
        invoiceUrl: invoice.pdfUrl,
        sucesso: true,
      };
    }

    // 2. Query gateway directly
    try {
      const gatewayPayment = await this.asaasService.getPaymentStatus(chargeId);
      if (
        gatewayPayment.status === 'CONFIRMED' ||
        gatewayPayment.status === 'RECEIVED' ||
        gatewayPayment.status === 'RECEIVED_IN_CASH'
      ) {
        // Confirm locally
        if (invoice) {
          await this.db
            .update(invoices)
            .set({ status: 'paid', paidAt: new Date() })
            .where(eq(invoices.id, invoice.id));
        }

        const activeSub = await this.db.query.subscriptions.findFirst({
          where: eq(subscriptions.accountId, accountId),
          orderBy: [desc(subscriptions.createdAt)],
        });

        if (activeSub) {
          const isYearly = activeSub.billingCycle === 'yearly';
          const periodEnd = new Date(Date.now() + (isYearly ? 365 : 30) * 86400 * 1000);
          await this.db
            .update(subscriptions)
            .set({ status: 'active', currentPeriodEnd: periodEnd })
            .where(eq(subscriptions.id, activeSub.id));

          const activeCount = await this.countActiveUsers(accountId);
          const limits = PLAN_CONFIGS[activeSub.plan as PlanType] || PLAN_CONFIGS.free;
          const isExceeded = activeCount > limits.maxUsers;

          await this.db
            .update(accounts)
            .set({
              plan: activeSub.plan,
              status: isExceeded ? 'over_quota' : 'active',
              updatedAt: new Date(),
            })
            .where(eq(accounts.id, accountId));

          return {
            status: 'PAID',
            isPro: true,
            plan: activeSub.plan,
            invoiceUrl: invoice?.pdfUrl || gatewayPayment.invoiceUrl,
            message: 'Pagamento confirmado e plano ativado com sucesso!',
            sucesso: true,
          };
        }
      }
    } catch (_) {
      // If gateway query throws or payment is pending, continue
    }

    return {
      status: invoice?.status === 'overdue' ? 'OVERDUE' : 'PENDING',
      isPro: account.plan === 'pro' || account.plan === 'enterprise',
      plan: account.plan,
      invoiceUrl: invoice?.pdfUrl,
      sucesso: false,
    };
  }

  /**
   * Simulates immediate confirmation of a checkout charge for sandbox/dev testing
   */
  async simulateCheckoutStatus(
    accountId: string,
    chargeId: string
  ): Promise<CheckoutStatusResponse> {
    this.asaasService.simulateDevPayment(chargeId);
    return this.getCheckoutStatus(accountId, chargeId);
  }

  /**
   * Cancels a subscription or schedules cancellation at period end (T-28)
   */
  async cancelSubscription(
    accountId: string,
    userId: string,
    userRole: string,
    dto?: CancelSubscriptionDto
  ): Promise<SubscriptionResponse> {
    if (userRole !== 'admin' && userRole !== 'owner') {
      throw new Error('Apenas administradores ou proprietários podem cancelar a assinatura.');
    }

    const sub = await this.db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.accountId, accountId),
        or(eq(subscriptions.status, 'active'), eq(subscriptions.status, 'pending'))
      ),
      orderBy: [desc(subscriptions.createdAt)],
    });

    if (!sub) {
      throw new Error('Nenhuma assinatura ativa encontrada para esta organização.');
    }

    // Check if user requested reactivation of a previously scheduled cancellation
    if (dto?.acao === 'reativar') {
      const [reactivatedSub] = await this.db
        .update(subscriptions)
        .set({
          cancelAtPeriodEnd: false,
          canceledAt: null,
        })
        .where(eq(subscriptions.id, sub.id))
        .returning();

      return this.formatSubscription(reactivatedSub);
    }

    // Cancel in Asaas gateway
    if (sub.gatewaySubscriptionId) {
      try {
        await this.asaasService.cancelSubscription(sub.gatewaySubscriptionId);
      } catch (err) {
        // Log gateway cancel error but continue local schedule
      }
    }

    // Schedule cancellation at period end
    const [updatedSub] = await this.db
      .update(subscriptions)
      .set({
        cancelAtPeriodEnd: true,
        canceledAt: new Date(),
        metadata: {
          ...((sub.metadata as any) || {}),
          cancellationReason: dto?.reason || 'Cancelado pelo usuário',
        },
      })
      .where(eq(subscriptions.id, sub.id))
      .returning();

    return this.formatSubscription(updatedSub);
  }

  /**
   * Returns complete billing summary for an account
   */
  async getAccountBillingSummary(accountId: string): Promise<BillingSummaryResponse> {
    const account = await this.db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });

    if (!account) {
      throw new Error('Organização não encontrada.');
    }

    const activeUsers = await this.db.query.users.findMany({
      where: and(eq(users.accountId, accountId), eq(users.status, 'active')),
    });

    const activeSub = await this.db.query.subscriptions.findFirst({
      where: eq(subscriptions.accountId, accountId),
      orderBy: [desc(subscriptions.createdAt)],
    });

    const allInvoices = await this.db.query.invoices.findMany({
      where: eq(invoices.accountId, accountId),
      orderBy: [desc(invoices.createdAt)],
      limit: 20,
    });

    const plan = (account.plan || 'free') as PlanType;
    const planLimits = PLAN_CONFIGS[plan] || PLAN_CONFIGS.free;

    return {
      account: {
        id: account.id,
        name: account.name,
        plan: account.plan,
        status: account.status,
        activeUsersCount: activeUsers.length,
        maxUsers: planLimits.maxUsers,
      },
      subscription: activeSub ? this.formatSubscription(activeSub) : null,
      latestInvoice: allInvoices[0] ? this.formatInvoice(allInvoices[0]) : null,
      invoices: allInvoices.map((inv) => this.formatInvoice(inv)),
    };
  }

  /**
   * Lists audited webhook events for administrative observability
   */
  async listWebhookEvents(options: {
    page?: number;
    limit?: number;
    status?: string;
    gateway?: string;
  }): Promise<WebhookEventsListResponse> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    try {
      if ((this.db as any).query?.webhookEvents?.findMany) {
        const events = await (this.db as any).query.webhookEvents.findMany({
          orderBy: [desc(webhookEvents.processadoEm)],
          limit,
          offset,
        });

        return {
          events: events.map((e: any) => ({
            id: e.id,
            evento: e.evento,
            gateway: e.gateway,
            status: e.status,
            acao: e.acao,
            accountId: e.accountId,
            duracaoMs: e.duracaoMs,
            erroMensagem: e.erroMensagem,
            payload: e.payload,
            processadoEm: new Date(e.processadoEm).toISOString(),
          })),
          total: events.length,
          page,
          limit,
        };
      }
    } catch (_) {}

    return { events: [], total: 0, page, limit };
  }

  private async findWebhookEvent(id: string): Promise<any | null> {
    try {
      if ((this.db as any).query?.webhookEvents?.findFirst) {
        return await (this.db as any).query.webhookEvents.findFirst({
          where: eq(webhookEvents.id, id),
        });
      }
    } catch (_) {}
    return null;
  }

  private async logWebhookEvent(params: {
    id: string;
    evento: string;
    status: string;
    acao?: string;
    accountId?: string;
    duracaoMs?: number;
    erroMensagem?: string;
    payload?: any;
  }): Promise<void> {
    try {
      if (this.db.insert) {
        await this.db.insert(webhookEvents).values({
          id: params.id,
          evento: params.evento,
          gateway: 'asaas',
          status: params.status,
          acao: params.acao,
          accountId: params.accountId,
          duracaoMs: params.duracaoMs,
          erroMensagem: params.erroMensagem,
          payload: params.payload,
        });
      }
    } catch (_) {
      // Do not block webhook processing if audit logging insert fails
    }
  }

  private formatSubscription(sub: Subscription): SubscriptionResponse {
    return {
      id: sub.id,
      accountId: sub.accountId,
      gateway: sub.gateway,
      gatewaySubscriptionId: sub.gatewaySubscriptionId,
      plan: sub.plan as any,
      billingCycle: sub.billingCycle as any,
      paymentMethod: sub.paymentMethod as any,
      status: sub.status as any,
      amountCents: sub.amountCents,
      currentPeriodStart: new Date(sub.currentPeriodStart).toISOString(),
      currentPeriodEnd: new Date(sub.currentPeriodEnd).toISOString(),
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      canceledAt: sub.canceledAt ? new Date(sub.canceledAt).toISOString() : null,
      createdAt: new Date(sub.createdAt).toISOString(),
      updatedAt: new Date(sub.updatedAt).toISOString(),
    };
  }

  private formatInvoice(inv: Invoice): InvoiceResponse {
    return {
      id: inv.id,
      accountId: inv.accountId,
      subscriptionId: inv.subscriptionId,
      gatewayInvoiceId: inv.gatewayInvoiceId,
      amountCents: inv.amountCents,
      status: inv.status as any,
      paymentMethod: inv.paymentMethod as any,
      pdfUrl: inv.pdfUrl,
      bankSlipUrl: inv.bankSlipUrl,
      pixQrCode: inv.pixQrCode,
      pixCopyPaste: inv.pixCopyPaste,
      dueDate: new Date(inv.dueDate).toISOString(),
      paidAt: inv.paidAt ? new Date(inv.paidAt).toISOString() : null,
      createdAt: new Date(inv.createdAt).toISOString(),
    };
  }

  private async countActiveUsers(accountId: string): Promise<number> {
    if (this.db.query?.users?.findMany) {
      const activeUsers = await this.db.query.users.findMany({
        where: and(eq(users.accountId, accountId), eq(users.status, 'active')),
      });
      return activeUsers.length;
    }
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.accountId, accountId), eq(users.status, 'active')));

    return result[0]?.count ?? 0;
  }
}
