import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { eq, and, sql } from 'drizzle-orm';
import { db as defaultDb } from '../db/index';
import { accounts, users, invitations, Invitation, User } from '../db/schema/index';
import { CreateInvitationDto, AcceptInvitationDto, validateUserLimit, PlanType } from '@corpchat/shared';

const INVITATION_EXPIRATION_DAYS = 7;
const SALT_ROUNDS = 10;

export class InvitationService {
  constructor(private db = defaultDb) {}

  async countActiveUsers(accountId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.accountId, accountId), eq(users.status, 'active')));

    return result[0]?.count ?? 0;
  }

  async createInvitation(
    accountId: string,
    invitedById: string,
    callerRole: string,
    dto: CreateInvitationDto
  ) {
    // 1. Only owner and admin can invite members
    if (callerRole !== 'owner' && callerRole !== 'admin') {
      throw new Error('Apenas Administradores e o Proprietário podem convidar novos membros.');
    }

    // 2. Fetch account details to verify plan and status
    const account = await this.db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });

    if (!account) {
      throw new Error('Organização não encontrada.');
    }

    if (account.status === 'suspended') {
      throw new Error('Organização suspensa. Não é possível convidar novos membros.');
    }

    if (account.status === 'over_quota') {
      throw new Error('Sua conta atingiu o limite de usuários do plano. Desative os membros excedentes ou faça upgrade para voltar a convidar.');
    }

    // 3. Count active members and validate user limit according to plan
    const activeCount = await this.countActiveUsers(accountId);
    const limitCheck = validateUserLimit(account.plan as PlanType, activeCount);

    if (!limitCheck.allowed) {
      throw new Error(limitCheck.error || 'Limite de usuários atingido para o plano atual.');
    }

    const email = dto.email.toLowerCase().trim();

    // 4. Check if user already exists in this account
    const existingUser = await this.db.query.users.findFirst({
      where: and(eq(users.accountId, accountId), eq(users.email, email)),
    });

    if (existingUser) {
      throw new Error('Este e-mail já pertence a um membro desta organização.');
    }

    // 5. Generate secure token & expiration
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);

    const [newInvitation] = await this.db
      .insert(invitations)
      .values({
        accountId,
        invitedById,
        email,
        role: dto.role || 'member',
        token,
        status: 'pending',
        expiresAt,
      })
      .returning();

    return {
      invitation: newInvitation,
      inviteUrl: `/invite/${token}`,
    };
  }

  async getInvitationByToken(token: string) {
    const invitation = await this.db.query.invitations.findFirst({
      where: eq(invitations.token, token),
      with: {
        account: true,
        invitedBy: true,
      },
    });

    if (!invitation) {
      throw new Error('Convite não encontrado.');
    }

    if (invitation.status !== 'pending') {
      throw new Error(`Este convite já foi ${invitation.status === 'accepted' ? 'aceito' : 'revogado'}.`);
    }

    if (new Date() > invitation.expiresAt) {
      throw new Error('Este convite expirou.');
    }

    return invitation;
  }

  async acceptInvitation(dto: AcceptInvitationDto) {
    const invitation = await this.getInvitationByToken(dto.token);
    const account = invitation.account;

    // Verify limit one more time on acceptance
    const activeCount = await this.countActiveUsers(account.id);
    const limitCheck = validateUserLimit(account.plan as PlanType, activeCount);

    if (!limitCheck.allowed) {
      throw new Error(limitCheck.error || 'Limite de usuários da organização atingido.');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    // Create user
    const [newUser] = await this.db
      .insert(users)
      .values({
        accountId: invitation.accountId,
        name: dto.name.trim(),
        email: invitation.email,
        passwordHash,
        role: invitation.role,
        status: 'active',
      })
      .returning();

    // Mark invitation as accepted
    await this.db
      .update(invitations)
      .set({ status: 'accepted' })
      .where(eq(invitations.id, invitation.id));

    const { passwordHash: _, ...sanitizedUser } = newUser;

    return {
      user: sanitizedUser,
      rawUser: newUser,
      account,
    };
  }

  async listInvitations(accountId: string) {
    return this.db.query.invitations.findMany({
      where: eq(invitations.accountId, accountId),
      orderBy: (invitations, { desc }) => [desc(invitations.createdAt)],
    });
  }

  async revokeInvitation(accountId: string, invitationId: string, callerRole: string) {
    if (callerRole !== 'owner' && callerRole !== 'admin') {
      throw new Error('Apenas Administradores e o Proprietário podem revogar convites.');
    }

    await this.db
      .update(invitations)
      .set({ status: 'revoked' })
      .where(and(eq(invitations.id, invitationId), eq(invitations.accountId, accountId)));

    return { success: true };
  }
}
