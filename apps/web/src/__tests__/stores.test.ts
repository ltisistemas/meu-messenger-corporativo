import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../stores/auth.store';
import { useAccountStore } from '../stores/account.store';
import { useSignatureStore } from '../stores/signature.store';
import { useSocketStore } from '../stores/socket.store';
import { useThemeStore } from '../stores/theme.store';
import { useChatStore } from '../stores/chat.store';
import { api, ApiError } from '../services/api';

vi.mock('../services/api', () => {
  class MockApiError extends Error {
    constructor(message: string, public status: number, public data?: any) {
      super(message);
      this.name = 'ApiError';
    }
  }
  return {
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
    ApiError: MockApiError,
  };
});

const eventCallbacks: Record<string, Function> = {};
const mockSocketInstance = {
  connected: false,
  on: vi.fn((event: string, cb: Function) => {
    eventCallbacks[event] = cb;
  }),
  disconnect: vi.fn(() => {
    mockSocketInstance.connected = false;
  }),
  emit: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocketInstance),
}));

describe('Zustand Stores Comprehensive Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      account: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  describe('useAuthStore', () => {
    it('initial state has unauthenticated user and empty tokens', () => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
    });

    it('login sets tokens, user and isAuthenticated on success', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        user: { id: 'u-1', name: 'Alice', email: 'alice@corp.com', role: 'owner', status: 'active', accountId: 'acc-1' },
        account: { id: 'acc-1', name: 'Acme', plan: 'pro', status: 'active' },
      });

      await useAuthStore.getState().login({ email: 'alice@corp.com', password: 'password123' });

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.name).toBe('Alice');
      expect(state.accessToken).toBe('access-123');
      expect(state.error).toBeNull();
    });

    it('login sets error and throws on failure', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new ApiError('Credenciais inválidas', 401));

      await expect(
        useAuthStore.getState().login({ email: 'alice@corp.com', password: 'wrong' })
      ).rejects.toThrow('Credenciais inválidas');

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe('Credenciais inválidas');

      useAuthStore.getState().clearError();
      expect(useAuthStore.getState().error).toBeNull();
    });

    it('login sets generic error message when error is not ApiError', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Network broke'));

      await expect(
        useAuthStore.getState().login({ email: 'alice@corp.com', password: 'wrong' })
      ).rejects.toThrow('Network broke');

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe('Falha ao autenticar no sistema.');
    });

    it('register creates user and authenticates session', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        accessToken: 'reg-token',
        refreshToken: 'reg-refresh',
        user: { id: 'u-2', name: 'Bob', email: 'bob@corp.com', role: 'owner', status: 'active', accountId: 'acc-2' },
        account: { id: 'acc-2', name: 'Beta Corp', plan: 'free', status: 'active' },
      });

      await useAuthStore.getState().register({
        accountName: 'Beta Corp',
        name: 'Bob',
        email: 'bob@corp.com',
        password: 'pass',
      });

      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().account?.name).toBe('Beta Corp');
    });

    it('register handles failure and throws', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new ApiError('Email já em uso', 400));

      await expect(
        useAuthStore.getState().register({
          accountName: 'Beta Corp',
          name: 'Bob',
          email: 'bob@corp.com',
          password: 'pass',
        })
      ).rejects.toThrow('Email já em uso');

      expect(useAuthStore.getState().error).toBe('Email já em uso');
    });

    it('acceptInvite activates membership and session', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        accessToken: 'inv-token',
        refreshToken: 'inv-refresh',
        user: { id: 'u-3', name: 'Carol', email: 'carol@corp.com', role: 'member', status: 'active', accountId: 'acc-1' },
        account: { id: 'acc-1', name: 'Acme', plan: 'pro', status: 'active' },
      });

      await useAuthStore.getState().acceptInvite({ token: 'inv-tok', name: 'Carol', password: 'pwd' });
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.name).toBe('Carol');
    });

    it('logout clears tokens, user and authentication', () => {
      vi.mocked(api.post).mockReturnValue(Promise.resolve({}) as any);
      useAuthStore.setState({
        accessToken: 'tok',
        refreshToken: 'ref',
        isAuthenticated: true,
        user: { id: 'u-1', name: 'Alice', email: 'a@c.com', role: 'member', status: 'active', accountId: 'acc-1' },
      });

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.accessToken).toBeNull();
      expect(state.user).toBeNull();
    });

    it('checkAuth validates session via /auth/me and handles failure', async () => {
      useAuthStore.setState({ accessToken: 'test-tok', isAuthenticated: true });
      vi.mocked(api.get).mockResolvedValueOnce({
        user: { id: 'u-1', name: 'Alice', email: 'a@c.com', role: 'owner', status: 'active', accountId: 'acc-1' },
        account: { id: 'acc-1', name: 'Acme', plan: 'pro', status: 'active' },
      });

      await useAuthStore.getState().checkAuth();
      expect(useAuthStore.getState().user?.name).toBe('Alice');

      // Failure logs out
      vi.mocked(api.get).mockRejectedValueOnce(new Error('Token revogado'));
      await useAuthStore.getState().checkAuth();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('useAccountStore', () => {
    it('fetchAccountDetails populates accountDetails state', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        id: 'acc-1',
        name: 'Acme Corp',
        plan: 'pro',
        status: 'active',
        activeUsersCount: 5,
        maxUsers: 12,
      });

      await useAccountStore.getState().fetchAccountDetails();
      expect(useAccountStore.getState().accountDetails?.name).toBe('Acme Corp');

      // Error branch
      vi.mocked(api.get).mockRejectedValueOnce(new Error('Erro na conta'));
      await useAccountStore.getState().fetchAccountDetails();
      expect(useAccountStore.getState().error).toBe('Erro na conta');
      useAccountStore.getState().clearError();
      expect(useAccountStore.getState().error).toBeNull();
    });

    it('fetchMembers populates members list', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        members: [{ id: 'm-1', name: 'Dev', email: 'dev@corp.com', role: 'member', status: 'active' }],
      });

      await useAccountStore.getState().fetchMembers();
      expect(useAccountStore.getState().members.length).toBe(1);

      // Error branch
      vi.mocked(api.get).mockRejectedValueOnce(new Error('Erro ao buscar membros'));
      await useAccountStore.getState().fetchMembers();
      expect(useAccountStore.getState().error).toBe('Erro ao buscar membros');
    });

    it('fetchBillingSummary populates billingSummary state', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        account: { id: 'acc-1', plan: 'pro' },
        subscription: { id: 'sub-1', status: 'active', amountCents: 14900 },
        invoices: [],
      });

      await useAccountStore.getState().fetchBillingSummary();
      expect(useAccountStore.getState().billingSummary?.subscription?.amountCents).toBe(14900);
    });

    it('updateMemberStatus, updateMemberRole and inviteMember work correctly', async () => {
      useAccountStore.setState({
        members: [{ id: 'm-1', name: 'Dev', email: 'd@c.com', role: 'member', status: 'active', createdAt: '2026-10-12' }],
      });

      vi.mocked(api.patch).mockResolvedValueOnce({
        member: { id: 'm-1', name: 'Dev', email: 'd@c.com', role: 'member', status: 'inactive', createdAt: '2026-10-12' },
      });
      await useAccountStore.getState().updateMemberStatus('m-1', 'inactive');
      expect(api.patch).toHaveBeenCalledWith('/accounts/members/m-1/status', { status: 'inactive' });

      vi.mocked(api.patch).mockResolvedValueOnce({
        member: { id: 'm-1', name: 'Dev', email: 'd@c.com', role: 'admin', status: 'active', createdAt: '2026-10-12' },
      });
      await useAccountStore.getState().updateMemberRole('m-1', 'admin');
      expect(api.patch).toHaveBeenCalledWith('/accounts/members/m-1/role', { role: 'admin' });

      vi.mocked(api.post).mockResolvedValueOnce({
        invite: { id: 'inv-1' },
        inviteUrl: 'https://app/invite/token123',
      });
      vi.mocked(api.get).mockResolvedValue({ members: [] });
      const res = await useAccountStore.getState().inviteMember('new@corp.com', 'member');
      expect(res.inviteUrl).toBe('https://app/invite/token123');
    });

    it('subscribePlan, cancelSubscription, downgradePlan and clearCheckoutResult', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        subscription: {},
        invoice: {},
        checkout: { pixQrCode: 'pix-code', bankSlipUrl: 'https://boleto.url' },
      });
      await useAccountStore.getState().subscribePlan({
        plan: 'pro',
        billingCycle: 'monthly',
        paymentMethod: 'pix',
      });
      expect(useAccountStore.getState().checkoutResult?.pixQrCode).toBe('pix-code');

      useAccountStore.getState().clearCheckoutResult();
      expect(useAccountStore.getState().checkoutResult).toBeNull();

      vi.mocked(api.post).mockResolvedValueOnce({});
      await useAccountStore.getState().cancelSubscription();
      expect(api.post).toHaveBeenCalledWith('/billing/cancel', {});

      vi.mocked(api.post).mockResolvedValueOnce({});
      await useAccountStore.getState().downgradePlan('free');
      expect(api.post).toHaveBeenCalledWith('/accounts/downgrade', { plan: 'free' });
    });
  });

  describe('useSignatureStore', () => {
    it('fetchSignaturesByConversation and fetchSignatureDetails', async () => {
      useSignatureStore.setState({ signatures: [], activeSignature: null });
      const mockSig: any = { id: 'sig-1', documentName: 'contrato.pdf', status: 'running' };
      vi.mocked(api.get).mockResolvedValueOnce({ signatures: [mockSig] });

      await useSignatureStore.getState().fetchSignaturesByConversation('conv-1');
      expect(useSignatureStore.getState().signatures.length).toBe(1);

      vi.mocked(api.get).mockResolvedValueOnce(mockSig);
      const details = await useSignatureStore.getState().fetchSignatureDetails('sig-1');
      expect(details.documentName).toBe('contrato.pdf');
      expect(useSignatureStore.getState().activeSignature?.id).toBe('sig-1');
    });

    it('createSignatureRequest, fetchEvidenceReport, simulateSign and verifyDocumentHash', async () => {
      const mockSig: any = { id: 'sig-2', documentName: 'acordo.pdf', status: 'running' };
      vi.mocked(api.post).mockResolvedValueOnce(mockSig);

      const created = await useSignatureStore.getState().createSignatureRequest({
        conversationId: 'conv-1',
        documentName: 'acordo.pdf',
        fileBase64: 'base64',
        signers: [],
      });
      expect(created.id).toBe('sig-2');

      vi.mocked(api.get).mockResolvedValueOnce({ documentName: 'acordo.pdf', events: [] });
      const report = await useSignatureStore.getState().fetchEvidenceReport('sig-2');
      expect(report.documentName).toBe('acordo.pdf');

      vi.mocked(api.post).mockResolvedValueOnce({ ...mockSig, status: 'closed' });
      const signed = await useSignatureStore.getState().simulateSign('sig-2', 'signer-1');
      expect(signed.status).toBe('closed');

      vi.mocked(api.post).mockResolvedValueOnce({ isValid: true, matchesOriginal: true });
      const verified = await useSignatureStore.getState().verifyDocumentHash('sig-2', { sha256: 'abc' });
      expect(verified.isValid).toBe(true);

      useSignatureStore.getState().clearVerificationResult();
      expect(useSignatureStore.getState().verificationResult).toBeNull();
    });

    it('downloadSignedDocument and downloadEvidencePdf open download URL in window', async () => {
      // Mock fetch and URL for download
      window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      window.URL.revokeObjectURL = vi.fn();

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['PDF']),
      } as any);

      await useSignatureStore.getState().downloadSignedDocument('sig-1', 'doc.pdf');
      expect(window.URL.createObjectURL).toHaveBeenCalled();

      await useSignatureStore.getState().downloadEvidencePdf('sig-1', 'cert.pdf');
      expect(window.URL.createObjectURL).toHaveBeenCalled();

      global.fetch = originalFetch;
    });

    it('handleSignatureCreated and handleSignatureUpdated update state and list', () => {
      useSignatureStore.setState({ signatures: [] });
      const sig1: any = { id: 'sig-1', status: 'running' };
      useSignatureStore.getState().handleSignatureCreated(sig1);
      expect(useSignatureStore.getState().signatures.length).toBe(1);

      const updated: any = { id: 'sig-1', status: 'closed' };
      useSignatureStore.getState().handleSignatureUpdated(updated);
      expect(useSignatureStore.getState().signatures[0].status).toBe('closed');

      useSignatureStore.getState().setActiveSignature(null);
      expect(useSignatureStore.getState().activeSignature).toBeNull();
    });
  });

  describe('useThemeStore and useSocketStore', () => {
    it('useThemeStore toggles between light and dark', () => {
      useThemeStore.getState().setTheme('light');
      expect(useThemeStore.getState().theme).toBe('light');

      useThemeStore.getState().toggleTheme();
      expect(useThemeStore.getState().theme).toBe('dark');
    });

    it('useSocketStore handles connect and disconnect', () => {
      const store = useSocketStore.getState();
      expect(store.isConnected).toBe(false);

      useAuthStore.setState({ accessToken: 'test-token' });
      store.connect();
      expect(useSocketStore.getState().socket).toBeDefined();

      store.disconnect();
      expect(useSocketStore.getState().socket).toBeNull();
      expect(useSocketStore.getState().isConnected).toBe(false);
    });
  });

  describe('useChatStore', () => {
    it('fetchConversations populates conversation list', async () => {
      useChatStore.setState({ conversations: [], activeConversationId: null });
      const mockConvs: any = [
        { id: 'c-1', title: 'Geral', type: 'group', status: 'active', members: [] },
      ];
      vi.mocked(api.get).mockResolvedValueOnce(mockConvs);

      await useChatStore.getState().fetchConversations();
      expect(useChatStore.getState().conversations.length).toBe(1);
    });

    it('selectConversation switches active id and loads messages', async () => {
      useChatStore.setState({
        conversations: [{ id: 'c-2', title: 'Devs', type: 'group', status: 'active', unreadCount: 2 } as any],
      });
      vi.mocked(api.get).mockResolvedValueOnce([{ id: 'm-1', content: 'Ola', senderId: 'u-1', conversationId: 'c-2', type: 'text', createdAt: '2026-10-12' }]);

      await useChatStore.getState().selectConversation('c-2');
      expect(useChatStore.getState().activeConversationId).toBe('c-2');
      expect(useChatStore.getState().messages['c-2']).toHaveLength(1);
    });

    it('sendMessage adds optimistic message and commits on api success', async () => {
      useAuthStore.setState({ user: { id: 'u-1', name: 'Alice', email: 'a@c.com', role: 'member', status: 'active', accountId: 'acc-1' } });
      useChatStore.setState({
        conversations: [{ id: 'c-1', title: 'Geral', type: 'group', status: 'active' } as any],
        activeConversationId: 'c-1',
        messages: { 'c-1': [] },
      });

      vi.mocked(api.post).mockResolvedValueOnce({
        id: 'server-m-1',
        conversationId: 'c-1',
        senderId: 'u-1',
        content: 'Mensagem teste',
        type: 'text',
        createdAt: new Date().toISOString(),
        status: 'sent',
        isSelf: true,
      });

      await useChatStore.getState().sendMessage('Mensagem teste');
      const messages = useChatStore.getState().messages['c-1'];
      expect(messages.some((m) => m.content === 'Mensagem teste')).toBe(true);
    });

    it('createGroupConversation, createDirectConversation and createBroadcast', async () => {
      useChatStore.setState({ conversations: [] });
      vi.mocked(api.post).mockResolvedValueOnce({ id: 'c-new-group', title: 'Squad Alfa' });
      vi.mocked(api.get)
        .mockResolvedValueOnce([{ id: 'c-new-group', title: 'Squad Alfa' }]) // fetchConversations
        .mockResolvedValueOnce([]); // fetchMessages in selectConversation

      const groupId = await useChatStore.getState().createGroupConversation('Squad Alfa');
      expect(groupId).toBe('c-new-group');

      vi.mocked(api.post).mockResolvedValueOnce({ id: 'c-direct-bob' });
      vi.mocked(api.get)
        .mockResolvedValueOnce([{ id: 'c-direct-bob', title: 'Bob' }]) // fetchConversations
        .mockResolvedValueOnce([]); // fetchMessages in selectConversation
      const directId = await useChatStore.getState().createDirectConversation('u-bob');
      expect(directId).toBe('c-direct-bob');

      vi.mocked(api.post).mockResolvedValueOnce({ id: 'b-msg-1' });
      vi.mocked(api.get).mockResolvedValueOnce([]);
      const broad = await useChatStore.getState().createBroadcast('Aviso geral');
      expect(broad.id).toBe('b-msg-1');

      vi.mocked(api.get).mockResolvedValueOnce({ id: 'rep-1', deliveryRate: 100 });
      const report = await useChatStore.getState().fetchBroadcastReport('b-msg-1');
      expect(report.deliveryRate).toBe(100);
    });

    it('createPoll, votePoll and closePoll', async () => {
      const mockPoll: any = { id: 'p-1', conversationId: 'c-1', question: 'Almoço?', options: [] };
      vi.mocked(api.post).mockResolvedValueOnce(mockPoll);
      const createdPoll = await useChatStore.getState().createPoll({
        conversationId: 'c-1',
        question: 'Almoço?',
        options: ['Pizza', 'Salada'],
      });
      expect(createdPoll.id).toBe('p-1');

      vi.mocked(api.post).mockResolvedValueOnce({ ...mockPoll, totalVotes: 1 });
      const votedPoll = await useChatStore.getState().votePoll('p-1', ['opt-1']);
      expect(votedPoll.totalVotes).toBe(1);

      vi.mocked(api.post).mockResolvedValueOnce({ ...mockPoll, status: 'closed' });
      const closedPoll = await useChatStore.getState().closePoll('p-1');
      expect(closedPoll.status).toBe('closed');
    });

    it('markAsRead and sendTyping', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({});

      await useChatStore.getState().markAsRead('c-1');
      expect(api.post).toHaveBeenCalledWith('/messages/read', { conversationId: 'c-1' });

      // sendTyping emits through socket store if connected
      expect(() => useChatStore.getState().sendTyping('c-1', true)).not.toThrow();
    });

    it('sendFileRelay validates requirements and transmits file chunks', async () => {
      // 1. Error if no active conversation or user
      useChatStore.setState({ activeConversationId: null });
      useAuthStore.setState({ user: null });
      await expect(
        useChatStore.getState().sendFileRelay(new File(['hello'], 'test.txt'))
      ).rejects.toThrow('Nenhuma conversa selecionada ou usuário não autenticado.');

      // 2. Error if socket disconnected
      useChatStore.setState({ activeConversationId: 'c-1' });
      useAuthStore.setState({
        user: { id: 'u-1', name: 'Alice', email: 'alice@corp.com', role: 'owner', status: 'active', accountId: 'acc-1' },
      });
      useSocketStore.setState({ socket: null });
      await expect(
        useChatStore.getState().sendFileRelay(new File(['hello'], 'test.txt'))
      ).rejects.toThrow('Conexão WebSocket indisponível');

      // 3. Successful chunk streaming
      const emitMock = vi.fn((event, payload, cb) => {
        if (cb) cb({ success: true });
      });
      const mockSocket = {
        connected: true,
        emit: emitMock,
        on: vi.fn(),
        off: vi.fn(),
      };
      useSocketStore.setState({ socket: mockSocket as any });

      const progressSpy = vi.fn();
      const testFile = new File(['a'.repeat(70000)], 'large.txt', { type: 'text/plain' });
      await useChatStore.getState().sendFileRelay(testFile, progressSpy);

      expect(emitMock).toHaveBeenCalledWith('file:relay:init', expect.any(Object), expect.any(Function));
      expect(emitMock).toHaveBeenCalledWith('file:relay:chunk', expect.any(Object), expect.any(Function));
      expect(emitMock).toHaveBeenCalledWith('file:relay:complete', expect.any(Object), expect.any(Function));
      expect(progressSpy).toHaveBeenCalled();
    });

    it('sendFileRelay handles relay errors on init, chunk, and complete', async () => {
      useChatStore.setState({ activeConversationId: 'c-1' });
      useAuthStore.setState({
        user: { id: 'u-1', name: 'Alice', email: 'alice@corp.com', role: 'owner', status: 'active', accountId: 'acc-1' },
      });

      // Init error with suggestCloudShare
      let mockSocket: any = {
        connected: true,
        emit: vi.fn((event, payload, cb) => {
          if (event === 'file:relay:init' && cb) {
            cb({ error: 'Peer offline', code: 'PEER_OFFLINE', suggestCloudShare: true });
          }
        }),
      };
      useSocketStore.setState({ socket: mockSocket });
      await expect(
        useChatStore.getState().sendFileRelay(new File(['data'], 'test.txt'))
      ).rejects.toThrow('Peer offline');

      // Chunk error
      mockSocket = {
        connected: true,
        emit: vi.fn((event, payload, cb) => {
          if (event === 'file:relay:init' && cb) cb({ success: true });
          if (event === 'file:relay:chunk' && cb) cb({ error: 'Chunk timeout' });
        }),
      };
      useSocketStore.setState({ socket: mockSocket });
      await expect(
        useChatStore.getState().sendFileRelay(new File(['data'], 'test.txt'))
      ).rejects.toThrow('Chunk timeout');

      // Complete error
      mockSocket = {
        connected: true,
        emit: vi.fn((event, payload, cb) => {
          if (event === 'file:relay:init' && cb) cb({ success: true });
          if (event === 'file:relay:chunk' && cb) cb({ success: true });
          if (event === 'file:relay:complete' && cb) cb({ error: 'Relay corrupted' });
        }),
      };
      useSocketStore.setState({ socket: mockSocket });
      await expect(
        useChatStore.getState().sendFileRelay(new File(['data'], 'test.txt'))
      ).rejects.toThrow('Relay corrupted');
    });

    it('initializeSocketListeners sets up presence, typing, messages, receipts, and polls', async () => {
      const listeners: Record<string, Function> = {};
      const mockSocket = {
        connected: true,
        on: vi.fn((event, cb) => {
          listeners[event] = cb;
        }),
        off: vi.fn(),
        emit: vi.fn(),
      };
      useSocketStore.setState({ socket: mockSocket as any });
      useAuthStore.setState({
        user: { id: 'u-1', name: 'Alice', email: 'alice@corp.com', role: 'owner', status: 'active', accountId: 'acc-1' },
      });
      useChatStore.setState({
        activeConversationId: 'c-1',
        conversations: [
          { id: 'c-1', title: 'Geral', unreadCount: 0, updatedAt: new Date().toISOString() } as any,
          { id: 'c-2', title: 'Devs', unreadCount: 0, updatedAt: new Date(Date.now() - 10000).toISOString() } as any,
        ],
        messages: {
          'c-1': [],
          'c-2': [],
        },
      });

      useChatStore.getState().initializeSocketListeners();
      expect(mockSocket.on).toHaveBeenCalled();

      // 1. Presence
      listeners['presence:status']?.({ userId: 'u-2', status: 'online' });
      expect(useChatStore.getState().onlineUsers['u-2']).toBe(true);
      listeners['presence:status']?.({ userId: 'u-2', status: 'offline' });
      expect(useChatStore.getState().onlineUsers['u-2']).toBe(false);

      // 2. Typing start and stop
      listeners['typing:start']?.({ conversationId: 'c-1', userId: 'u-2', userName: 'Bob' });
      expect(useChatStore.getState().typingUsers['c-1']?.['u-2']?.name).toBe('Bob');
      // typing:start from self is ignored
      listeners['typing:start']?.({ conversationId: 'c-1', userId: 'u-1', userName: 'Alice' });
      expect(useChatStore.getState().typingUsers['c-1']?.['u-1']).toBeUndefined();
      // typing:stop
      listeners['typing:stop']?.({ conversationId: 'c-1', userId: 'u-2' });
      expect(useChatStore.getState().typingUsers['c-1']?.['u-2']).toBeUndefined();

      // 3. Message:new in background conversation (increments unread count)
      listeners['message:new']?.({
        id: 'msg-incoming-c2',
        conversationId: 'c-2',
        senderId: 'u-2',
        senderName: 'Bob',
        content: 'Oi devs',
      });
      const c2 = useChatStore.getState().conversations.find((c) => c.id === 'c-2');
      expect(c2?.unreadCount).toBe(1);

      // 4. Message:new in active conversation (marks read and doesn't increment unread)
      vi.mocked(api.post).mockResolvedValue({});
      listeners['message:new']?.({
        id: 'msg-incoming-c1',
        conversationId: 'c-1',
        senderId: 'u-2',
        senderName: 'Bob',
        content: 'Oi geral',
      });
      const c1 = useChatStore.getState().conversations.find((c) => c.id === 'c-1');
      expect(c1?.unreadCount).toBe(0);

      // 5. Message receipt update
      useChatStore.setState({
        messages: {
          'c-1': [{ id: 'm-mine', conversationId: 'c-1', senderId: 'u-1', content: 'Minha msg', isSelf: true, status: 'sent' } as any],
        },
      });
      listeners['message:receipt']?.({ conversationId: 'c-1', messageId: 'm-mine', status: 'read' });
      expect(useChatStore.getState().messages['c-1'][0].status).toBe('read');

      // 6. Poll updated and closed
      useChatStore.setState({
        messages: {
          'c-1': [
            {
              id: 'm-poll',
              conversationId: 'c-1',
              senderId: 'u-1',
              senderName: 'Alice',
              type: 'poll',
              content: 'Enquete',
              status: 'sent',
              createdAt: new Date().toISOString(),
              isSelf: true,
              metadata: {
                poll: { id: 'p-99', question: 'Opção?', options: [] } as any,
              },
            },
          ],
        },
      });
      const pollData: any = { id: 'p-99', conversationId: 'c-1', question: 'Opção Atualizada?', options: [] };
      listeners['poll:updated']?.(pollData);
      expect(useChatStore.getState().messages['c-1'][0].metadata?.poll?.question).toBe('Opção Atualizada?');

      const pollClosedData: any = { id: 'p-99', conversationId: 'c-1', question: 'Opção Fechada', status: 'closed', options: [] };
      listeners['poll:closed']?.(pollClosedData);
      expect(useChatStore.getState().messages['c-1'][0].metadata?.poll?.status).toBe('closed');
    });
  });

  describe('Store Error Handlers & Edge Cases', () => {
    it('account store handles errors on cancelSubscription and downgradePlan', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Falha no cancelamento'));
      await expect(useAccountStore.getState().cancelSubscription()).rejects.toThrow('Falha no cancelamento');
      expect(useAccountStore.getState().error).toBe('Falha no cancelamento');

      vi.mocked(api.post).mockRejectedValueOnce(new Error('Downgrade não autorizado'));
      await expect(useAccountStore.getState().downgradePlan('free')).rejects.toThrow('Downgrade não autorizado');
      expect(useAccountStore.getState().error).toBe('Downgrade não autorizado');

      vi.mocked(api.post).mockRejectedValueOnce(new Error('Erro no convite'));
      await expect(useAccountStore.getState().inviteMember('err@corp.com', 'member')).rejects.toThrow('Erro no convite');
      expect(useAccountStore.getState().error).toBe('Erro no convite');

      vi.mocked(api.post).mockRejectedValueOnce(new Error('Falha no pagamento'));
      await expect(useAccountStore.getState().subscribePlan({ targetPlan: 'pro', billingCycle: 'monthly', paymentMethod: 'pix' })).rejects.toThrow('Falha no pagamento');
      expect(useAccountStore.getState().error).toBe('Falha no pagamento');

      useAccountStore.getState().clearCheckoutResult();
      expect(useAccountStore.getState().checkoutResult).toBeNull();
      useAccountStore.getState().clearError();
      expect(useAccountStore.getState().error).toBeNull();
    });

    it('signature store handles downloadEvidenceCertificate and error states', async () => {
      window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      window.URL.revokeObjectURL = vi.fn();

      const originalFetch = global.fetch;
      // Success download
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['CERT PDF']),
      } as any);

      await useSignatureStore.getState().downloadEvidencePdf('sig-1', 'cert.pdf');
      expect(window.URL.createObjectURL).toHaveBeenCalled();

      // Error download
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Certificado não encontrado' }),
      } as any);

      await expect(
        useSignatureStore.getState().downloadEvidencePdf('sig-1', 'cert.pdf')
      ).rejects.toThrow('Certificado não encontrado');
      expect(useSignatureStore.getState().error).toBe('Certificado não encontrado');

      global.fetch = originalFetch;

      useSignatureStore.getState().setActiveSignature(null);
      expect(useSignatureStore.getState().activeSignature).toBeNull();
      useSignatureStore.getState().clearVerificationResult();
      expect(useSignatureStore.getState().verificationResult).toBeNull();
    });
  });

  describe('useSocketStore', () => {
    beforeEach(() => {
      useSocketStore.setState({ socket: null, isConnected: false });
      mockSocketInstance.connected = false;
      vi.clearAllMocks();
    });

    it('does nothing when connecting without accessToken', () => {
      useAuthStore.setState({ accessToken: null });
      useSocketStore.getState().connect();

      expect(useSocketStore.getState().socket).toBeNull();
      expect(useSocketStore.getState().isConnected).toBe(false);
    });

    it('creates socket and wires connect/disconnect/connect_error event listeners', () => {
      useAuthStore.setState({ accessToken: 'test-token-jwt' });
      useSocketStore.getState().connect();

      const socket = useSocketStore.getState().socket;
      expect(socket).not.toBeNull();
      expect(eventCallbacks['connect']).toBeDefined();
      expect(eventCallbacks['disconnect']).toBeDefined();
      expect(eventCallbacks['connect_error']).toBeDefined();

      // Trigger connect
      eventCallbacks['connect']();
      expect(useSocketStore.getState().isConnected).toBe(true);

      // Trigger disconnect
      eventCallbacks['disconnect']();
      expect(useSocketStore.getState().isConnected).toBe(false);

      // Trigger connect_error
      eventCallbacks['connect_error']();
      expect(useSocketStore.getState().isConnected).toBe(false);
    });

    it('returns early if existing socket is already connected', () => {
      useAuthStore.setState({ accessToken: 'token-active' });
      mockSocketInstance.connected = true;
      useSocketStore.setState({ socket: mockSocketInstance as any, isConnected: true });

      const prevSocket = useSocketStore.getState().socket;
      useSocketStore.getState().connect();

      expect(useSocketStore.getState().socket).toBe(prevSocket);
      expect(mockSocketInstance.disconnect).not.toHaveBeenCalled();
    });

    it('disconnects previous disconnected socket before re-establishing', () => {
      useAuthStore.setState({ accessToken: 'token-new' });
      mockSocketInstance.connected = false;
      const oldDisconnectMock = vi.fn();
      useSocketStore.setState({ socket: { ...mockSocketInstance, disconnect: oldDisconnectMock } as any });

      useSocketStore.getState().connect();
      expect(oldDisconnectMock).toHaveBeenCalled();
    });

    it('disconnect cleans up socket instance and resets connection state', () => {
      useSocketStore.setState({ socket: mockSocketInstance as any, isConnected: true });

      useSocketStore.getState().disconnect();

      expect(mockSocketInstance.disconnect).toHaveBeenCalled();
      expect(useSocketStore.getState().socket).toBeNull();
      expect(useSocketStore.getState().isConnected).toBe(false);
    });
  });
});
