import { Server } from 'socket.io';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  accounts,
  conversationMembers,
  messages,
  users,
  signatureRequests,
  signatureSigners,
  signatureEvidence,
} from '../db/schema';
import {
  can,
  CreateSignatureRequestDto,
  SignatureRequestResponse,
  SignatureSignerItemResponse,
  SignatureEvidenceReport,
  SimulateSignerDto,
} from '@corpchat/shared';
import { ClicksignProviderService } from './clicksign.service';

export class SignatureService {
  private io?: Server;
  private clicksignService: ClicksignProviderService;

  constructor(clicksignService?: ClicksignProviderService) {
    this.clicksignService = clicksignService || new ClicksignProviderService();
  }

  setIoServer(io: Server) {
    this.io = io;
  }

  /**
   * 1. Create a signature request in a conversation (Enterprise only)
   */
  async createSignatureRequest(
    accountId: string,
    creatorId: string,
    dto: CreateSignatureRequestDto
  ): Promise<SignatureRequestResponse> {
    // 1. Fetch account and validate plan permissions
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!account) {
      throw new Error('Conta não encontrada.');
    }

    if (!can(account.plan as any, 'electronic_signature')) {
      throw new Error('O envio de documentos para assinatura eletrônica é um recurso exclusivo do plano Enterprise.');
    }

    if (account.status === 'over_quota') {
      throw new Error('Sua organização está com o limite de membros excedido. Faça upgrade ou desative usuários excedentes para utilizar a assinatura eletrônica.');
    }

    if (account.status === 'suspended') {
      throw new Error('Conta suspensa por inadimplência. Regularize os pagamentos para continuar.');
    }

    // 2. Validate conversation membership
    const [membership] = await db
      .select()
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, dto.conversationId),
          eq(conversationMembers.userId, creatorId)
        )
      )
      .limit(1);

    if (!membership) {
      throw new Error('Você não tem permissão para enviar documentos nesta conversa.');
    }

    // 3. Create document in Clicksign
    const clicksignDoc = await this.clicksignService.createDocument({
      documentName: dto.documentName,
      contentBase64: dto.contentBase64,
      deadlineAt: dto.deadlineAt,
      autoClose: dto.autoClose ?? true,
    });

    // 4. Enroll signers and add them to document
    const enrolledSigners: Array<{
      userId?: string;
      externalSignerKey: string;
      requestSignatureKey: string;
      name: string;
      email: string;
      documentation?: string;
      phoneNumber?: string;
      authType: any;
      signAs: any;
      groupOrder: number;
      signUrl: string;
    }> = [];

    for (const signerInput of dto.signers) {
      const clicksignSigner = await this.clicksignService.createSigner({
        name: signerInput.name,
        email: signerInput.email,
        documentation: signerInput.documentation,
        phoneNumber: signerInput.phoneNumber,
        authType: signerInput.authType || 'email',
      });

      const listItem = await this.clicksignService.addSignerToDocument({
        documentKey: clicksignDoc.key,
        signerKey: clicksignSigner.key,
        signAs: signerInput.signAs || 'sign',
        groupOrder: signerInput.groupOrder || 1,
        message: signerInput.message,
      });

      enrolledSigners.push({
        userId: signerInput.userId,
        externalSignerKey: clicksignSigner.key,
        requestSignatureKey: listItem.requestSignatureKey,
        name: signerInput.name,
        email: signerInput.email,
        documentation: signerInput.documentation,
        phoneNumber: signerInput.phoneNumber,
        authType: signerInput.authType || 'email',
        signAs: signerInput.signAs || 'sign',
        groupOrder: signerInput.groupOrder || 1,
        signUrl: listItem.url,
      });
    }

    // 5. Database transaction: create signature request, message, signers and initial evidence
    const result = await db.transaction(async (tx) => {
      // Create chat message
      const [msg] = await tx
        .insert(messages)
        .values({
          conversationId: dto.conversationId,
          senderId: creatorId,
          type: 'signature',
          content: JSON.stringify({
            title: dto.title,
            documentName: dto.documentName,
            externalDocumentKey: clicksignDoc.key,
            signersCount: enrolledSigners.length,
            signedCount: 0,
            status: 'running',
          }),
        })
        .returning();

      // Create signature request
      const [sigReq] = await tx
        .insert(signatureRequests)
        .values({
          accountId,
          conversationId: dto.conversationId,
          messageId: msg.id,
          creatorId,
          title: dto.title,
          documentName: dto.documentName,
          provider: 'clicksign',
          externalDocumentKey: clicksignDoc.key,
          originalSha256: clicksignDoc.originalHash,
          status: 'running',
          deadlineAt: dto.deadlineAt ? new Date(dto.deadlineAt) : undefined,
          autoClose: dto.autoClose ?? true,
        })
        .returning();

      // Insert signers
      const insertedSigners: SignatureSignerItemResponse[] = [];
      for (const s of enrolledSigners) {
        const [signerRow] = await tx
          .insert(signatureSigners)
          .values({
            signatureRequestId: sigReq.id,
            userId: s.userId,
            externalSignerKey: s.externalSignerKey,
            requestSignatureKey: s.requestSignatureKey,
            name: s.name,
            email: s.email,
            documentation: s.documentation,
            phoneNumber: s.phoneNumber,
            authType: s.authType,
            signAs: s.signAs,
            groupOrder: s.groupOrder,
            signUrl: s.signUrl,
            status: 'pending',
          })
          .returning();

        insertedSigners.push({
          id: signerRow.id,
          signatureRequestId: signerRow.signatureRequestId,
          userId: signerRow.userId,
          name: signerRow.name,
          email: signerRow.email,
          documentation: signerRow.documentation,
          phoneNumber: signerRow.phoneNumber,
          authType: signerRow.authType as any,
          signAs: signerRow.signAs as any,
          groupOrder: signerRow.groupOrder,
          signUrl: signerRow.signUrl,
          status: signerRow.status as any,
          signedAt: signerRow.signedAt?.toISOString(),
          createdAt: signerRow.createdAt.toISOString(),
        });
      }

      // Insert initial audit evidence
      await tx.insert(signatureEvidence).values({
        signatureRequestId: sigReq.id,
        eventType: 'document_created',
        ipAddress: '127.0.0.1',
        userAgent: 'Corporate Messenger Server',
        token: 'initial_hash_verification',
        details: {
          originalSha256: clicksignDoc.originalHash,
          signersCount: enrolledSigners.length,
        },
      });

      return {
        signatureRequest: sigReq,
        message: msg,
        signers: insertedSigners,
      };
    });

    // Fetch creator details
    const [creatorUser] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, creatorId))
      .limit(1);

    const response: SignatureRequestResponse = {
      id: result.signatureRequest.id,
      accountId: result.signatureRequest.accountId,
      conversationId: result.signatureRequest.conversationId,
      messageId: result.message.id,
      creatorId: result.signatureRequest.creatorId,
      creator: creatorUser,
      title: result.signatureRequest.title,
      documentName: result.signatureRequest.documentName,
      provider: result.signatureRequest.provider as any,
      externalDocumentKey: result.signatureRequest.externalDocumentKey,
      originalSha256: result.signatureRequest.originalSha256,
      signedSha256: result.signatureRequest.signedSha256,
      status: result.signatureRequest.status as any,
      deadlineAt: result.signatureRequest.deadlineAt?.toISOString(),
      autoClose: result.signatureRequest.autoClose,
      closedAt: result.signatureRequest.closedAt?.toISOString(),
      signersCount: result.signers.length,
      signedCount: 0,
      signers: result.signers,
      createdAt: result.signatureRequest.createdAt.toISOString(),
      updatedAt: result.signatureRequest.updatedAt.toISOString(),
    };

    // Emit Realtime WebSocket event to conversation room
    if (this.io) {
      this.io.to(`conversation:${dto.conversationId}`).emit('signature:created', response);
      this.io.to(`conversation:${dto.conversationId}`).emit('message:created', {
        ...result.message,
        createdAt: result.message.createdAt.toISOString(),
      });
    }

    return response;
  }

  /**
   * 2. Get signature request by ID
   */
  async getSignatureRequest(
    accountId: string,
    signatureRequestId: string
  ): Promise<SignatureRequestResponse> {
    const [sigReq] = await db
      .select()
      .from(signatureRequests)
      .where(
        and(
          eq(signatureRequests.id, signatureRequestId),
          eq(signatureRequests.accountId, accountId)
        )
      )
      .limit(1);

    if (!sigReq) {
      throw new Error('Solicitação de assinatura não encontrada.');
    }

    const signersList = await db
      .select()
      .from(signatureSigners)
      .where(eq(signatureSigners.signatureRequestId, sigReq.id));

    const [creatorUser] = sigReq.creatorId
      ? await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, sigReq.creatorId))
          .limit(1)
      : [undefined];

    const signedCount = signersList.filter((s) => s.status === 'signed').length;

    return {
      id: sigReq.id,
      accountId: sigReq.accountId,
      conversationId: sigReq.conversationId,
      messageId: sigReq.messageId,
      creatorId: sigReq.creatorId,
      creator: creatorUser,
      title: sigReq.title,
      documentName: sigReq.documentName,
      provider: sigReq.provider as any,
      externalDocumentKey: sigReq.externalDocumentKey,
      originalSha256: sigReq.originalSha256,
      signedSha256: sigReq.signedSha256,
      status: sigReq.status as any,
      deadlineAt: sigReq.deadlineAt?.toISOString(),
      autoClose: sigReq.autoClose,
      closedAt: sigReq.closedAt?.toISOString(),
      signersCount: signersList.length,
      signedCount,
      signers: signersList.map((s) => ({
        id: s.id,
        signatureRequestId: s.signatureRequestId,
        userId: s.userId,
        name: s.name,
        email: s.email,
        documentation: s.documentation,
        phoneNumber: s.phoneNumber,
        authType: s.authType as any,
        signAs: s.signAs as any,
        groupOrder: s.groupOrder,
        signUrl: s.signUrl,
        status: s.status as any,
        signedAt: s.signedAt?.toISOString(),
        createdAt: s.createdAt.toISOString(),
      })),
      createdAt: sigReq.createdAt.toISOString(),
      updatedAt: sigReq.updatedAt.toISOString(),
    };
  }

  /**
   * 3. List signature requests in a conversation
   */
  async listSignatureRequestsByConversation(
    accountId: string,
    conversationId: string
  ): Promise<SignatureRequestResponse[]> {
    const list = await db
      .select()
      .from(signatureRequests)
      .where(
        and(
          eq(signatureRequests.accountId, accountId),
          eq(signatureRequests.conversationId, conversationId)
        )
      )
      .orderBy(desc(signatureRequests.createdAt));

    const result: SignatureRequestResponse[] = [];
    for (const item of list) {
      const details = await this.getSignatureRequest(accountId, item.id);
      result.push(details);
    }

    return result;
  }

  /**
   * 4. Simulate a signature in Sandbox (T-31 / T-32)
   */
  async simulateSign(
    accountId: string,
    signatureRequestId: string,
    signerId: string,
    dto: SimulateSignerDto
  ): Promise<SignatureRequestResponse> {
    const [sigReq] = await db
      .select()
      .from(signatureRequests)
      .where(
        and(
          eq(signatureRequests.id, signatureRequestId),
          eq(signatureRequests.accountId, accountId)
        )
      )
      .limit(1);

    if (!sigReq) {
      throw new Error('Solicitação de assinatura não encontrada.');
    }

    const [signer] = await db
      .select()
      .from(signatureSigners)
      .where(
        and(
          eq(signatureSigners.id, signerId),
          eq(signatureSigners.signatureRequestId, signatureRequestId)
        )
      )
      .limit(1);

    if (!signer) {
      throw new Error('Signatário não encontrado.');
    }

    if (signer.status === 'signed') {
      throw new Error('Este signatário já realizou a assinatura.');
    }

    // Call sandbox simulation on Clicksign
    const simResult = await this.clicksignService.simulateSignDocument({
      documentKey: sigReq.externalDocumentKey,
      requestSignatureKey: signer.requestSignatureKey,
      signerInfo: {
        name: signer.name,
        email: signer.email,
        documentation: signer.documentation || undefined,
        authType: signer.authType as any,
      },
      ipAddress: dto.ipAddress || '189.120.45.12',
      userAgent: dto.userAgent || 'Corporate Messenger Client (Simulated)',
      token: dto.token,
    });

    const now = new Date();

    // Update signer status in DB
    await db
      .update(signatureSigners)
      .set({
        status: 'signed',
        signedAt: now,
      })
      .where(eq(signatureSigners.id, signer.id));

    // Record audit evidence
    await db.insert(signatureEvidence).values({
      signatureRequestId: sigReq.id,
      signerId: signer.id,
      eventType: 'signature_executed',
      ipAddress: simResult.evidenceEvent.ipAddress,
      userAgent: simResult.evidenceEvent.userAgent,
      token: simResult.evidenceEvent.token,
      details: {
        signerName: signer.name,
        signerEmail: signer.email,
        authType: signer.authType,
        signAs: signer.signAs,
      },
      occurredAt: now,
    });

    // Check if all signers on this document are now signed
    const allSigners = await db
      .select()
      .from(signatureSigners)
      .where(eq(signatureSigners.signatureRequestId, sigReq.id));

    const allSigned = allSigners.every((s) => s.id === signer.id || s.status === 'signed');

    if (allSigned) {
      await db
        .update(signatureRequests)
        .set({
          status: 'closed',
          closedAt: now,
          signedSha256: simResult.document.signedHash,
        })
        .where(eq(signatureRequests.id, sigReq.id));

      await db.insert(signatureEvidence).values({
        signatureRequestId: sigReq.id,
        eventType: 'document_closed',
        ipAddress: '127.0.0.1',
        userAgent: 'Corporate Messenger Server',
        token: 'auto_closed_all_signers_completed',
        details: {
          signedSha256: simResult.document.signedHash,
        },
        occurredAt: now,
      });
    }

    const updated = await this.getSignatureRequest(accountId, sigReq.id);

    // Update message content if linked
    if (sigReq.messageId) {
      await db
        .update(messages)
        .set({
          content: JSON.stringify({
            title: updated.title,
            documentName: updated.documentName,
            externalDocumentKey: updated.externalDocumentKey,
            signersCount: updated.signersCount,
            signedCount: updated.signedCount,
            status: updated.status,
          }),
        })
        .where(eq(messages.id, sigReq.messageId));
    }

    // Realtime notification
    if (this.io) {
      this.io.to(`conversation:${sigReq.conversationId}`).emit('signature:updated', updated);
    }

    return updated;
  }

  /**
   * 5. Process Clicksign Webhook
   */
  async handleClicksignWebhook(rawPayload: string, signatureHeader: string): Promise<{ handled: boolean; event: string }> {
    const webhookSecret = process.env.CLICKSIGN_WEBHOOK_SECRET || 'clicksign-webhook-secret';
    const body = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
    const jsonString = typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload);

    let isValid = this.clicksignService.verifyWebhookSignature(jsonString, signatureHeader, webhookSecret);
    if (!isValid && typeof body === 'object') {
      isValid = this.clicksignService.verifyWebhookSignature(JSON.stringify(body), signatureHeader, webhookSecret);
    }

    if (!isValid && !process.env.CLICKSIGN_SKIP_WEBHOOK_VERIFY) {
      throw new Error('Assinatura de webhook Clicksign inválida.');
    }

    const eventName = body.event?.name || body.event;
    const documentKey = body.event?.data?.document?.key || body.document?.key;

    if (!documentKey) {
      return { handled: false, event: eventName || 'unknown' };
    }

    const [sigReq] = await db
      .select()
      .from(signatureRequests)
      .where(eq(signatureRequests.externalDocumentKey, documentKey))
      .limit(1);

    if (!sigReq) {
      return { handled: false, event: eventName };
    }

    const now = new Date();

    if (eventName === 'document.signed' || eventName === 'sign') {
      const requestSigKey = body.event?.data?.signature?.requestSignatureKey || body.signer?.request_signature_key;
      if (requestSigKey) {
        const [signer] = await db
          .select()
          .from(signatureSigners)
          .where(
            and(
              eq(signatureSigners.signatureRequestId, sigReq.id),
              eq(signatureSigners.requestSignatureKey, requestSigKey)
            )
          )
          .limit(1);

        if (signer && signer.status !== 'signed') {
          await db
            .update(signatureSigners)
            .set({ status: 'signed', signedAt: now })
            .where(eq(signatureSigners.id, signer.id));

          await db.insert(signatureEvidence).values({
            signatureRequestId: sigReq.id,
            signerId: signer.id,
            eventType: 'signature_executed',
            ipAddress: body.event?.data?.signature?.ip || '127.0.0.1',
            userAgent: body.event?.data?.signature?.userAgent || 'Clicksign Webhook',
            details: body,
            occurredAt: now,
          });
        }
      }
    } else if (eventName === 'document.closed' || eventName === 'close') {
      await db
        .update(signatureRequests)
        .set({ status: 'closed', closedAt: now })
        .where(eq(signatureRequests.id, sigReq.id));

      await db.insert(signatureEvidence).values({
        signatureRequestId: sigReq.id,
        eventType: 'document_closed',
        ipAddress: '127.0.0.1',
        userAgent: 'Clicksign Webhook',
        details: body,
        occurredAt: now,
      });
    } else if (eventName === 'document.canceled' || eventName === 'cancel') {
      await db
        .update(signatureRequests)
        .set({ status: 'canceled' })
        .where(eq(signatureRequests.id, sigReq.id));

      await db.insert(signatureEvidence).values({
        signatureRequestId: sigReq.id,
        eventType: 'document_canceled',
        ipAddress: '127.0.0.1',
        userAgent: 'Clicksign Webhook',
        details: body,
        occurredAt: now,
      });
    }

    const updated = await this.getSignatureRequest(sigReq.accountId, sigReq.id);

    if (this.io) {
      this.io.to(`conversation:${sigReq.conversationId}`).emit('signature:updated', updated);
    }

    return { handled: true, event: eventName };
  }

  /**
   * 6. Get Evidence Report manifest (T-33)
   */
  async getEvidenceReport(
    accountId: string,
    signatureRequestId: string
  ): Promise<SignatureEvidenceReport> {
    const sigReq = await this.getSignatureRequest(accountId, signatureRequestId);

    // Fetch evidence events from DB
    const dbEvidence = await db
      .select()
      .from(signatureEvidence)
      .where(eq(signatureEvidence.signatureRequestId, sigReq.id))
      .orderBy(signatureEvidence.occurredAt);

    let providerReport: SignatureEvidenceReport | null = null;
    try {
      providerReport = await this.clicksignService.getEvidenceReport(sigReq.externalDocumentKey);
    } catch {
      providerReport = null;
    }

    // Format events list combining DB signers and audit events
    const events = providerReport && providerReport.events.length > 0
      ? providerReport.events
      : dbEvidence.map((ev) => {
          const signerMatch = sigReq.signers.find((s) => s.id === ev.signerId);
          return {
            signerName: signerMatch?.name || (ev.details as any)?.signerName || 'Sistema',
            signerEmail: signerMatch?.email || (ev.details as any)?.signerEmail || 'system@corpchat.internal',
            documentation: signerMatch?.documentation || undefined,
            authType: (signerMatch?.authType || 'email') as any,
            ipAddress: ev.ipAddress || '127.0.0.1',
            userAgent: ev.userAgent || 'Corporate Messenger',
            signedAt: ev.occurredAt.toISOString(),
            token: ev.token || undefined,
            signatureRole: (signerMatch?.signAs || 'sign') as any,
          };
        });

    return {
      documentKey: sigReq.externalDocumentKey,
      documentName: sigReq.documentName,
      originalDocSha256: sigReq.originalSha256,
      signedDocSha256: sigReq.signedSha256 || providerReport?.signedDocSha256 || sigReq.originalSha256,
      status: sigReq.status,
      createdAt: sigReq.createdAt,
      closedAt: sigReq.closedAt,
      legalFramework: 'Medida Provisória nº 2.200-2/2001 e Lei Federal nº 14.063/2020 (Assinatura Eletrônica Simples/Avançada)',
      events,
    };
  }

  /**
   * 7. Download Signed Document PDF (T-33)
   */
  async downloadSignedDocument(
    accountId: string,
    signatureRequestId: string
  ): Promise<{
    buffer: Buffer;
    contentType: string;
    filename: string;
    sha256: string;
  }> {
    const sigReq = await this.getSignatureRequest(accountId, signatureRequestId);

    if (sigReq.status !== 'closed') {
      throw new Error('O documento ainda não foi finalizado por todos os signatários.');
    }

    return await this.clicksignService.downloadSignedDocument(sigReq.externalDocumentKey);
  }

  /**
   * 8. Generate Evidence Certificate PDF (T-33)
   */
  async generateEvidenceCertificatePdf(
    accountId: string,
    signatureRequestId: string
  ): Promise<{
    buffer: Buffer;
    contentType: string;
    filename: string;
    sha256: string;
  }> {
    const report = await this.getEvidenceReport(accountId, signatureRequestId);

    const signersSummary = report.events
      .map(
        (ev, i) =>
          `Signatário ${i + 1}: ${ev.signerName} (${ev.signerEmail}) | Papel: ${ev.signatureRole} | Auth: ${ev.authType} | IP: ${ev.ipAddress} | Data/Hora: ${ev.signedAt}`
      )
      .join('\n');

    const pdfContent = [
      '%PDF-1.4',
      '% CERTIFICADO DE EVIDÊNCIAS DE ASSINATURA ELETRÔNICA',
      `Documento: ${report.documentName}`,
      `Chave Externa: ${report.documentKey}`,
      `Hash SHA-256 Original: ${report.originalDocSha256}`,
      `Hash SHA-256 Assinado: ${report.signedDocSha256}`,
      `Status do Documento: ${report.status.toUpperCase()}`,
      `Criado em: ${report.createdAt}`,
      `Concluído em: ${report.closedAt || 'Pendente'}`,
      `Enquadramento Legal: ${report.legalFramework}`,
      '--- TRILHA DE AUDITORIA E SIGNATÁRIOS ---',
      signersSummary,
      '--- FIM DO CERTIFICADO ---',
    ].join('\n');

    const buffer = Buffer.from(pdfContent, 'utf-8');
    const sha256 = this.clicksignService.computeSha256(buffer);
    const filename = `${report.documentName.replace('.pdf', '')}_certificado_evidencias.pdf`;

    return {
      buffer,
      contentType: 'application/pdf',
      filename,
      sha256,
    };
  }

  /**
   * 9. Verify Document Hash Integrity (T-33)
   */
  async verifyDocumentHash(
    accountId: string,
    signatureRequestId: string,
    dto: { sha256?: string; contentBase64?: string }
  ) {
    const sigReq = await this.getSignatureRequest(accountId, signatureRequestId);

    let providedSha256 = dto.sha256?.toLowerCase().trim();
    if (!providedSha256 && dto.contentBase64) {
      providedSha256 = this.clicksignService.computeSha256(dto.contentBase64);
    }

    if (!providedSha256) {
      throw new Error('Informe o hash SHA-256 ou o conteúdo base64 para verificação.');
    }

    const matchesOriginal = providedSha256 === sigReq.originalSha256.toLowerCase();
    const matchesSigned = sigReq.signedSha256
      ? providedSha256 === sigReq.signedSha256.toLowerCase()
      : false;

    return {
      documentId: sigReq.id,
      documentName: sigReq.documentName,
      providedSha256,
      originalSha256: sigReq.originalSha256,
      signedSha256: sigReq.signedSha256,
      matchesOriginal,
      matchesSigned,
      isValid: matchesOriginal || matchesSigned,
      status: sigReq.status,
    };
  }
}

