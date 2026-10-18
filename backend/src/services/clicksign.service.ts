import crypto from 'crypto';
import {
  SignatureAuthType,
  SignatureSignAsRole,
  SignatureDocumentStatus,
  SignerItemStatus,
  SignatureEvidenceReport,
  SignatureEvidenceEvent,
} from '@/shared';

export interface ClicksignDocumentInput {
  documentName: string;
  contentBase64: string;
  deadlineAt?: string;
  autoClose?: boolean;
  locale?: string;
}

export interface ClicksignSignerInput {
  name: string;
  email: string;
  documentation?: string; // CPF or CNPJ
  phoneNumber?: string;
  authType?: SignatureAuthType;
  delivery?: 'email' | 'whatsapp';
}

export interface ClicksignAddSignerInput {
  documentKey: string;
  signerKey: string;
  signAs?: SignatureSignAsRole;
  groupOrder?: number;
  message?: string;
}

export interface ClicksignDocumentResponse {
  key: string;
  path: string;
  filename: string;
  status: SignatureDocumentStatus;
  deadlineAt?: string;
  autoClose: boolean;
  originalHash: string;
  signedHash?: string;
  signersCount: number;
  signedCount: number;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface ClicksignSignerResponse {
  key: string;
  email: string;
  name: string;
  documentation?: string;
  phoneNumber?: string;
  authType: SignatureAuthType;
  createdAt: string;
}

export interface ClicksignSignerListItem {
  key: string;
  requestSignatureKey: string;
  documentKey: string;
  signerKey: string;
  signAs: SignatureSignAsRole;
  groupOrder: number;
  url: string;
  status: SignerItemStatus;
  signedAt?: string;
}

export interface ClicksignWebhookEvent {
  event: {
    name: 'document.signed' | 'document.closed' | 'document.canceled' | 'signer.notified';
    occurredAt: string;
    data: {
      document: {
        key: string;
        filename: string;
        status: SignatureDocumentStatus;
      };
      signer?: {
        key: string;
        email: string;
        name: string;
      };
      signature?: {
        requestSignatureKey: string;
        signedAt: string;
        ip: string;
        userAgent: string;
      };
    };
  };
}

/**
 * In-memory sandbox storage for deterministic test simulations
 */
interface SandboxDocumentStore {
  document: ClicksignDocumentResponse;
  contentBase64: string;
  signers: Map<string, ClicksignSignerResponse>;
  associations: Map<string, ClicksignSignerListItem>; // requestSignatureKey -> item
  evidenceEvents: SignatureEvidenceEvent[];
}

export class ClicksignProviderService {
  private apiKey: string;
  private baseUrl: string;
  private sandboxStores: Map<string, SandboxDocumentStore> = new Map();

  constructor(
    apiKey = process.env.CLICKSIGN_API_KEY || 'mock-clicksign-api-key',
    baseUrl = process.env.CLICKSIGN_API_URL || 'https://sandbox.clicksign.com/api/v1'
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private isMock(): boolean {
    return this.apiKey.startsWith('mock-');
  }

  /**
   * Helper to compute SHA-256 hash of a base64 string or buffer
   */
  public computeSha256(content: string | Buffer): string {
    const buffer = typeof content === 'string' ? Buffer.from(content, 'base64') : content;
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * 1. Create a document in Clicksign
   */
  async createDocument(input: ClicksignDocumentInput): Promise<ClicksignDocumentResponse> {
    const originalHash = this.computeSha256(input.contentBase64);
    const now = new Date().toISOString();

    if (this.isMock()) {
      const documentKey = `doc_${crypto.randomUUID()}`;
      const docResponse: ClicksignDocumentResponse = {
        key: documentKey,
        path: `/${input.documentName}`,
        filename: input.documentName,
        status: 'draft',
        deadlineAt: input.deadlineAt,
        autoClose: input.autoClose ?? true,
        originalHash,
        signersCount: 0,
        signedCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      this.sandboxStores.set(documentKey, {
        document: docResponse,
        contentBase64: input.contentBase64,
        signers: new Map(),
        associations: new Map(),
        evidenceEvents: [],
      });

      return docResponse;
    }

    try {
      const res = await fetch(`${this.baseUrl}/documents?access_token=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document: {
            path: `/${input.documentName}`,
            content_base64: `data:application/pdf;base64,${input.contentBase64}`,
            deadline_at: input.deadlineAt,
            auto_close: input.autoClose ?? true,
            locale: input.locale || 'pt-BR',
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.errors?.[0] || 'Erro ao criar documento no Clicksign.');
      }

      const data = await res.json();
      const raw = data.document;

      return {
        key: raw.key,
        path: raw.path,
        filename: input.documentName,
        status: raw.status || 'draft',
        deadlineAt: raw.deadline_at,
        autoClose: raw.auto_close,
        originalHash: raw.original_hash || originalHash,
        signersCount: 0,
        signedCount: 0,
        createdAt: raw.created_at || now,
        updatedAt: raw.updated_at || now,
      };
    } catch (err: any) {
      throw new Error(`Falha no Clicksign (createDocument): ${err.message}`);
    }
  }

  /**
   * 2. Create a signer in Clicksign
   */
  async createSigner(input: ClicksignSignerInput): Promise<ClicksignSignerResponse> {
    const now = new Date().toISOString();
    const authType = input.authType || 'email';

    if (this.isMock()) {
      const signerKey = `sig_${crypto.randomUUID()}`;
      return {
        key: signerKey,
        email: input.email,
        name: input.name,
        documentation: input.documentation,
        phoneNumber: input.phoneNumber,
        authType,
        createdAt: now,
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/signers?access_token=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signer: {
            email: input.email,
            name: input.name,
            documentation: input.documentation,
            phone_number: input.phoneNumber,
            auths: [authType],
            delivery: input.delivery || 'email',
            has_documentation: Boolean(input.documentation),
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.errors?.[0] || 'Erro ao cadastrar signatário no Clicksign.');
      }

      const data = await res.json();
      const raw = data.signer;

      return {
        key: raw.key,
        email: raw.email,
        name: raw.name,
        documentation: raw.documentation,
        phoneNumber: raw.phone_number,
        authType,
        createdAt: raw.created_at || now,
      };
    } catch (err: any) {
      throw new Error(`Falha no Clicksign (createSigner): ${err.message}`);
    }
  }

  /**
   * 3. Add a signer to a document (Lists API) and generate signature URL
   */
  async addSignerToDocument(input: ClicksignAddSignerInput): Promise<ClicksignSignerListItem> {
    const signAs = input.signAs || 'sign';
    const groupOrder = input.groupOrder || 1;

    if (this.isMock()) {
      const store = this.sandboxStores.get(input.documentKey);
      if (!store) {
        throw new Error(`Documento ${input.documentKey} não encontrado no sandbox.`);
      }

      const listKey = `list_${crypto.randomUUID()}`;
      const requestSignatureKey = `req_${crypto.randomUUID()}`;
      const url = `https://sandbox.clicksign.com/sign/${requestSignatureKey}`;

      const listItem: ClicksignSignerListItem = {
        key: listKey,
        requestSignatureKey,
        documentKey: input.documentKey,
        signerKey: input.signerKey,
        signAs,
        groupOrder,
        url,
        status: 'pending',
      };

      store.associations.set(requestSignatureKey, listItem);
      store.document.signersCount += 1;
      store.document.status = 'running';
      store.document.updatedAt = new Date().toISOString();

      return listItem;
    }

    try {
      const res = await fetch(`${this.baseUrl}/lists?access_token=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          list: {
            document_key: input.documentKey,
            signer_key: input.signerKey,
            sign_as: signAs,
            group: groupOrder,
            message: input.message || 'Por favor, assine o documento.',
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.errors?.[0] || 'Erro ao associar signatário ao documento.');
      }

      const data = await res.json();
      const raw = data.list;

      return {
        key: raw.key,
        requestSignatureKey: raw.request_signature_key,
        documentKey: raw.document_key,
        signerKey: raw.signer_key,
        signAs: raw.sign_as || signAs,
        groupOrder: raw.group || groupOrder,
        url: raw.url || `https://app.clicksign.com/sign/${raw.request_signature_key}`,
        status: 'pending',
      };
    } catch (err: any) {
      throw new Error(`Falha no Clicksign (addSignerToDocument): ${err.message}`);
    }
  }

  /**
   * 4. Sandbox helper: Simulate a signer signing the document
   */
  async simulateSignDocument(params: {
    documentKey: string;
    requestSignatureKey: string;
    signerInfo: {
      name: string;
      email: string;
      documentation?: string;
      authType?: SignatureAuthType;
    };
    ipAddress?: string;
    userAgent?: string;
    token?: string;
  }): Promise<{
    document: ClicksignDocumentResponse;
    listItem: ClicksignSignerListItem;
    evidenceEvent: SignatureEvidenceEvent;
  }> {
    const store = this.sandboxStores.get(params.documentKey);
    if (!store) {
      throw new Error(`Documento ${params.documentKey} não encontrado no sandbox.`);
    }

    const listItem = store.associations.get(params.requestSignatureKey);
    if (!listItem) {
      throw new Error(`Chave de assinatura ${params.requestSignatureKey} não encontrada.`);
    }

    if (listItem.status === 'signed') {
      throw new Error('Este signatário já assinou o documento.');
    }

    const signedAt = new Date().toISOString();
    listItem.status = 'signed';
    listItem.signedAt = signedAt;

    store.document.signedCount += 1;

    const evidenceEvent: SignatureEvidenceEvent = {
      signerName: params.signerInfo.name,
      signerEmail: params.signerInfo.email,
      documentation: params.signerInfo.documentation,
      authType: params.signerInfo.authType || 'email',
      ipAddress: params.ipAddress || '189.120.45.12',
      userAgent:
        params.userAgent ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
      signedAt,
      token: params.token || crypto.randomBytes(16).toString('hex'),
      signatureRole: listItem.signAs,
    };

    store.evidenceEvents.push(evidenceEvent);

    // If all signers signed, transition document to 'closed'
    if (store.document.signedCount >= store.document.signersCount) {
      store.document.status = 'closed';
      store.document.closedAt = signedAt;
      // Compute signed hash (original content + evidence salt)
      const signedContent = `${store.contentBase64}-signed-at-${signedAt}`;
      store.document.signedHash = this.computeSha256(Buffer.from(signedContent));
    }

    store.document.updatedAt = signedAt;

    return {
      document: store.document,
      listItem,
      evidenceEvent,
    };
  }

  /**
   * 5. Retrieve document details and status
   */
  async getDocument(documentKey: string): Promise<{
    document: ClicksignDocumentResponse;
    signers: ClicksignSignerListItem[];
  }> {
    if (this.isMock()) {
      const store = this.sandboxStores.get(documentKey);
      if (!store) {
        throw new Error(`Documento ${documentKey} não encontrado.`);
      }

      return {
        document: store.document,
        signers: Array.from(store.associations.values()),
      };
    }

    try {
      const res = await fetch(
        `${this.baseUrl}/documents/${documentKey}?access_token=${this.apiKey}`
      );
      if (!res.ok) {
        throw new Error('Documento não encontrado na API Clicksign.');
      }

      const data = await res.json();
      const raw = data.document;

      return {
        document: {
          key: raw.key,
          path: raw.path,
          filename: raw.filename,
          status: raw.status,
          deadlineAt: raw.deadline_at,
          autoClose: raw.auto_close,
          originalHash: raw.original_hash || '',
          signedHash: raw.signed_hash,
          signersCount: raw.signers?.length || 0,
          signedCount: raw.signers?.filter((s: any) => s.status === 'signed')?.length || 0,
          createdAt: raw.created_at,
          updatedAt: raw.updated_at,
          closedAt: raw.closed_at,
        },
        signers: (raw.signers || []).map((s: any) => ({
          key: s.key,
          requestSignatureKey: s.request_signature_key,
          documentKey: raw.key,
          signerKey: s.signer_key,
          signAs: s.sign_as || 'sign',
          groupOrder: s.group || 1,
          url: s.url,
          status: s.status || 'pending',
          signedAt: s.signed_at,
        })),
      };
    } catch (err: any) {
      throw new Error(`Falha no Clicksign (getDocument): ${err.message}`);
    }
  }

  /**
   * 6. Download evidence report manifest (Certificate of Evidence)
   */
  async getEvidenceReport(documentKey: string): Promise<SignatureEvidenceReport> {
    if (this.isMock()) {
      const store = this.sandboxStores.get(documentKey);
      if (!store) {
        throw new Error(`Documento ${documentKey} não encontrado.`);
      }

      return {
        documentKey: store.document.key,
        documentName: store.document.filename,
        originalDocSha256: store.document.originalHash,
        signedDocSha256: store.document.signedHash || store.document.originalHash,
        status: store.document.status,
        createdAt: store.document.createdAt,
        closedAt: store.document.closedAt,
        legalFramework:
          'Medida Provisória nº 2.200-2/2001 e Lei Federal nº 14.063/2020 (Assinatura Eletrônica Simples/Avançada)',
        events: store.evidenceEvents,
      };
    }

    try {
      const { document } = await this.getDocument(documentKey);
      return {
        documentKey: document.key,
        documentName: document.filename,
        originalDocSha256: document.originalHash,
        signedDocSha256: document.signedHash || document.originalHash,
        status: document.status,
        createdAt: document.createdAt,
        closedAt: document.closedAt,
        legalFramework:
          'Medida Provisória nº 2.200-2/2001 e Lei Federal nº 14.063/2020 (Assinatura Eletrônica Simples/Avançada)',
        events: [],
      };
    } catch (err: any) {
      throw new Error(`Falha no Clicksign (getEvidenceReport): ${err.message}`);
    }
  }

  /**
   * 7. Download signed PDF buffer
   */
  async downloadSignedDocument(documentKey: string): Promise<{
    buffer: Buffer;
    contentType: string;
    filename: string;
    sha256: string;
  }> {
    if (this.isMock()) {
      const store = this.sandboxStores.get(documentKey);
      if (!store) {
        throw new Error(`Documento ${documentKey} não encontrado.`);
      }

      if (store.document.status !== 'closed') {
        throw new Error('O documento ainda não foi finalizado por todos os signatários.');
      }

      // Generate a mock signed PDF buffer with certificate stamp header
      const mockSignedPdf = `%PDF-1.4 [CLICKSIGN_SIGNED_DOCUMENT_MOCK] docKey=${documentKey} hash=${store.document.signedHash}`;
      const buffer = Buffer.from(mockSignedPdf);

      return {
        buffer,
        contentType: 'application/pdf',
        filename: `${store.document.filename.replace('.pdf', '')}_assinado.pdf`,
        sha256: store.document.signedHash || this.computeSha256(buffer),
      };
    }

    try {
      const res = await fetch(
        `${this.baseUrl}/documents/${documentKey}/download?access_token=${this.apiKey}`
      );
      if (!res.ok) {
        throw new Error('Falha ao baixar documento assinado.');
      }

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const sha256 = this.computeSha256(buffer);

      return {
        buffer,
        contentType: 'application/pdf',
        filename: `${documentKey}_assinado.pdf`,
        sha256,
      };
    } catch (err: any) {
      throw new Error(`Falha no Clicksign (downloadSignedDocument): ${err.message}`);
    }
  }

  /**
   * 8. Verify Clicksign HMAC-SHA256 Webhook Signature
   */
  verifyWebhookSignature(
    rawPayload: string | Buffer,
    signatureHeader: string,
    secret: string
  ): boolean {
    if (!signatureHeader || !secret) return false;
    try {
      const computedHmac = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');

      if (computedHmac.length !== signatureHeader.length) {
        return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(computedHmac, 'utf-8'),
        Buffer.from(signatureHeader, 'utf-8')
      );
    } catch {
      return false;
    }
  }

  /**
   * 9. Generate HMAC-SHA256 signature for test/simulation webhooks
   */
  generateTestWebhookSignature(rawPayload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');
  }
}

