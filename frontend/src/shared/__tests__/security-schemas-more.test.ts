import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitizeMessageContent, isSafeUrl, maskSensitiveData } from '../security';
import { parseCloudLink, isCloudStorageUrl, detectUrls, extractCloudLinks } from '../cloud-links';
import {
  validateFileAttachment,
  getQuotaStatus,
  getPlanLimits,
  can,
  validateUserLimit,
  isOverQuota,
} from '../plans';
import {
  RegisterAccountDtoSchema,
  LoginDtoSchema,
  SendTextMessageDtoSchema,
  MarkMessagesReadDtoSchema,
  TypingEventDtoSchema,
  CreateInvitationDtoSchema,
  AcceptInvitationDtoSchema,
  CreateDirectConversationDtoSchema,
  CreateGroupConversationDtoSchema,
  AddMembersDtoSchema,
  SendBroadcastDtoSchema,
  CreatePollDtoSchema,
  VotePollDtoSchema,
  ChangePlanDtoSchema,
  CreateSignatureRequestDtoSchema,
  LgpdDeleteAccountDtoSchema,
  UserRoleSchema,
  PlanTypeSchema,
  AccountStatusSchema,
  MessageTypeSchema,
  ConversationTypeSchema,
  FileRelayInitDtoSchema,
  FileRelayChunkDtoSchema,
  FileRelayCompleteDtoSchema,
  CreateSubscriptionDtoSchema,
  UpdateMemberStatusDtoSchema,
  UpdateMemberRoleDtoSchema,
  VerifySignatureHashDtoSchema,
} from '../schemas/index';

describe('Security & Sanitization Utilities (T-35)', () => {
  it('sanitizes malicious script tags and inline events', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
    expect(sanitizeText('Texto normal')).toBe('Texto normal');
    expect(sanitizeText('<script>alert("hack")</script>Olá')).toBe('Olá');
    expect(sanitizeText('<iframe src="malicious.com"></iframe>Texto')).toBe('Texto');
    expect(sanitizeText('<b onclick="alert(1)">Clique</b>')).toBe('<b>Clique</b>');
    expect(sanitizeText('<style>body{color:red}</style>Estilo')).toBe('Estilo');
    expect(sanitizeText('<img src="x" onerror="evil()"/>Foto')).toBe('<img src="x"/>Foto');
  });

  it('sanitizes message content via sanitizeMessageContent', () => {
    expect(sanitizeMessageContent(null)).toBe('');
    expect(sanitizeMessageContent('Mensagem segura')).toBe('Mensagem segura');
    expect(sanitizeMessageContent('<script>xss()</script>Conteúdo')).toBe('Conteúdo');
  });

  it('validates safe and unsafe URLs accurately', () => {
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
    expect(isSafeUrl('')).toBe(false);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe(false);
    expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);

    expect(isSafeUrl('https://nextmsg.com')).toBe(true);
    expect(isSafeUrl('http://localhost:3000')).toBe(true);
    expect(isSafeUrl('mailto:suporte@nextmsg.com')).toBe(true);
    expect(isSafeUrl('tel:+5511999999999')).toBe(true);
    expect(isSafeUrl('/chat/conv-123')).toBe(true);
    expect(isSafeUrl('#secao-pricing')).toBe(true);
    expect(isSafeUrl('ftp://invalido.com')).toBe(false);
  });

  it('masks sensitive data properly', () => {
    expect(maskSensitiveData(null)).toBe('');
    expect(maskSensitiveData(undefined)).toBe('');
    expect(maskSensitiveData('12345')).toBe('***');
    expect(maskSensitiveData('12345678')).toBe('***');
    expect(maskSensitiveData('token-secreto-muito-longo-12345')).toBe('toke...2345');
  });
});

describe('Cloud Storage Links & Providers Expansion', () => {
  it('detects URLs in raw text', () => {
    expect(detectUrls('')).toEqual([]);
    expect(detectUrls('Veja https://example.com e http://teste.org/doc.')).toEqual([
      'https://example.com',
      'http://teste.org/doc',
    ]);
  });

  it('detects Figma and Notion links correctly', () => {
    expect(isCloudStorageUrl('https://www.figma.com/file/xyz123/ProjectDesign')).toBe(true);
    expect(isCloudStorageUrl('https://notion.so/workspace/Project-Notes-456')).toBe(true);
    expect(isCloudStorageUrl('https://empresa.notion.site/Document-789')).toBe(true);
    expect(isCloudStorageUrl('https://site-aleatorio.com')).toBe(false);

    const figmaParsed = parseCloudLink('https://figma.com/design/abc/Preview');
    expect(figmaParsed?.provider).toBe('figma');
    expect(figmaParsed?.providerName).toBe('Figma');
    expect(figmaParsed?.resourceType).toBe('design');

    const notionParsed = parseCloudLink('https://notion.so/my-docs-123');
    expect(notionParsed?.provider).toBe('notion');
    expect(notionParsed?.providerName).toBe('Notion');
    expect(notionParsed?.resourceType).toBe('page');

    const boxParsed = parseCloudLink('https://app.box.com/s/samplebox123');
    expect(boxParsed?.provider).toBe('box');
    expect(boxParsed?.providerName).toBe('Box');

    const dropboxFolder = parseCloudLink('https://dropbox.com/sh/abc123folder');
    expect(dropboxFolder?.provider).toBe('dropbox');
    expect(dropboxFolder?.resourceType).toBe('folder');

    const dropboxExcel = parseCloudLink('https://dropbox.com/s/abc/planilha.xlsx');
    expect(dropboxExcel?.resourceType).toBe('spreadsheet');
    const dropboxDoc = parseCloudLink('https://dropbox.com/s/abc/relatorio.docx');
    expect(dropboxDoc?.resourceType).toBe('document');
    const dropboxPpt = parseCloudLink('https://dropbox.com/s/abc/apresentacao.pptx');
    expect(dropboxPpt?.resourceType).toBe('presentation');
    const dropboxPdf = parseCloudLink('https://dropbox.com/s/abc/manual.pdf');
    expect(dropboxPdf?.resourceType).toBe('pdf');
    const dropboxZip = parseCloudLink('https://dropbox.com/s/abc/backup.zip');
    expect(dropboxZip?.resourceType).toBe('archive');
    const dropboxImg = parseCloudLink('https://dropbox.com/s/abc/foto.png');
    expect(dropboxImg?.resourceType).toBe('image');

    const spExcel = parseCloudLink('https://empresa.sharepoint.com/:x:/r/pasta/doc');
    expect(spExcel?.resourceType).toBe('spreadsheet');
    const spDoc = parseCloudLink('https://empresa.sharepoint.com/:w:/r/pasta/doc');
    expect(spDoc?.resourceType).toBe('document');
    const spPpt = parseCloudLink('https://empresa.sharepoint.com/:p:/r/pasta/doc');
    expect(spPpt?.resourceType).toBe('presentation');
    const spFolder = parseCloudLink('https://empresa.sharepoint.com/:f:/r/pasta/doc');
    expect(spFolder?.resourceType).toBe('folder');
    const spFile = parseCloudLink('https://empresa.sharepoint.com/:b:/r/pasta/doc');
    expect(spFile?.resourceType).toBe('file');

    const oneDriveShort = parseCloudLink('https://1drv.ms/u/s!123');
    expect(oneDriveShort?.provider).toBe('onedrive');

    expect(parseCloudLink('invalid-url')).toBeNull();

    const textWithUrls = 'Links: https://drive.google.com/file/d/123 e https://custom.com/doc';
    const cloudOnly = extractCloudLinks(textWithUrls, true);
    expect(cloudOnly).toHaveLength(1);
    const allExtracted = extractCloudLinks(textWithUrls, false);
    expect(allExtracted).toHaveLength(2);
  });
});

describe('Plans & Quota Limits Coverage Expansion', () => {
  it('validates empty files list as valid', () => {
    const result = validateFileAttachment('free', []);
    expect(result.valid).toBe(true);
  });

  it('validates file attachment sizes and counts per plan', () => {
    const overFileSize = validateFileAttachment('free', [
      { size: 10 * 1024 * 1024, name: 'video.mp4' },
    ]);
    expect(overFileSize.valid).toBe(false);
    expect(overFileSize.error).toContain('excede o limite');

    const overFileCount = validateFileAttachment('free', [
      { size: 1024, name: 'a.txt' },
      { size: 1024, name: 'b.txt' },
    ]);
    expect(overFileCount.valid).toBe(false);
    expect(overFileCount.error).toContain('permite no máximo 1 arquivo');

    const overTotalSize = validateFileAttachment('pro', [
      { size: 24 * 1024 * 1024 },
      { size: 24 * 1024 * 1024 },
      { size: 24 * 1024 * 1024 },
      { size: 24 * 1024 * 1024 },
      { size: 24 * 1024 * 1024 },
      { size: 24 * 1024 * 1024 },
    ]);
    expect(overTotalSize.valid).toBe(false);
  });

  it('checks features and plan defaults with fallback', () => {
    expect(can('invalid' as any, 'polls')).toBe(false);
    expect(can('free', 'offline_file_transfer')).toBe(false);
    expect(can('pro', 'offline_file_transfer')).toBe(true);
    expect(can('enterprise', 'electronic_signature')).toBe(true);

    const fallbackLimits = getPlanLimits('invalid' as any);
    expect(fallbackLimits.name).toBe('Free');

    expect(validateUserLimit('enterprise', 99999).allowed).toBe(true);
    expect(validateUserLimit('free', 12).allowed).toBe(false);

    expect(isOverQuota('free', 13)).toBe(true);
    expect(isOverQuota('free', 10)).toBe(false);
  });

  it('calculates quota status correctly for under and over quota', () => {
    const under = getQuotaStatus('free', 10);
    expect(under.isOverQuota).toBe(false);
    expect(under.excessUsersCount).toBe(0);
    expect(under.error).toBeUndefined();

    const over = getQuotaStatus('free', 15);
    expect(over.isOverQuota).toBe(true);
    expect(over.excessUsersCount).toBe(3);
    expect(over.error).toContain('Sua conta atingiu o limite de usuários do plano Free');
  });
});

describe('Domain Schemas & DTO Validation', () => {
  it('validates enum schemas', () => {
    expect(UserRoleSchema.parse('owner')).toBe('owner');
    expect(UserRoleSchema.parse('admin')).toBe('admin');
    expect(UserRoleSchema.parse('member')).toBe('member');
    expect(() => UserRoleSchema.parse('invalid')).toThrow();

    expect(PlanTypeSchema.parse('free')).toBe('free');
    expect(PlanTypeSchema.parse('pro')).toBe('pro');
    expect(PlanTypeSchema.parse('enterprise')).toBe('enterprise');

    expect(AccountStatusSchema.parse('active')).toBe('active');
    expect(ConversationTypeSchema.parse('broadcast')).toBe('broadcast');
    expect(MessageTypeSchema.parse('signature')).toBe('signature');
  });

  it('validates Auth DTOs', () => {
    const validRegister = {
      accountName: 'TechCorp',
      userName: 'Carlos Silva',
      email: 'carlos@techcorp.com',
      password: 'password123',
    };
    expect(RegisterAccountDtoSchema.parse(validRegister)).toEqual(validRegister);
    expect(() => RegisterAccountDtoSchema.parse({ ...validRegister, email: 'invalido' })).toThrow();
    expect(() => RegisterAccountDtoSchema.parse({ ...validRegister, password: '123' })).toThrow();

    const validLogin = { email: 'user@empresa.com', password: 'secretpassword' };
    expect(LoginDtoSchema.parse(validLogin)).toEqual(validLogin);
    expect(() => LoginDtoSchema.parse({ email: 'bad', password: '' })).toThrow();
  });

  it('validates Message & Conversation DTOs', () => {
    const uuid = 'a0000000-0000-0000-0000-000000000001';
    expect(SendTextMessageDtoSchema.parse({ conversationId: uuid, content: 'Olá' })).toBeDefined();
    expect(() => SendTextMessageDtoSchema.parse({ conversationId: 'bad', content: '' })).toThrow();

    expect(
      MarkMessagesReadDtoSchema.parse({ conversationId: uuid, messageIds: [uuid] })
    ).toBeDefined();
    expect(TypingEventDtoSchema.parse({ conversationId: uuid, isTyping: true })).toBeDefined();

    expect(CreateDirectConversationDtoSchema.parse({ targetUserId: uuid })).toBeDefined();
    expect(
      CreateGroupConversationDtoSchema.parse({ title: 'Squad Frontend', memberUserIds: [uuid] })
    ).toBeDefined();
    expect(AddMembersDtoSchema.parse({ userIds: [uuid] })).toBeDefined();
  });

  it('validates Broadcast, Poll, Billing, Signature, LGPD and Relay DTOs', () => {
    const uuid = 'a0000000-0000-0000-0000-000000000001';
    expect(
      SendBroadcastDtoSchema.parse({
        title: 'Aviso Geral',
        content: 'Todos devem comparecer',
      })
    ).toBeDefined();

    expect(
      CreatePollDtoSchema.parse({
        conversationId: uuid,
        question: 'Aprovado?',
        options: ['Sim', 'Não'],
      })
    ).toBeDefined();
    expect(VotePollDtoSchema.parse({ optionIds: [uuid] })).toBeDefined();

    expect(ChangePlanDtoSchema.parse({ plan: 'pro' })).toBeDefined();
    expect(
      CreateSignatureRequestDtoSchema.parse({
        conversationId: uuid,
        title: 'Contrato de Trabalho',
        documentName: 'contrato.pdf',
        contentBase64: 'JVBERi0xLjQK...',
        signers: [{ name: 'Ana Silva', email: 'ana@empresa.com', signAs: 'sign' }],
      })
    ).toBeDefined();

    expect(
      LgpdDeleteAccountDtoSchema.parse({
        password: 'senhaSegura123',
        confirmationText: 'EXCLUIR',
      })
    ).toBeDefined();
    expect(CreateInvitationDtoSchema.parse({ email: 'novo@empresa.com' })).toBeDefined();
    expect(
      AcceptInvitationDtoSchema.parse({
        token: 'tok-123',
        name: 'Novo Membro',
        password: 'senhaSegura123',
      })
    ).toBeDefined();

    expect(
      FileRelayInitDtoSchema.parse({
        transferId: uuid,
        conversationId: uuid,
        fileName: 'relatorio.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        totalChunks: 2,
      })
    ).toBeDefined();

    expect(
      FileRelayChunkDtoSchema.parse({
        transferId: uuid,
        chunkIndex: 0,
        data: 'base64data',
      })
    ).toBeDefined();

    expect(
      FileRelayCompleteDtoSchema.parse({
        transferId: uuid,
      })
    ).toBeDefined();
  });

  it('validates Subscription, Member and Signature Verification errorMaps and refinements', () => {
    const invalidPlan = CreateSubscriptionDtoSchema.safeParse({
      plan: 'invalid' as any,
      paymentMethod: 'pix',
      customer: { name: 'Empresa', email: 'contato@empresa.com', document: '123' },
    });
    expect(invalidPlan.success).toBe(false);
    if (!invalidPlan.success) {
      expect(invalidPlan.error.issues[0]?.message).toBe('Plano inválido para assinatura');
    }

    const invalidPayment = CreateSubscriptionDtoSchema.safeParse({
      plan: 'pro',
      paymentMethod: 'invalid' as any,
      customer: { name: 'Empresa', email: 'contato@empresa.com', document: '123' },
    });
    expect(invalidPayment.success).toBe(false);
    if (!invalidPayment.success) {
      expect(invalidPayment.error.issues[0]?.message).toBe('Forma de pagamento inválida');
    }

    const invalidStatus = UpdateMemberStatusDtoSchema.safeParse({ status: 'blocked' as any });
    expect(invalidStatus.success).toBe(false);
    if (!invalidStatus.success) {
      expect(invalidStatus.error.issues[0]?.message).toBe('Status deve ser active ou inactive');
    }
    expect(UpdateMemberStatusDtoSchema.parse({ status: 'active' })).toEqual({ status: 'active' });

    const invalidRole = UpdateMemberRoleDtoSchema.safeParse({ role: 'superadmin' as any });
    expect(invalidRole.success).toBe(false);
    if (!invalidRole.success) {
      expect(invalidRole.error.issues[0]?.message).toBe('Papel deve ser admin ou member');
    }
    expect(UpdateMemberRoleDtoSchema.parse({ role: 'admin' })).toEqual({ role: 'admin' });

    expect(VerifySignatureHashDtoSchema.parse({ sha256: 'a1b2c3d4' })).toBeDefined();
    expect(VerifySignatureHashDtoSchema.parse({ contentBase64: 'base64str' })).toBeDefined();
    const emptyVerify = VerifySignatureHashDtoSchema.safeParse({});
    expect(emptyVerify.success).toBe(false);

    expect(
      LgpdDeleteAccountDtoSchema.parse({
        password: 'senha',
        confirmationText: 'DELETAR',
      })
    ).toBeDefined();
    const badDelete = LgpdDeleteAccountDtoSchema.safeParse({
      password: 'senha',
      confirmationText: 'CANCELAR',
    });
    expect(badDelete.success).toBe(false);
  });
});
