import { create } from 'zustand';
import { api } from '../services/api';
import {
  AccountDetailsResponse,
  MemberItemResponse,
  BillingSummaryResponse,
  CreateSubscriptionDto,
  CancelSubscriptionDto,
  PlanType,
} from '@corpchat/shared';

export interface AccountState {
  accountDetails: AccountDetailsResponse | null;
  members: MemberItemResponse[];
  billingSummary: BillingSummaryResponse | null;
  isLoading: boolean;
  isSubscribing: boolean;
  error: string | null;
  checkoutResult: {
    pixQrCode?: string;
    pixCopyPaste?: string;
    bankSlipUrl?: string;
    invoiceUrl?: string;
  } | null;

  // Actions
  fetchAccountDetails: () => Promise<void>;
  fetchMembers: () => Promise<void>;
  fetchBillingSummary: () => Promise<void>;
  updateMemberStatus: (userId: string, status: 'active' | 'inactive') => Promise<void>;
  updateMemberRole: (userId: string, role: 'admin' | 'member') => Promise<void>;
  inviteMember: (email: string, role: 'admin' | 'member') => Promise<{ inviteUrl: string }>;
  subscribePlan: (dto: CreateSubscriptionDto) => Promise<void>;
  cancelSubscription: (dto?: CancelSubscriptionDto) => Promise<void>;
  downgradePlan: (plan: PlanType) => Promise<void>;
  clearCheckoutResult: () => void;
  clearError: () => void;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  accountDetails: null,
  members: [],
  billingSummary: null,
  isLoading: false,
  isSubscribing: false,
  error: null,
  checkoutResult: null,

  fetchAccountDetails: async () => {
    try {
      set({ isLoading: true, error: null });
      const details = await api.get<AccountDetailsResponse>('/accounts/me');
      set({ accountDetails: details, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Erro ao carregar detalhes da conta', isLoading: false });
    }
  },

  fetchMembers: async () => {
    try {
      set({ isLoading: true, error: null });
      const res = await api.get<{ members: MemberItemResponse[] }>('/accounts/members');
      set({ members: res.members || [], isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Erro ao carregar membros', isLoading: false });
    }
  },

  fetchBillingSummary: async () => {
    try {
      set({ isLoading: true, error: null });
      const summary = await api.get<BillingSummaryResponse>('/billing/summary');
      set({ billingSummary: summary, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Erro ao carregar resumo financeiro', isLoading: false });
    }
  },

  updateMemberStatus: async (userId: string, status: 'active' | 'inactive') => {
    try {
      set({ isLoading: true, error: null });
      const res = await api.patch<{ member: MemberItemResponse }>(`/accounts/members/${userId}/status`, { status });
      
      // Update local members list
      const updatedMembers = get().members.map((m) => (m.id === userId ? res.member : m));
      set({ members: updatedMembers, isLoading: false });

      // Refresh account details to reflect new active count and quota status
      await get().fetchAccountDetails();
    } catch (err: any) {
      set({ error: err.message || 'Erro ao atualizar status do membro', isLoading: false });
      throw err;
    }
  },

  updateMemberRole: async (userId: string, role: 'admin' | 'member') => {
    try {
      set({ isLoading: true, error: null });
      const res = await api.patch<{ member: MemberItemResponse }>(`/accounts/members/${userId}/role`, { role });
      
      const updatedMembers = get().members.map((m) => (m.id === userId ? res.member : m));
      set({ members: updatedMembers, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Erro ao atualizar cargo do membro', isLoading: false });
      throw err;
    }
  },

  inviteMember: async (email: string, role: 'admin' | 'member') => {
    try {
      set({ error: null });
      const res = await api.post<{ invitation: any; inviteUrl: string }>('/invitations', { email, role });
      
      // Refresh members and account details
      await Promise.all([get().fetchMembers(), get().fetchAccountDetails()]);
      return { inviteUrl: res.inviteUrl };
    } catch (err: any) {
      set({ error: err.message || 'Erro ao criar convite' });
      throw err;
    }
  },

  subscribePlan: async (dto: CreateSubscriptionDto) => {
    try {
      set({ isSubscribing: true, error: null, checkoutResult: null });
      const res = await api.post<{
        subscription: any;
        invoice: any;
        checkout?: {
          pixQrCode?: string;
          pixCopyPaste?: string;
          bankSlipUrl?: string;
          invoiceUrl?: string;
        };
      }>('/billing/subscribe', dto);

      set({
        checkoutResult: res.checkout || null,
        isSubscribing: false,
      });

      // Refresh account details and billing summary
      await Promise.all([get().fetchAccountDetails(), get().fetchBillingSummary()]);
    } catch (err: any) {
      set({ error: err.message || 'Erro ao processar assinatura', isSubscribing: false });
      throw err;
    }
  },

  cancelSubscription: async (dto?: CancelSubscriptionDto) => {
    try {
      set({ isLoading: true, error: null });
      await api.post('/billing/cancel', dto || {});
      await Promise.all([get().fetchAccountDetails(), get().fetchBillingSummary()]);
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Erro ao cancelar assinatura', isLoading: false });
      throw err;
    }
  },

  downgradePlan: async (plan: PlanType) => {
    try {
      set({ isLoading: true, error: null });
      const details = await api.post<AccountDetailsResponse>('/accounts/downgrade', { plan });
      set({ accountDetails: details, isLoading: false });
      await get().fetchBillingSummary();
    } catch (err: any) {
      set({ error: err.message || 'Erro ao alterar plano', isLoading: false });
      throw err;
    }
  },

  clearCheckoutResult: () => set({ checkoutResult: null }),
  clearError: () => set({ error: null }),
}));
