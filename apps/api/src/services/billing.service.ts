import { eq, and, desc, sql } from 'drizzle-orm';
import { db as defaultDb } from '../db/index';
import {
  accounts,
  users,
  subscriptions,
  invoices,
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
      throw new Error('Apenas administradores ou proprietários da organização podem gerenciar assinaturas.');
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

    // 1. Create or get customer in Asaas
    const customer = await this.asaasService.createOrGetCustomer({
      name: dto.customer.name,
      email: dto.customer.email,
      cpfCnpj: dto.customer.cpfCnpj,
      phone: dto.customer.phone,
      postalCode: dto.customer.postalCode,
      addressNumber: dto.customer.addressNumber,
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
   * Handles webhook notifications from Asaas Gateway (T-28 / T-29)
   */
  async handleWebhook(
    event: string,
    paymentData: any,
    webhookToken?: string
  ): Promise<{ handled: boolean; action?: string }> {
    const expectedSecret = process.env.ASAAS_WEBHOOK_SECRET;
    if (expectedSecret && webhookToken && webhookToken !== expectedSecret) {
      throw new Error('Token de webhook Asaas inválido.');
    }

    if (!paymentData || !paymentData.id) {
      return { handled: false, action: 'ignored_no_payload' };
    }

    const gatewayPaymentId = paymentData.id;
    const gatewaySubId = paymentData.subscription;

    // 1. Find invoice or subscription
    let targetInvoice: Invoice | undefined;
    let targetSub: Subscription | undefined;

    if (gatewayPaymentId) {
      targetInvoice = await this.db.query.invoices.findFirst({
        where: eq(invoices.gatewayInvoiceId, gatewayPaymentId),
      });
    }

    if (gatewaySubId) {
      targetSub = await this.db.query.subscriptions.findFirst({
        where: eq(subscriptions.gatewaySubscriptionId, gatewaySubId),
      });
    } else if (targetInvoice?.subscriptionId) {
      targetSub = await this.db.query.subscriptions.findFirst({
        where: eq(subscriptions.id, targetInvoice.subscriptionId),
      });
    }

    // 2. Process specific Asaas webhook events
    switch (event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED': {
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

        return { handled: true, action: 'payment_confirmed_and_plan_activated' };
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
        return { handled: true, action: 'payment_marked_overdue' };
      }

      case 'PAYMENT_REFUNDED': {
        if (targetInvoice) {
          await this.db
            .update(invoices)
            .set({ status: 'refunded' })
            .where(eq(invoices.id, targetInvoice.id));
        }
        return { handled: true, action: 'payment_refunded' };
      }

      case 'SUBSCRIPTION_CANCELED':
      case 'PAYMENT_DELETED': {
        if (targetSub) {
          await this.db
            .update(subscriptions)
            .set({
              status: 'canceled',
              canceledAt: new Date(),
            })
            .where(eq(subscriptions.id, targetSub.id));

          // If current period has expired, downgrade to Free plan and enforce quota
          if (new Date(targetSub.currentPeriodEnd) <= new Date()) {
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
        return { handled: true, action: 'subscription_canceled' };
      }

      default:
        return { handled: true, action: `unhandled_event_${event}` };
    }
  }

  /**
   * Cancels a subscription at end of current billing cycle (T-28)
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
        eq(subscriptions.status, 'active')
      ),
      orderBy: [desc(subscriptions.createdAt)],
    });

    if (!sub) {
      throw new Error('Nenhuma assinatura ativa encontrada para esta organização.');
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
