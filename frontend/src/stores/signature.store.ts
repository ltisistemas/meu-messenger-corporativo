import { create } from 'zustand';
import {
  CreateSignatureRequestDto,
  SignatureRequestResponse,
  SignatureEvidenceReport,
  SimulateSignerDto,
  VerifySignatureHashDto,
  VerifySignatureHashResponse,
} from '@/shared';
import { api } from '../services/api';

export interface SignatureState {
  signatures: SignatureRequestResponse[];
  activeSignature: SignatureRequestResponse | null;
  evidenceReport: SignatureEvidenceReport | null;
  verificationResult: VerifySignatureHashResponse | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchSignaturesByConversation: (conversationId: string) => Promise<void>;
  fetchSignatureDetails: (id: string) => Promise<SignatureRequestResponse>;
  createSignatureRequest: (dto: CreateSignatureRequestDto) => Promise<SignatureRequestResponse>;
  fetchEvidenceReport: (id: string) => Promise<SignatureEvidenceReport>;
  simulateSign: (
    signatureId: string,
    signerId: string,
    dto?: SimulateSignerDto
  ) => Promise<SignatureRequestResponse>;
  verifyDocumentHash: (
    signatureId: string,
    dto: VerifySignatureHashDto
  ) => Promise<VerifySignatureHashResponse>;
  downloadSignedDocument: (signatureId: string, defaultFilename?: string) => Promise<void>;
  downloadEvidencePdf: (signatureId: string, defaultFilename?: string) => Promise<void>;
  setActiveSignature: (sig: SignatureRequestResponse | null) => void;
  clearVerificationResult: () => void;
  handleSignatureCreated: (sig: SignatureRequestResponse) => void;
  handleSignatureUpdated: (sig: SignatureRequestResponse) => void;
}

export const useSignatureStore = create<SignatureState>((set) => ({
  signatures: [],
  activeSignature: null,
  evidenceReport: null,
  verificationResult: null,
  isLoading: false,
  error: null,

  fetchSignaturesByConversation: async (conversationId: string) => {
    try {
      set({ isLoading: true, error: null });
      const data = await api.get<{ signatures: SignatureRequestResponse[] }>(
        `/signatures/conversation/${conversationId}`
      );
      set({ signatures: data.signatures || [], isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Erro ao carregar assinaturas da conversa.', isLoading: false });
    }
  },

  fetchSignatureDetails: async (id: string) => {
    try {
      set({ isLoading: true, error: null });
      const sig = await api.get<SignatureRequestResponse>(`/signatures/${id}`);
      set((state) => ({
        activeSignature: sig,
        signatures: state.signatures.map((s) => (s.id === id ? sig : s)),
        isLoading: false,
      }));
      return sig;
    } catch (err: any) {
      set({ error: err.message || 'Erro ao carregar detalhes da assinatura.', isLoading: false });
      throw err;
    }
  },

  createSignatureRequest: async (dto: CreateSignatureRequestDto) => {
    try {
      set({ isLoading: true, error: null });
      const created = await api.post<SignatureRequestResponse>('/signatures', dto);
      set((state) => ({
        signatures: [created, ...state.signatures],
        activeSignature: created,
        isLoading: false,
      }));
      return created;
    } catch (err: any) {
      set({ error: err.message || 'Erro ao criar solicitação de assinatura.', isLoading: false });
      throw err;
    }
  },

  fetchEvidenceReport: async (id: string) => {
    try {
      set({ isLoading: true, error: null });
      const report = await api.get<SignatureEvidenceReport>(`/signatures/${id}/evidence`);
      set({ evidenceReport: report, isLoading: false });
      return report;
    } catch (err: any) {
      set({ error: err.message || 'Erro ao obter manifesto de evidências.', isLoading: false });
      throw err;
    }
  },

  simulateSign: async (signatureId: string, signerId: string, dto?: SimulateSignerDto) => {
    try {
      set({ isLoading: true, error: null });
      const updated = await api.post<SignatureRequestResponse>(
        `/signatures/${signatureId}/signers/${signerId}/simulate`,
        dto || {}
      );
      set((state) => ({
        activeSignature: updated,
        signatures: state.signatures.map((s) => (s.id === signatureId ? updated : s)),
        isLoading: false,
      }));
      return updated;
    } catch (err: any) {
      set({ error: err.message || 'Erro ao simular assinatura.', isLoading: false });
      throw err;
    }
  },

  verifyDocumentHash: async (signatureId: string, dto: VerifySignatureHashDto) => {
    try {
      set({ isLoading: true, error: null });
      const result = await api.post<VerifySignatureHashResponse>(
        `/signatures/${signatureId}/verify-hash`,
        dto
      );
      set({ verificationResult: result, isLoading: false });
      return result;
    } catch (err: any) {
      set({ error: err.message || 'Erro ao verificar integridade do hash.', isLoading: false });
      throw err;
    }
  },

  downloadSignedDocument: async (
    signatureId: string,
    defaultFilename = 'documento_assinado.pdf'
  ) => {
    try {
      const apiBase = ((import.meta as any).env?.VITE_API_URL || '/api').replace(/\/$/, '');
      const response = await fetch(`${apiBase}/signatures/${signatureId}/download`, {
        headers: {
          authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Falha ao baixar documento assinado.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      set({ error: err.message || 'Erro no download do documento assinado.' });
      throw err;
    }
  },

  downloadEvidencePdf: async (
    signatureId: string,
    defaultFilename = 'certificado_evidencias.pdf'
  ) => {
    try {
      const apiBase = ((import.meta as any).env?.VITE_API_URL || '/api').replace(/\/$/, '');
      const response = await fetch(`${apiBase}/signatures/${signatureId}/evidence/pdf`, {
        headers: {
          authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Falha ao baixar certificado de evidências.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      set({ error: err.message || 'Erro no download do certificado de evidências.' });
      throw err;
    }
  },

  setActiveSignature: (sig: SignatureRequestResponse | null) => {
    set({ activeSignature: sig, evidenceReport: null, verificationResult: null, error: null });
  },

  clearVerificationResult: () => {
    set({ verificationResult: null });
  },

  handleSignatureCreated: (sig: SignatureRequestResponse) => {
    set((state) => {
      const exists = state.signatures.some((s) => s.id === sig.id);
      if (exists) return state;
      return { signatures: [sig, ...state.signatures] };
    });
  },

  handleSignatureUpdated: (sig: SignatureRequestResponse) => {
    set((state) => ({
      signatures: state.signatures.map((s) => (s.id === sig.id ? sig : s)),
      activeSignature: state.activeSignature?.id === sig.id ? sig : state.activeSignature,
    }));
  },
}));

