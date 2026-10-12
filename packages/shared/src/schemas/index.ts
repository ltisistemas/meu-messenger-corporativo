import { z } from 'zod';

export const UserRoleSchema = z.enum(['owner', 'admin', 'member']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const PlanTypeSchema = z.enum(['free', 'pro', 'enterprise']);

export const AccountStatusSchema = z.enum(['active', 'over_quota', 'suspended']);
export type AccountStatus = z.infer<typeof AccountStatusSchema>;

export const ConversationTypeSchema = z.enum(['direct', 'group', 'broadcast']);
export type ConversationType = z.infer<typeof ConversationTypeSchema>;

export const MessageTypeSchema = z.enum([
  'text',
  'file',
  'poll',
  'link',
  'signature',
]);
export type MessageType = z.infer<typeof MessageTypeSchema>;

// Auth DTOs
export const RegisterAccountDtoSchema = z.object({
  accountName: z.string().min(2).max(100),
  userName: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});
export type RegisterAccountDto = z.infer<typeof RegisterAccountDtoSchema>;

export const LoginDtoSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof LoginDtoSchema>;

// Message DTOs
export const SendTextMessageDtoSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1).max(10000),
});
export type SendTextMessageDto = z.infer<typeof SendTextMessageDtoSchema>;

export const MarkMessagesReadDtoSchema = z.object({
  conversationId: z.string().uuid(),
  messageIds: z.array(z.string().uuid()).optional(),
});
export type MarkMessagesReadDto = z.infer<typeof MarkMessagesReadDtoSchema>;

export const TypingEventDtoSchema = z.object({
  conversationId: z.string().uuid(),
  isTyping: z.boolean(),
});
export type TypingEventDto = z.infer<typeof TypingEventDtoSchema>;

// Invitation DTOs
export const CreateInvitationDtoSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
});
export type CreateInvitationDto = z.input<typeof CreateInvitationDtoSchema>;

export const AcceptInvitationDtoSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(100),
});
export type AcceptInvitationDto = z.infer<typeof AcceptInvitationDtoSchema>;

// Conversation DTOs
export const CreateDirectConversationDtoSchema = z.object({
  targetUserId: z.string().uuid(),
});
export type CreateDirectConversationDto = z.infer<typeof CreateDirectConversationDtoSchema>;

export const CreateGroupConversationDtoSchema = z.object({
  title: z.string().min(1).max(100),
  memberUserIds: z.array(z.string().uuid()).default([]),
  isTemporary: z.boolean().default(false),
  expiresAt: z.string().datetime().optional().nullable(),
  retentionHours: z.number().int().positive().optional().nullable(),
});
export type CreateGroupConversationDto = z.input<typeof CreateGroupConversationDtoSchema>;

export const AddMembersDtoSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
});
export type AddMembersDto = z.infer<typeof AddMembersDtoSchema>;

// File Attachment DTOs
export const FileAttachmentItemSchema = z.object({
  name: z.string().min(1, 'Nome do arquivo é obrigatório').max(255),
  size: z.number().int().nonnegative('Tamanho do arquivo deve ser positivo'),
  mimeType: z.string().min(1).max(100).default('application/octet-stream'),
});
export type FileAttachmentItem = z.infer<typeof FileAttachmentItemSchema>;

export const ValidateFilesDtoSchema = z.object({
  files: z.array(FileAttachmentItemSchema).min(1, 'Pelo menos um arquivo deve ser informado'),
  isRecipientOnline: z.boolean().optional(),
  recipientName: z.string().optional(),
});
export type ValidateFilesDto = z.infer<typeof ValidateFilesDtoSchema>;

// File Streaming Relay DTOs (Free Plan in-memory WebSocket relay)
export const FileRelayInitDtoSchema = z.object({
  transferId: z.string().uuid(),
  conversationId: z.string().uuid(),
  fileName: z.string().min(1, 'Nome do arquivo é obrigatório').max(255),
  fileSize: z
    .number()
    .int()
    .positive('Tamanho do arquivo deve ser maior que zero')
    .max(5 * 1024 * 1024, 'O plano Free permite arquivos de no máximo 5 MB'),
  mimeType: z.string().min(1).max(100).default('application/octet-stream'),
  totalChunks: z.number().int().positive('Total de chunks deve ser positivo'),
  chunkSize: z.number().int().positive().max(512 * 1024).default(64 * 1024),
});
export type FileRelayInitDto = z.infer<typeof FileRelayInitDtoSchema>;

export const FileRelayChunkDtoSchema = z.object({
  transferId: z.string().uuid(),
  chunkIndex: z.number().int().nonnegative('Índice de chunk deve ser não-negativo'),
  data: z.any(),
});
export type FileRelayChunkDto = z.infer<typeof FileRelayChunkDtoSchema>;

export const FileRelayCompleteDtoSchema = z.object({
  transferId: z.string().uuid(),
});
export type FileRelayCompleteDto = z.infer<typeof FileRelayCompleteDtoSchema>;

export const FileRelayErrorDtoSchema = z.object({
  transferId: z.string().uuid(),
  reason: z.string().optional(),
});
export type FileRelayErrorDto = z.infer<typeof FileRelayErrorDtoSchema>;

// S3 / R2 Pre-signed Upload DTOs (Pro / Enterprise Plan)
export const RequestPresignedUploadDtoSchema = z.object({
  conversationId: z.string().uuid().optional(),
  fileName: z.string().min(1, 'Nome do arquivo é obrigatório').max(255),
  fileSize: z
    .number()
    .int()
    .positive('Tamanho do arquivo deve ser maior que zero')
    .max(25 * 1024 * 1024, 'O limite máximo por arquivo é de 25 MB'),
  mimeType: z.string().min(1).max(100).default('application/octet-stream'),
  totalRecipientsCount: z.number().int().positive().optional(),
});
export type RequestPresignedUploadDto = z.infer<typeof RequestPresignedUploadDtoSchema>;

export const PresignedUploadResponseSchema = z.object({
  transferId: z.string().uuid(),
  uploadUrl: z.string().url(),
  storageKey: z.string(),
  expiresAt: z.string(),
  headers: z.record(z.string()),
  maxSizeBytes: z.number(),
});
export type PresignedUploadResponse = z.infer<typeof PresignedUploadResponseSchema>;

export const ConfirmUploadDtoSchema = z.object({
  transferId: z.string().uuid(),
  messageId: z.string().uuid().optional(),
});
export type ConfirmUploadDto = z.infer<typeof ConfirmUploadDtoSchema>;

// S3 / R2 Download and Deletion DTOs (Pro / Enterprise Plan - T-20)
export const RequestDownloadUrlDtoSchema = z.object({
  transferId: z.string().uuid(),
});
export type RequestDownloadUrlDto = z.infer<typeof RequestDownloadUrlDtoSchema>;

export const DownloadUrlResponseSchema = z.object({
  transferId: z.string().uuid(),
  downloadUrl: z.string().url(),
  fileName: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
  expiresAt: z.string(),
});
export type DownloadUrlResponse = z.infer<typeof DownloadUrlResponseSchema>;

export const ConfirmDownloadDtoSchema = z.object({
  transferId: z.string().uuid(),
  completed: z.boolean().default(true),
  bytesDownloaded: z.number().nonnegative().optional(),
});
export type ConfirmDownloadDto = z.infer<typeof ConfirmDownloadDtoSchema>;

// Group File Transfers Status DTO (T-21)
export const FileTransferStatusResponseSchema = z.object({
  transferId: z.string().uuid(),
  fileName: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
  status: z.enum(['pending', 'uploaded', 'completed', 'expired', 'deleted']),
  totalRecipientsCount: z.number(),
  pendingDownloadsCount: z.number(),
  downloadedCount: z.number(),
  isAvailable: z.boolean(),
  expiresAt: z.string(),
});
export type FileTransferStatusResponse = z.infer<typeof FileTransferStatusResponseSchema>;

// Broadcast List DTOs (Pro / Enterprise Plan - T-25)
export const SendBroadcastDtoSchema = z.object({
  content: z.string().min(1, 'O conteúdo do comunicado é obrigatório').max(10000),
  title: z.string().max(100).optional(),
  attachmentUrl: z.string().url().optional(),
  attachmentName: z.string().max(255).optional(),
  attachmentSize: z.number().int().positive().optional(),
});
export type SendBroadcastDto = z.infer<typeof SendBroadcastDtoSchema>;

export const BroadcastRecipientReportItemSchema = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  avatarUrl: z.string().nullable().optional(),
  status: z.enum(['sent', 'delivered', 'read']),
  deliveredAt: z.string().nullable().optional(),
  readAt: z.string().nullable().optional(),
});
export type BroadcastRecipientReportItem = z.infer<typeof BroadcastRecipientReportItemSchema>;

export const BroadcastReportResponseSchema = z.object({
  messageId: z.string().uuid(),
  conversationId: z.string().uuid(),
  content: z.string().nullable(),
  sentAt: z.string(),
  sender: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
  }),
  summary: z.object({
    totalRecipients: z.number(),
    deliveredCount: z.number(),
    readCount: z.number(),
    pendingCount: z.number(),
    deliveryRatePercent: z.number(),
    readRatePercent: z.number(),
  }),
  recipients: z.array(BroadcastRecipientReportItemSchema),
});
export type BroadcastReportResponse = z.infer<typeof BroadcastReportResponseSchema>;

// Poll DTOs (Pro / Enterprise Plan - T-26)
export const CreatePollDtoSchema = z.object({
  conversationId: z.string().uuid(),
  question: z.string().min(1, 'Pergunta da enquete é obrigatória').max(500),
  options: z
    .array(z.string().min(1, 'Opção não pode ser vazia').max(200))
    .min(2, 'A enquete deve ter no mínimo 2 opções')
    .max(10, 'A enquete pode ter no máximo 10 opções'),
  allowMultiple: z.boolean().default(false),
  isAnonymous: z.boolean().default(false),
  expiresAt: z.string().datetime().optional().nullable(),
  expiresInHours: z.number().int().positive().optional().nullable(),
});
export type CreatePollDto = z.infer<typeof CreatePollDtoSchema>;
export type CreatePollInput = z.input<typeof CreatePollDtoSchema>;

export const VotePollDtoSchema = z.object({
  optionIds: z.array(z.string().uuid()).min(1, 'Selecione pelo menos uma opção'),
});
export type VotePollDto = z.infer<typeof VotePollDtoSchema>;

export const PollOptionResultSchema = z.object({
  id: z.string().uuid(),
  text: z.string(),
  orderIndex: z.number(),
  votesCount: z.number(),
  percentage: z.number(),
  hasVoted: z.boolean(),
  voters: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        avatarUrl: z.string().nullable().optional(),
      })
    )
    .optional(),
});
export type PollOptionResult = z.infer<typeof PollOptionResultSchema>;

export const PollDetailsResponseSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid().nullable().optional(),
  conversationId: z.string().uuid(),
  creatorId: z.string().uuid().nullable(),
  creator: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
    })
    .optional(),
  question: z.string(),
  allowMultiple: z.boolean(),
  isAnonymous: z.boolean(),
  expiresAt: z.string().nullable().optional(),
  status: z.enum(['active', 'closed']),
  isExpired: z.boolean(),
  totalVotes: z.number(),
  totalVotersCount: z.number(),
  userHasVoted: z.boolean(),
  userVotedOptionIds: z.array(z.string().uuid()),
  options: z.array(PollOptionResultSchema),
  createdAt: z.string(),
});
export type PollDetailsResponse = z.infer<typeof PollDetailsResponseSchema>;

// Billing & Subscriptions (Asaas Gateway - T-28)
export const BillingCustomerDtoSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório').max(255),
  email: z.string().email('E-mail inválido'),
  cpfCnpj: z.string().min(11, 'CPF ou CNPJ inválido').max(18),
  phone: z.string().optional(),
  postalCode: z.string().optional(),
  addressNumber: z.string().optional(),
});
export type BillingCustomerDto = z.infer<typeof BillingCustomerDtoSchema>;

export const CreditCardDtoSchema = z.object({
  holderName: z.string().min(2, 'Nome no cartão é obrigatório'),
  number: z.string().min(13, 'Número do cartão inválido').max(19),
  expiryMonth: z.string().min(1).max(2),
  expiryYear: z.string().min(2).max(4),
  ccv: z.string().min(3).max(4),
});
export type CreditCardDto = z.infer<typeof CreditCardDtoSchema>;

export const CreateSubscriptionDtoSchema = z.object({
  plan: z.enum(['pro', 'enterprise'], {
    errorMap: () => ({ message: 'Plano inválido para assinatura' }),
  }),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
  paymentMethod: z.enum(['pix', 'credit_card', 'boleto'], {
    errorMap: () => ({ message: 'Forma de pagamento inválida' }),
  }),
  customer: BillingCustomerDtoSchema,
  creditCard: CreditCardDtoSchema.optional(),
});
export type CreateSubscriptionDto = z.infer<typeof CreateSubscriptionDtoSchema>;

export const CancelSubscriptionDtoSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type CancelSubscriptionDto = z.infer<typeof CancelSubscriptionDtoSchema>;

export const SubscriptionResponseSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  gateway: z.string(),
  gatewaySubscriptionId: z.string().nullable().optional(),
  plan: z.enum(['pro', 'enterprise']),
  billingCycle: z.enum(['monthly', 'yearly']),
  paymentMethod: z.enum(['pix', 'credit_card', 'boleto']),
  status: z.enum(['active', 'pending', 'overdue', 'canceled', 'trialing']),
  amountCents: z.number(),
  currentPeriodStart: z.string(),
  currentPeriodEnd: z.string(),
  cancelAtPeriodEnd: z.boolean(),
  canceledAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SubscriptionResponse = z.infer<typeof SubscriptionResponseSchema>;

export const InvoiceResponseSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  subscriptionId: z.string().uuid().nullable().optional(),
  gatewayInvoiceId: z.string().nullable().optional(),
  amountCents: z.number(),
  status: z.enum(['pending', 'paid', 'overdue', 'refunded', 'canceled']),
  paymentMethod: z.enum(['pix', 'credit_card', 'boleto']),
  pdfUrl: z.string().nullable().optional(),
  bankSlipUrl: z.string().nullable().optional(),
  pixQrCode: z.string().nullable().optional(),
  pixCopyPaste: z.string().nullable().optional(),
  dueDate: z.string(),
  paidAt: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type InvoiceResponse = z.infer<typeof InvoiceResponseSchema>;

export const BillingSummaryResponseSchema = z.object({
  account: z.object({
    id: z.string().uuid(),
    name: z.string(),
    plan: z.string(),
    status: z.string(),
    activeUsersCount: z.number(),
    maxUsers: z.number(),
  }),
  subscription: SubscriptionResponseSchema.nullable().optional(),
  latestInvoice: InvoiceResponseSchema.nullable().optional(),
  invoices: z.array(InvoiceResponseSchema),
});
export type BillingSummaryResponse = z.infer<typeof BillingSummaryResponseSchema>;

// Account, Plan Transitions & Quota Management (T-29)
export const UpdateMemberStatusDtoSchema = z.object({
  status: z.enum(['active', 'inactive'], {
    errorMap: () => ({ message: 'Status deve ser active ou inactive' }),
  }),
});
export type UpdateMemberStatusDto = z.infer<typeof UpdateMemberStatusDtoSchema>;

export const UpdateMemberRoleDtoSchema = z.object({
  role: z.enum(['admin', 'member'], {
    errorMap: () => ({ message: 'Papel deve ser admin ou member' }),
  }),
});
export type UpdateMemberRoleDto = z.infer<typeof UpdateMemberRoleDtoSchema>;

export const MemberItemResponseSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: UserRoleSchema,
  status: z.enum(['active', 'inactive']),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});
export type MemberItemResponse = z.infer<typeof MemberItemResponseSchema>;

export const AccountDetailsResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  plan: PlanTypeSchema,
  status: AccountStatusSchema,
  trialUntil: z.string().nullable().optional(),
  isTrialing: z.boolean(),
  trialDaysRemaining: z.number().nullable().optional(),
  activeUsersCount: z.number(),
  inactiveUsersCount: z.number(),
  maxUsers: z.number(),
  isOverQuota: z.boolean(),
  excessUsersCount: z.number(),
  createdAt: z.string(),
});
export type AccountDetailsResponse = z.infer<typeof AccountDetailsResponseSchema>;

export const ChangePlanDtoSchema = z.object({
  plan: PlanTypeSchema,
});
export type ChangePlanDto = z.infer<typeof ChangePlanDtoSchema>;

// Electronic Signature DTOs & Schemas (T-31 / T-32 / T-33)
export const SignatureProviderSchema = z.enum(['clicksign', 'd4sign']);
export type SignatureProvider = z.infer<typeof SignatureProviderSchema>;

export const SignatureAuthTypeSchema = z.enum(['email', 'sms', 'whatsapp', 'icp_brasil']);
export type SignatureAuthType = z.infer<typeof SignatureAuthTypeSchema>;

export const SignatureSignAsRoleSchema = z.enum(['sign', 'approve', 'acknowledge', 'witness']);
export type SignatureSignAsRole = z.infer<typeof SignatureSignAsRoleSchema>;

export const SignatureDocumentStatusSchema = z.enum(['draft', 'running', 'closed', 'canceled']);
export type SignatureDocumentStatus = z.infer<typeof SignatureDocumentStatusSchema>;

export const SignerItemStatusSchema = z.enum(['pending', 'signed', 'rejected']);
export type SignerItemStatus = z.infer<typeof SignerItemStatusSchema>;

export const SignatureEvidenceEventSchema = z.object({
  signerName: z.string(),
  signerEmail: z.string().email(),
  documentation: z.string().optional(),
  authType: SignatureAuthTypeSchema,
  ipAddress: z.string(),
  userAgent: z.string(),
  signedAt: z.string(),
  token: z.string().optional(),
  signatureRole: SignatureSignAsRoleSchema,
});
export type SignatureEvidenceEvent = z.infer<typeof SignatureEvidenceEventSchema>;

export const SignatureEvidenceReportSchema = z.object({
  documentKey: z.string(),
  documentName: z.string(),
  originalDocSha256: z.string(),
  signedDocSha256: z.string(),
  status: SignatureDocumentStatusSchema,
  createdAt: z.string(),
  closedAt: z.string().nullable().optional(),
  legalFramework: z.string(),
  events: z.array(SignatureEvidenceEventSchema),
});
export type SignatureEvidenceReport = z.infer<typeof SignatureEvidenceReportSchema>;

export const CreateSignatureRequestDtoSchema = z.object({
  conversationId: z.string().uuid(),
  title: z.string().min(1).max(255),
  documentName: z.string().min(1).max(255),
  contentBase64: z.string().min(1),
  deadlineAt: z.string().optional(),
  autoClose: z.boolean().optional().default(true),
  signers: z.array(
    z.object({
      name: z.string().min(2).max(100),
      email: z.string().email(),
      userId: z.string().uuid().optional(),
      documentation: z.string().optional(),
      phoneNumber: z.string().optional(),
      authType: SignatureAuthTypeSchema.optional().default('email'),
      signAs: SignatureSignAsRoleSchema.optional().default('sign'),
      groupOrder: z.number().int().min(1).optional().default(1),
      message: z.string().optional(),
    })
  ).min(1),
});
export type CreateSignatureRequestDto = z.input<typeof CreateSignatureRequestDtoSchema>;

export const SignatureSignerItemResponseSchema = z.object({
  id: z.string().uuid(),
  signatureRequestId: z.string().uuid(),
  userId: z.string().uuid().nullable().optional(),
  name: z.string(),
  email: z.string().email(),
  documentation: z.string().nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  authType: SignatureAuthTypeSchema,
  signAs: SignatureSignAsRoleSchema,
  groupOrder: z.number(),
  signUrl: z.string(),
  status: SignerItemStatusSchema,
  signedAt: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type SignatureSignerItemResponse = z.infer<typeof SignatureSignerItemResponseSchema>;

export const SignatureRequestResponseSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  conversationId: z.string().uuid(),
  messageId: z.string().uuid().nullable().optional(),
  creatorId: z.string().uuid().nullable().optional(),
  creator: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
  }).nullable().optional(),
  title: z.string(),
  documentName: z.string(),
  provider: SignatureProviderSchema,
  externalDocumentKey: z.string(),
  originalSha256: z.string(),
  signedSha256: z.string().nullable().optional(),
  status: SignatureDocumentStatusSchema,
  deadlineAt: z.string().nullable().optional(),
  autoClose: z.boolean(),
  closedAt: z.string().nullable().optional(),
  signersCount: z.number(),
  signedCount: z.number(),
  signers: z.array(SignatureSignerItemResponseSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SignatureRequestResponse = z.infer<typeof SignatureRequestResponseSchema>;

export const SimulateSignerDtoSchema = z.object({
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  token: z.string().optional(),
});
export type SimulateSignerDto = z.infer<typeof SimulateSignerDtoSchema>;

export const VerifySignatureHashDtoSchema = z.object({
  sha256: z.string().optional(),
  contentBase64: z.string().optional(),
}).refine((data) => Boolean(data.sha256 || data.contentBase64), {
  message: 'Informe o hash SHA-256 ou o conteúdo base64 do documento para verificação.',
});
export type VerifySignatureHashDto = z.infer<typeof VerifySignatureHashDtoSchema>;

export const VerifySignatureHashResponseSchema = z.object({
  documentId: z.string().uuid(),
  documentName: z.string(),
  providedSha256: z.string(),
  originalSha256: z.string(),
  signedSha256: z.string().nullable().optional(),
  matchesOriginal: z.boolean(),
  matchesSigned: z.boolean(),
  isValid: z.boolean(),
  status: SignatureDocumentStatusSchema,
});
export type VerifySignatureHashResponse = z.infer<typeof VerifySignatureHashResponseSchema>;

// LGPD & Data Privacy Schemas (Lei nº 13.709/2018 - T-36)
export const LgpdPrivacyPolicyResponseSchema = z.object({
  version: z.string(),
  lastUpdated: z.string(),
  dpoContact: z.string(),
  rights: z.array(z.string()),
  retentionPolicies: z.object({
    free: z.string(),
    pro: z.string(),
    enterprise: z.string(),
  }),
  legalBases: z.array(z.string()),
});
export type LgpdPrivacyPolicyResponse = z.infer<typeof LgpdPrivacyPolicyResponseSchema>;

export const LgpdExportDataResponseSchema = z.object({
  generatedAt: z.string(),
  user: z.object({
    id: z.string().uuid(),
    accountId: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
    role: z.string(),
    status: z.string(),
    avatarUrl: z.string().nullable().optional(),
    createdAt: z.string(),
    lastSeenAt: z.string().nullable().optional(),
  }),
  account: z.object({
    id: z.string().uuid(),
    name: z.string(),
    plan: z.string(),
    status: z.string(),
    createdAt: z.string(),
  }),
  sentMessages: z.array(
    z.object({
      id: z.string().uuid(),
      conversationId: z.string().uuid(),
      content: z.string().nullable(),
      type: z.string(),
      metadata: z.any().optional(),
      createdAt: z.string(),
    })
  ),
  conversationMemberships: z.array(
    z.object({
      conversationId: z.string().uuid(),
      role: z.string(),
      joinedAt: z.string(),
    })
  ),
  receipts: z.array(
    z.object({
      messageId: z.string().uuid(),
      deliveredAt: z.string().nullable().optional(),
      readAt: z.string().nullable().optional(),
    })
  ),
  privacyPolicyAccepted: z.object({
    version: z.string(),
    acceptedAt: z.string(),
    termsUrl: z.string(),
  }),
});
export type LgpdExportDataResponse = z.infer<typeof LgpdExportDataResponseSchema>;

export const LgpdDeleteAccountDtoSchema = z.object({
  password: z.string().min(1, 'A confirmação de senha é obrigatória.'),
  confirmationText: z.string().refine((val) => val === 'EXCLUIR' || val === 'DELETAR', {
    message: 'Digite EXCLUIR para confirmar a exclusão definitiva dos seus dados.',
  }),
});
export type LgpdDeleteAccountDto = z.infer<typeof LgpdDeleteAccountDtoSchema>;

export const LgpdDeleteAccountResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  anonymizedAt: z.string(),
});
export type LgpdDeleteAccountResponse = z.infer<typeof LgpdDeleteAccountResponseSchema>;

// Observability & Health Check DTOs (T-37)
export const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  service: z.string(),
  version: z.string(),
  uptimeSeconds: z.number(),
  timestamp: z.string(),
  checks: z.object({
    database: z.object({
      status: z.enum(['up', 'down']),
      latencyMs: z.number().optional(),
      error: z.string().optional(),
    }),
    memory: z.object({
      heapUsedMb: z.number(),
      heapTotalMb: z.number(),
      rssMb: z.number(),
    }),
    websocket: z.object({
      activeConnections: z.number(),
    }),
  }),
});
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

export const MetricsResponseSchema = z.object({
  uptimeSeconds: z.number(),
  http: z.object({
    requestsTotal: z.number(),
    statusCodes: z.record(z.number()),
    averageLatencyMs: z.number(),
  }),
  realtime: z.object({
    activeWsConnections: z.number(),
    messagesSentTotal: z.number(),
    filesTransferredTotal: z.number(),
    signaturesCreatedTotal: z.number(),
  }),
  system: z.object({
    heapUsedMb: z.number(),
    heapTotalMb: z.number(),
    rssMb: z.number(),
  }),
});
export type MetricsResponse = z.infer<typeof MetricsResponseSchema>;

// Backup & Disaster Recovery DTOs (T-37)
export const BackupMetadataSchema = z.object({
  backupId: z.string().uuid(),
  createdAt: z.string(),
  schemaVersion: z.string(),
  checksumSha256: z.string(),
  tablesCount: z.number(),
  totalRowsCount: z.number(),
  tables: z.record(z.number()),
});
export type BackupMetadata = z.infer<typeof BackupMetadataSchema>;

export const BackupRestoreResponseSchema = z.object({
  success: z.boolean(),
  backupId: z.string().uuid(),
  restoredAt: z.string(),
  restoredTablesCount: z.number(),
  restoredRowsCount: z.number(),
  checksumVerified: z.boolean(),
});
export type BackupRestoreResponse = z.infer<typeof BackupRestoreResponseSchema>;

// Load Testing & Bandwidth Simulation DTOs (T-38)
export const LoadTestReportSchema = z.object({
  scenario: z.object({
    concurrentUsers: z.number(),
    durationSeconds: z.number(),
    totalMessagesSent: z.number(),
    totalFilesTransferred: z.number(),
    averageFileSizeKb: z.number(),
  }),
  metrics: z.object({
    totalRequests: z.number(),
    successfulRequests: z.number(),
    failedRequests: z.number(),
    errorRatePercent: z.number(),
    throughputReqSec: z.number(),
    throughputMessagesSec: z.number(),
    latency: z.object({
      minMs: z.number(),
      p50Ms: z.number(),
      p90Ms: z.number(),
      p95Ms: z.number(),
      p99Ms: z.number(),
      maxMs: z.number(),
      averageMs: z.number(),
    }),
  }),
  bandwidth: z.object({
    totalDataTransferredMb: z.number(),
    peakThroughputMbps: z.number(),
    estimatedMonthlyBandwidthGb: z.number(),
    costAnalysis: z.object({
      awsS3EgressMonthlyBrl: z.number(),
      cloudflareR2MonthlyBrl: z.number(),
      nextMsgZeroRetentionSavingsPercent: z.number(),
    }),
  }),
  bottlenecksAndRecommendations: z.array(z.string()),
});
export type LoadTestReport = z.infer<typeof LoadTestReportSchema>;





