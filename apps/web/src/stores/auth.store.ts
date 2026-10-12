import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PlanType } from '@corpchat/shared';
import { api, ApiError } from '../services/api';

export interface UserSession {
  id: string;
  accountId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'suspended';
}

export interface AccountSession {
  id: string;
  name: string;
  plan: PlanType;
  status: 'active' | 'suspended' | 'over_quota';
  trialEndsAt?: string | null;
}

export interface AuthState {
  user: UserSession | null;
  account: AccountSession | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: {
    accountName: string;
    name: string;
    email: string;
    password: string;
    plan?: PlanType;
  }) => Promise<void>;
  acceptInvite: (data: { token: string; name: string; password: string }) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      account: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      clearError: () => set({ error: null }),

      login: async ({ email, password }) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/login', { email, password });
          set({
            user: response.user,
            account: response.account,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (err: any) {
          const errorMsg =
            err instanceof ApiError ? err.message : 'Falha ao autenticar no sistema.';
          set({ isLoading: false, error: errorMsg });
          throw err;
        }
      },

      register: async ({ accountName, name, email, password, plan = 'free' }) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/register', {
            accountName,
            name,
            email,
            password,
            plan,
          });
          set({
            user: response.user,
            account: response.account,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (err: any) {
          const errorMsg =
            err instanceof ApiError ? err.message : 'Falha ao criar nova organização.';
          set({ isLoading: false, error: errorMsg });
          throw err;
        }
      },

      acceptInvite: async ({ token, name, password }) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post(`/invitations/${token}/accept`, { name, password });
          set({
            user: response.user,
            account: response.account,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (err: any) {
          const errorMsg =
            err instanceof ApiError ? err.message : 'Falha ao aceitar convite corporativo.';
          set({ isLoading: false, error: errorMsg });
          throw err;
        }
      },

      logout: () => {
        const { refreshToken } = get();
        if (refreshToken) {
          api.post('/auth/logout', { refreshToken }).catch(() => {});
        }
        set({
          user: null,
          account: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },

      checkAuth: async () => {
        const { accessToken } = get();
        if (!accessToken) {
          set({ isAuthenticated: false, user: null, account: null });
          return;
        }

        try {
          const response = await api.get('/auth/me');
          set({
            user: response.user,
            account: response.account,
            isAuthenticated: true,
          });
        } catch {
          set({
            user: null,
            account: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          });
        }
      },
    }),
    {
      name: 'corpchat_auth',
      partialize: (state) => ({
        user: state.user,
        account: state.account,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
