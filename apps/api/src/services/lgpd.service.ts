import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { Server } from 'socket.io';
import { db as defaultDb } from '../db/index';
import {
  users,
  accounts,
  messages,
  conversationMembers,
  messageReceipts,
  refreshTokens,
} from '../db/schema/index';
import {
  LgpdPrivacyPolicyResponse,
  LgpdExportDataResponse,
  LgpdDeleteAccountDto,
  LgpdDeleteAccountResponse,
} from '@corpchat/shared';

export class LgpdService {
  constructor(
    private db = defaultDb,
    private io?: Server
  ) {}

  setIoServer(io: Server) {
    this.io = io;
  }

  /**
   * Returns information about the organization's privacy policy and LGPD rights.
   */
  getPrivacyPolicy(): LgpdPrivacyPolicyResponse {
    return {
      version: '2026.1',
      lastUpdated: '2026-01-15T00:00:00.000Z',
      dpoContact: 'dpo@nextmsg.com.br',
      rights: [
        'Confirmação da existência de tratamento (Art. 18, I da LGPD)',
        'Acesso aos dados pessoais (Art. 18, II da LGPD)',
        'Correção de dados incompletos, inexatos ou desatualizados (Art. 18, III da LGPD)',
        'Anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos (Art. 18, IV da LGPD)',
        'Portabilidade dos dados a outro fornecedor de serviço ou produto (Art. 18, V da LGPD)',
        'Eliminação dos dados pessoais tratados com o consentimento do titular (Art. 18, VI da LGPD)',
        'Informação das entidades públicas e privadas com as quais o controlador realizou uso compartilhado de dados (Art. 18, VII da LGPD)',
        'Informação sobre a possibilidade de não fornecer consentimento e sobre as consequências da negativa (Art. 18, VIII da LGPD)',
        'Revogação do consentimento (Art. 18, IX da LGPD)',
      ],
      retentionPolicies: {
        free: 'Zero retenção de arquivos em disco (streaming em memória somente para destinatários online). Mensagens de texto com isolamento por tenant.',
        pro: 'Arquivos com retenção temporária máxima de 5 dias em bucket seguro criptografado com exclusão automática após download por todos os participantes.',
        enterprise: 'Retenção corporativa configurável, evidências auditáveis SHA-256 e conformidade integral com Lei nº 14.063/2020 e LGPD.',
      },
      legalBases: [
        'Execução de contrato de prestação de serviços de mensageria corporativa (Art. 7º, V da LGPD)',
        'Cumprimento de obrigação legal ou regulatória pelo controlador (Art. 7º, II da LGPD)',
        'Exercício regular de direitos em processo judicial, administrativo ou arbitral (Art. 7º, VI da LGPD)',
        'Legítimo interesse do controlador ou de terceiros para garantia de segurança e prevenção à fraude (Art. 7º, IX da LGPD)',
      ],
    };
  }

  /**
   * Exports all personal and transaction data of a user in structured JSON (LGPD Art. 18, V).
   */
  async exportUserData(accountId: string, userId: string): Promise<LgpdExportDataResponse> {
    const user = await this.db.query.users.findFirst({
      where: and(eq(users.id, userId), eq(users.accountId, accountId)),
    });

    if (!user) {
      throw new Error('Usuário não encontrado.');
    }

    const account = await this.db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });

    if (!account) {
      throw new Error('Conta corporativa não encontrada.');
    }

    // Fetch user's sent messages
    const sentMessagesList = await this.db.query.messages.findMany({
      where: eq(messages.senderId, userId),
    });

    // Fetch user's conversation memberships
    const membershipsList = await this.db.query.conversationMembers.findMany({
      where: eq(conversationMembers.userId, userId),
    });

    // Fetch user's read receipts
    const receiptsList = await this.db.query.messageReceipts.findMany({
      where: eq(messageReceipts.userId, userId),
    });

    return {
      generatedAt: new Date().toISOString(),
      user: {
        id: user.id,
        accountId: user.accountId,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt.toISOString(),
        lastSeenAt: user.lastSeenAt ? user.lastSeenAt.toISOString() : null,
      },
      account: {
        id: account.id,
        name: account.name,
        plan: account.plan,
        status: account.status,
        createdAt: account.createdAt.toISOString(),
      },
      sentMessages: sentMessagesList.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        content: m.content,
        type: m.type,
        metadata: m.metadata,
        createdAt: m.createdAt.toISOString(),
      })),
      conversationMemberships: membershipsList.map((cm) => ({
        conversationId: cm.conversationId,
        role: cm.role,
        joinedAt: cm.joinedAt.toISOString(),
      })),
      receipts: receiptsList.map((r) => ({
        messageId: r.messageId,
        deliveredAt: r.deliveredAt ? r.deliveredAt.toISOString() : null,
        readAt: r.readAt ? r.readAt.toISOString() : null,
      })),
      privacyPolicyAccepted: {
        version: '2026.1',
        acceptedAt: user.createdAt.toISOString(),
        termsUrl: 'https://nextmsg.com.br/termos-privacidade',
      },
    };
  }

  /**
   * Anonymizes and deletes personal data of the user (LGPD Art. 18, VI - Direito ao Esquecimento).
   */
  async deleteAndAnonymizeUser(
    accountId: string,
    userId: string,
    dto: LgpdDeleteAccountDto
  ): Promise<LgpdDeleteAccountResponse> {
    const user = await this.db.query.users.findFirst({
      where: and(eq(users.id, userId), eq(users.accountId, accountId)),
    });

    if (!user) {
      throw new Error('Usuário não encontrado.');
    }

    if (user.status === 'deleted' || user.status === 'inactive' && user.email.includes('@deleted.local')) {
      throw new Error('Este usuário já foi excluído e anonimizado anteriormente.');
    }

    // 1. Password confirmation check
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Senha incorreta. A confirmação de senha é obrigatória para exclusão.');
    }

    // 2. Sole owner protection check
    if (user.role === 'owner') {
      const allOwners = await this.db.query.users.findMany({
        where: and(
          eq(users.accountId, accountId),
          eq(users.role, 'owner'),
          eq(users.status, 'active')
        ),
      });

      if (allOwners.length <= 1) {
        throw new Error(
          'Não é possível excluir a conta do único Proprietário. Transfira a propriedade da organização ou cancele a conta corporativa antes de prosseguir.'
        );
      }
    }

    // 3. Anonymize user details in database
    const anonymizedEmail = `anon_${user.id}@deleted.local`;
    const now = new Date();

    await this.db
      .update(users)
      .set({
        name: 'Usuário Removido',
        email: anonymizedEmail,
        passwordHash: '',
        avatarUrl: null,
        status: 'inactive',
        updatedAt: now,
      })
      .where(and(eq(users.id, userId), eq(users.accountId, accountId)));

    // 4. Invalidate all active sessions & refresh tokens
    await this.db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));

    // 5. Emit socket event to disconnect user if connected
    if (this.io) {
      this.io.to(`user:${userId}`).emit('auth:revoked', {
        reason: 'account_deleted_lgpd',
        message: 'Sua conta foi excluída com sucesso conforme a LGPD.',
      });

      const sockets = await this.io.in(`user:${userId}`).fetchSockets();
      for (const socket of sockets) {
        socket.disconnect(true);
      }
    }

    return {
      success: true,
      message: 'Dados pessoais anonimizados e conta excluída com sucesso conforme a LGPD.',
      anonymizedAt: now.toISOString(),
    };
  }
}
