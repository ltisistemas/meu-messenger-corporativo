import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { db as defaultDb } from '../db/index';
import {
  accounts,
  users,
  subscriptions,
  invoices,
  Account,
  User,
} from '../db/schema/index';
import {
  PLAN_CONFIGS,
  PlanType,
  AccountStatus,
  getPlanLimits,
  validateUserLimit,
  getQuotaStatus,
  AccountDetailsResponse,
  MemberItemResponse,
} from '@corpchat/shared';

export class AccountService {
  constructor(private db = defaultDb) {}

  /**
   * Returns account details, plan information, quota and trial status (T-29)
   */
  async getAccountDetails(accountId: string): Promise<AccountDetailsResponse> {
    let account = await this.db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });

    if (!account) {
      throw new Error('Organização não encontrada.');
    }

    // Auto-process trial expiration if needed
    account = await this.reconcileTrialStatus(account);

    const activeUsers = await this.db.query.users.findMany({
      where: and(eq(users.accountId, accountId), eq(users.status, 'active')),
    });

    const inactiveUsers = await this.db.query.users.findMany({
      where: and(eq(users.accountId, accountId), eq(users.status, 'inactive')),
    });

    const activeCount = activeUsers.length;
    const inactiveCount = inactiveUsers.length;
    const plan = (account.plan || 'free') as PlanType;
    const limits = getPlanLimits(plan);

    const isTrialing = Boolean(
      account.trialUntil &&
        new Date(account.trialUntil) > new Date() &&
        account.plan === 'pro'
    );

    const trialDaysRemaining = isTrialing && account.trialUntil
      ? Math.max(0, Math.ceil((new Date(account.trialUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;

    const quotaInfo = getQuotaStatus(plan, activeCount);

    return {
      id: account.id,
      name: account.name,
      plan,
      status: account.status as AccountStatus,
      trialUntil: account.trialUntil ? new Date(account.trialUntil).toISOString() : null,
      isTrialing,
      trialDaysRemaining,
      activeUsersCount: activeCount,
      inactiveUsersCount: inactiveCount,
      maxUsers: limits.maxUsers,
      isOverQuota: quotaInfo.isOverQuota,
      excessUsersCount: quotaInfo.excessUsersCount,
      createdAt: new Date(account.createdAt).toISOString(),
    };
  }

  /**
   * Lists all members of the account
   */
  async listMembers(accountId: string): Promise<MemberItemResponse[]> {
    const memberList = await this.db.query.users.findMany({
      where: eq(users.accountId, accountId),
      orderBy: [desc(users.createdAt)],
    });

    return memberList.map((u) => ({
      id: u.id,
      accountId: u.accountId,
      name: u.name,
      email: u.email,
      role: u.role as any,
      status: u.status as any,
      createdAt: new Date(u.createdAt).toISOString(),
      updatedAt: u.updatedAt ? new Date(u.updatedAt).toISOString() : undefined,
    }));
  }

  /**
   * Updates a member's active/inactive status and reconciles account over_quota status (T-29)
   */
  async updateMemberStatus(
    accountId: string,
    callerUserId: string,
    callerRole: string,
    targetUserId: string,
    newStatus: 'active' | 'inactive'
  ): Promise<MemberItemResponse> {
    if (callerRole !== 'owner' && callerRole !== 'admin') {
      throw new Error('Apenas Administradores e o Proprietário podem alterar o status de membros.');
    }

    const targetUser = await this.db.query.users.findFirst({
      where: and(eq(users.id, targetUserId), eq(users.accountId, accountId)),
    });

    if (!targetUser) {
      throw new Error('Membro não encontrado nesta organização.');
    }

    if (targetUser.role === 'owner' && newStatus === 'inactive') {
      throw new Error('O Proprietário da organização não pode ser desativado.');
    }

    const account = await this.db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });

    if (!account) {
      throw new Error('Organização não encontrada.');
    }

    // If activating a member, check if doing so exceeds plan limits
    if (newStatus === 'active' && targetUser.status !== 'active') {
      const activeCount = await this.countActiveUsers(accountId);
      const plan = (account.plan || 'free') as PlanType;
      const limits = getPlanLimits(plan);

      if (activeCount >= limits.maxUsers) {
        throw new Error(
          `Limite de ${limits.maxUsers} usuários atingido para o plano ${limits.name}. Faça upgrade para ativar mais membros.`
        );
      }
    }

    const [updatedUser] = await this.db
      .update(users)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetUserId))
      .returning();

    // Reconcile account over_quota status
    await this.checkAndEnforceQuota(accountId);

    return {
      id: updatedUser.id,
      accountId: updatedUser.accountId,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role as any,
      status: updatedUser.status as any,
      createdAt: new Date(updatedUser.createdAt).toISOString(),
      updatedAt: new Date(updatedUser.updatedAt).toISOString(),
    };
  }

  /**
   * Updates a member's role (admin or member)
   */
  async updateMemberRole(
    accountId: string,
    callerUserId: string,
    callerRole: string,
    targetUserId: string,
    newRole: 'admin' | 'member'
  ): Promise<MemberItemResponse> {
    if (callerRole !== 'owner' && callerRole !== 'admin') {
      throw new Error('Apenas Administradores e o Proprietário podem alterar papéis de membros.');
    }

    const targetUser = await this.db.query.users.findFirst({
      where: and(eq(users.id, targetUserId), eq(users.accountId, accountId)),
    });

    if (!targetUser) {
      throw new Error('Membro não encontrado nesta organização.');
    }

    if (targetUser.role === 'owner') {
      throw new Error('O papel do Proprietário não pode ser alterado.');
    }

    // Non-owner admins cannot demote or promote other admins
    if (callerRole === 'admin' && (targetUser.role === 'admin' || newRole === 'admin')) {
      throw new Error('Apenas o Proprietário pode alterar ou conceder permissões de Administrador.');
    }

    const [updatedUser] = await this.db
      .update(users)
      .set({
        role: newRole,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetUserId))
      .returning();

    return {
      id: updatedUser.id,
      accountId: updatedUser.accountId,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role as any,
      status: updatedUser.status as any,
      createdAt: new Date(updatedUser.createdAt).toISOString(),
      updatedAt: new Date(updatedUser.updatedAt).toISOString(),
    };
  }

  /**
   * Changes account plan directly (e.g., downgrade to Free) and evaluates over_quota rules (T-29)
   */
  async changePlan(
    accountId: string,
    callerRole: string,
    newPlan: PlanType
  ): Promise<AccountDetailsResponse> {
    if (callerRole !== 'owner' && callerRole !== 'admin') {
      throw new Error('Apenas Administradores e o Proprietário podem alterar o plano da organização.');
    }

    const account = await this.db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });

    if (!account) {
      throw new Error('Organização não encontrada.');
    }

    const activeCount = await this.countActiveUsers(accountId);
    const limits = getPlanLimits(newPlan);
    const isExceeded = activeCount > limits.maxUsers;

    // If account was suspended, keep suspended; otherwise if quota exceeded, set over_quota
    const newStatus = account.status === 'suspended'
      ? 'suspended'
      : isExceeded
      ? 'over_quota'
      : 'active';

    await this.db
      .update(accounts)
      .set({
        plan: newPlan,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, accountId));

    return this.getAccountDetails(accountId);
  }

  /**
   * Evaluates active user count against current plan and synchronizes account status (T-29)
   */
  async checkAndEnforceQuota(accountId: string): Promise<{
    accountStatus: string;
    isOverQuota: boolean;
    activeUsersCount: number;
    maxUsers: number;
  }> {
    const account = await this.db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });

    if (!account) {
      throw new Error('Organização não encontrada.');
    }

    if (account.status === 'suspended') {
      return {
        accountStatus: 'suspended',
        isOverQuota: false,
        activeUsersCount: await this.countActiveUsers(accountId),
        maxUsers: getPlanLimits((account.plan || 'free') as PlanType).maxUsers,
      };
    }

    const plan = (account.plan || 'free') as PlanType;
    const limits = getPlanLimits(plan);
    const activeCount = await this.countActiveUsers(accountId);
    const isExceeded = activeCount > limits.maxUsers;

    const targetStatus = isExceeded ? 'over_quota' : 'active';

    if (account.status !== targetStatus) {
      await this.db
        .update(accounts)
        .set({
          status: targetStatus,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, accountId));
    }

    return {
      accountStatus: targetStatus,
      isOverQuota: isExceeded,
      activeUsersCount: activeCount,
      maxUsers: limits.maxUsers,
    };
  }

  /**
   * Scans and processes expired trials across accounts (T-29)
   */
  async processTrialExpirations(): Promise<{
    processedCount: number;
    downgradedAccountIds: string[];
  }> {
    const now = new Date();

    // Accounts with expired trial, currently on pro plan
    const expiredAccounts = await this.db.query.accounts.findMany({
      where: and(
        eq(accounts.plan, 'pro'),
        sql`${accounts.trialUntil} IS NOT NULL AND ${accounts.trialUntil} <= ${now}`
      ),
    });

    const downgradedIds: string[] = [];

    for (const acc of expiredAccounts) {
      // Check if there is an active paid subscription
      const activeSub = await this.db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.accountId, acc.id),
          eq(subscriptions.status, 'active')
        ),
      });

      if (!activeSub) {
        const activeCount = await this.countActiveUsers(acc.id);
        const isExceeded = activeCount > PLAN_CONFIGS.free.maxUsers;
        const newStatus = acc.status === 'suspended'
          ? 'suspended'
          : isExceeded
          ? 'over_quota'
          : 'active';

        await this.db
          .update(accounts)
          .set({
            plan: 'free',
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, acc.id));

        downgradedIds.push(acc.id);
      }
    }

    return {
      processedCount: downgradedIds.length,
      downgradedAccountIds: downgradedIds,
    };
  }

  /**
   * Suspends delinquent accounts past grace period (T-29)
   */
  async processOverdueInvoices(gracePeriodDays = 3): Promise<{
    suspendedCount: number;
    suspendedAccountIds: string[];
  }> {
    const graceCutoff = new Date(Date.now() - gracePeriodDays * 24 * 60 * 60 * 1000);

    // Invoices overdue past grace cutoff
    const overdueInvoices = await this.db.query.invoices.findMany({
      where: and(
        eq(invoices.status, 'overdue'),
        sql`${invoices.dueDate} <= ${graceCutoff}`
      ),
    });

    const suspendedIds = new Set<string>();

    for (const inv of overdueInvoices) {
      // Check if account is not already suspended
      const acc = await this.db.query.accounts.findFirst({
        where: eq(accounts.id, inv.accountId),
      });

      if (acc && acc.status !== 'suspended') {
        await this.db
          .update(accounts)
          .set({
            status: 'suspended',
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, acc.id));

        suspendedIds.add(acc.id);
      }
    }

    return {
      suspendedCount: suspendedIds.size,
      suspendedAccountIds: Array.from(suspendedIds),
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

  private async reconcileTrialStatus(account: Account): Promise<Account> {
    if (
      account.plan === 'pro' &&
      account.trialUntil &&
      new Date(account.trialUntil) <= new Date()
    ) {
      // Check if active subscription exists
      const activeSub = await this.db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.accountId, account.id),
          eq(subscriptions.status, 'active')
        ),
      });

      if (!activeSub) {
        const activeCount = await this.countActiveUsers(account.id);
        const isExceeded = activeCount > PLAN_CONFIGS.free.maxUsers;
        const newStatus = account.status === 'suspended'
          ? 'suspended'
          : isExceeded
          ? 'over_quota'
          : 'active';

        const [updatedAccount] = await this.db
          .update(accounts)
          .set({
            plan: 'free',
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, account.id))
          .returning();

        return updatedAccount;
      }
    }

    return account;
  }
}
