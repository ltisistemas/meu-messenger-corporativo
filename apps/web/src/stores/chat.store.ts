import { create } from 'zustand';
import { api } from '../services/api';
import { useAuthStore } from './auth.store';
import { useSocketStore } from './socket.store';
import { PollDetailsResponse, BroadcastReportResponse } from '@corpchat/shared';

export interface Member {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: string;
}

export interface Conversation {
  id: string;
  accountId: string;
  type: 'direct' | 'group' | 'broadcast';
  title: string | null;
  retentionHours: number;
  status: 'active' | 'archived' | 'archived_readonly';
  isTemporary?: boolean;
  expiresAt?: string | null;
  isExpired?: boolean;
  createdAt: string;
  updatedAt: string;
  otherUser?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
  members?: Member[];
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    senderName?: string;
    createdAt: string;
  };
  unreadCount?: number;
}

export interface MessageReceipt {
  status: 'sent' | 'delivered' | 'read';
  userId: string;
  readAt?: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'audio' | 'system' | 'poll' | 'signature';
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  metadata?: {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    transferMethod?: string;
    deliveredToCount?: number;
    totalRecipientsCount?: number;
    deliverySummary?: string;
    isGroup?: boolean;
    isBroadcast?: boolean;
    broadcastMessageId?: string;
    poll?: PollDetailsResponse;
    signature?: any;
    [key: string]: any;
  } | null;
  retentionExpiresAt?: string | null;
  createdAt: string;
  status: 'sent' | 'delivered' | 'read';
  isSelf: boolean;
}

export interface CreateGroupOptions {
  title: string;
  memberIds?: string[];
  retentionHours?: number;
  isTemporary?: boolean;
  expiresInHours?: number;
  expiresAt?: string;
}

export interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  onlineUsers: Record<string, boolean>; // userId -> isOnline
  typingUsers: Record<string, Record<string, { name: string; timestamp: number }>>; // convId -> userId -> details
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  error: string | null;

  // Actions
  fetchConversations: () => Promise<void>;
  selectConversation: (conversationId: string) => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (content: string, type?: 'text' | 'file') => Promise<void>;
  sendFileRelay: (file: File, onProgress?: (percent: number) => void) => Promise<void>;
  createDirectConversation: (targetUserId: string) => Promise<string>;
  createGroupConversation: (
    titleOrOptions: string | CreateGroupOptions,
    memberIds?: string[],
    retentionHours?: number
  ) => Promise<string>;
  createBroadcast: (content: string) => Promise<any>;
  fetchBroadcastReport: (messageId: string) => Promise<BroadcastReportResponse>;
  createPoll: (data: {
    conversationId: string;
    question: string;
    options: string[];
    allowMultiple?: boolean;
    isAnonymous?: boolean;
    expiresInHours?: number;
  }) => Promise<PollDetailsResponse>;
  votePoll: (pollId: string, optionIds: string[]) => Promise<PollDetailsResponse>;
  closePoll: (pollId: string) => Promise<PollDetailsResponse>;
  markAsRead: (conversationId: string) => Promise<void>;
  sendTyping: (conversationId: string, isTyping: boolean) => void;
  initializeSocketListeners: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  onlineUsers: {},
  typingUsers: {},
  isLoadingConversations: false,
  isLoadingMessages: false,
  error: null,

  fetchConversations: async () => {
    set({ isLoadingConversations: true, error: null });
    try {
      const data = await api.get<Conversation[]>('/conversations');
      set({
        conversations: data,
        isLoadingConversations: false,
      });
    } catch (err: any) {
      set({ isLoadingConversations: false, error: err.message });
    }
  },

  selectConversation: async (conversationId: string) => {
    set({ activeConversationId: conversationId });
    // Clear unread count locally for responsive UI
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      ),
    }));

    await get().fetchMessages(conversationId);
    await get().markAsRead(conversationId);
  },

  fetchMessages: async (conversationId: string) => {
    set({ isLoadingMessages: true });
    try {
      const currentUser = useAuthStore.getState().user;
      const data = await api.get<any[]>(`/messages?conversationId=${conversationId}`);

      const formatted: Message[] = data.map((msg) => ({
        id: msg.id,
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        senderName: msg.sender?.name,
        content: msg.content,
        type: msg.type || 'text',
        attachmentUrl: msg.attachmentUrl || msg.metadata?.attachmentUrl,
        attachmentName: msg.attachmentName || msg.metadata?.fileName,
        attachmentSize: msg.attachmentSize || msg.metadata?.fileSize,
        metadata: msg.metadata || null,
        retentionExpiresAt: msg.retentionExpiresAt,
        createdAt: msg.createdAt,
        status: msg.receipts?.some((r: any) => r.status === 'read')
          ? 'read'
          : msg.receipts?.some((r: any) => r.status === 'delivered')
          ? 'delivered'
          : 'sent',
        isSelf: msg.senderId === currentUser?.id,
      }));


      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: formatted,
        },
        isLoadingMessages: false,
      }));
    } catch {
      set({ isLoadingMessages: false });
    }
  },

  sendMessage: async (content: string, type = 'text') => {
    const { activeConversationId } = get();
    const currentUser = useAuthStore.getState().user;
    if (!activeConversationId || !content.trim() || !currentUser) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      conversationId: activeConversationId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: content.trim(),
      type,
      createdAt: new Date().toISOString(),
      status: 'sent',
      isSelf: true,
    };

    // Optimistically insert message
    set((state) => ({
      messages: {
        ...state.messages,
        [activeConversationId]: [
          ...(state.messages[activeConversationId] || []),
          optimisticMsg,
        ],
      },
      conversations: state.conversations.map((c) =>
        c.id === activeConversationId
          ? {
              ...c,
              lastMessage: {
                id: tempId,
                content: content.trim(),
                senderId: currentUser.id,
                senderName: currentUser.name,
                createdAt: optimisticMsg.createdAt,
              },
              updatedAt: optimisticMsg.createdAt,
            }
          : c
      ),
    }));

    try {
      const savedMsg = await api.post('/messages', {
        conversationId: activeConversationId,
        content: content.trim(),
        type,
      });

      // Replace optimistic message with actual persisted data
      set((state) => ({
        messages: {
          ...state.messages,
          [activeConversationId]: (state.messages[activeConversationId] || []).map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  id: savedMsg.id,
                  retentionExpiresAt: savedMsg.retentionExpiresAt,
                }
              : m
          ),
        },
      }));
    } catch (err: any) {
      // Remove or mark as failed
      set((state) => ({
        messages: {
          ...state.messages,
          [activeConversationId]: (state.messages[activeConversationId] || []).filter(
            (m) => m.id !== tempId
          ),
        },
      }));
      throw err;
    }
  },

  sendFileRelay: async (
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<void> => {
    const { activeConversationId } = get();
    const socket = useSocketStore.getState().socket;
    const currentUser = useAuthStore.getState().user;

    if (!activeConversationId || !currentUser) {
      throw new Error('Nenhuma conversa selecionada ou usuário não autenticado.');
    }

    if (!socket || !socket.connected) {
      throw new Error('Conexão WebSocket indisponível para envio do arquivo.');
    }

    const transferId = crypto.randomUUID();
    const chunkSize = 64 * 1024; // 64 KB chunks
    const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));

    // 1. Init relay session
    await new Promise<void>((resolve, reject) => {
      socket.emit(
        'file:relay:init',
        {
          transferId,
          conversationId: activeConversationId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          totalChunks,
          chunkSize,
        },
        (res: any) => {
          if (res?.error) {
            const err: any = new Error(res.error);
            err.code = res.code;
            err.suggestCloudShare = res.suggestCloudShare;
            return reject(err);
          }
          resolve();
        }
      );
    });

    // 2. Stream binary chunks
    for (let index = 0; index < totalChunks; index++) {
      const start = index * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunkBlob = file.slice(start, end);
      const chunkBuffer = await chunkBlob.arrayBuffer();

      await new Promise<void>((resolve, reject) => {
        socket.emit(
          'file:relay:chunk',
          {
            transferId,
            chunkIndex: index,
            data: chunkBuffer,
          },
          (res: any) => {
            if (res?.error) {
              return reject(new Error(res.error));
            }
            resolve();
          }
        );
      });

      if (onProgress) {
        const percent = Math.round(((index + 1) / totalChunks) * 100);
        onProgress(percent);
      }
    }

    // 3. Complete relay
    await new Promise<void>((resolve, reject) => {
      socket.emit(
        'file:relay:complete',
        { transferId },
        (res: any) => {
          if (res?.error) {
            return reject(new Error(res.error));
          }
          resolve();
        }
      );
    });
  },

  createDirectConversation: async (targetUserId: string) => {

    const conv = await api.post('/conversations/direct', { targetUserId });
    await get().fetchConversations();
    await get().selectConversation(conv.id);
    return conv.id;
  },

  createGroupConversation: async (
    titleOrOptions: string | CreateGroupOptions,
    memberIds = [],
    retentionHours = 0
  ) => {
    let payload: any;
    if (typeof titleOrOptions === 'string') {
      payload = {
        title: titleOrOptions,
        memberIds,
        retentionHours,
      };
    } else {
      payload = titleOrOptions;
    }

    const conv = await api.post('/conversations/group', payload);
    await get().fetchConversations();
    await get().selectConversation(conv.id);
    return conv.id;
  },

  createBroadcast: async (content: string) => {
    const res = await api.post('/broadcasts', { content });
    await get().fetchConversations();
    if (res.conversationId) {
      await get().selectConversation(res.conversationId);
    }
    return res;
  },

  fetchBroadcastReport: async (messageId: string) => {
    return await api.get<BroadcastReportResponse>(`/broadcasts/${messageId}/report`);
  },

  createPoll: async (data: {
    conversationId: string;
    question: string;
    options: string[];
    allowMultiple?: boolean;
    isAnonymous?: boolean;
    expiresInHours?: number;
  }) => {
    const poll = await api.post<PollDetailsResponse>('/polls', data);
    return poll;
  },

  votePoll: async (pollId: string, optionIds: string[]) => {
    const updatedPoll = await api.post<PollDetailsResponse>(`/polls/${pollId}/vote`, {
      optionIds,
    });

    // Update local state immediately
    set((state) => {
      const convId = updatedPoll.conversationId;
      const convMessages = state.messages[convId] || [];
      const updatedMessages = convMessages.map((m) => {
        if (m.metadata?.poll?.id === pollId || m.type === 'poll') {
          return {
            ...m,
            metadata: {
              ...(m.metadata || {}),
              poll: updatedPoll,
            },
          };
        }
        return m;
      });

      return {
        messages: {
          ...state.messages,
          [convId]: updatedMessages,
        },
      };
    });

    return updatedPoll;
  },

  closePoll: async (pollId: string) => {
    const closedPoll = await api.post<PollDetailsResponse>(`/polls/${pollId}/close`);

    set((state) => {
      const convId = closedPoll.conversationId;
      const convMessages = state.messages[convId] || [];
      const updatedMessages = convMessages.map((m) => {
        if (m.metadata?.poll?.id === pollId || m.type === 'poll') {
          return {
            ...m,
            metadata: {
              ...(m.metadata || {}),
              poll: closedPoll,
            },
          };
        }
        return m;
      });

      return {
        messages: {
          ...state.messages,
          [convId]: updatedMessages,
        },
      };
    });

    return closedPoll;
  },

  markAsRead: async (conversationId: string) => {
    try {
      await api.post('/messages/read', { conversationId });
      const socket = useSocketStore.getState().socket;
      if (socket?.connected) {
        socket.emit('message:read', { conversationId });
      }
    } catch {
      // Silent error for read receipt
    }
  },

  sendTyping: (conversationId: string, isTyping: boolean) => {
    const socket = useSocketStore.getState().socket;
    if (socket?.connected) {
      socket.emit(isTyping ? 'typing:start' : 'typing:stop', { conversationId });
    }
  },

  initializeSocketListeners: () => {
    const socket = useSocketStore.getState().socket;
    if (!socket) return;

    socket.off('presence:status');
    socket.off('typing:start');
    socket.off('typing:stop');
    socket.off('message:new');
    socket.off('message:receipt');
    socket.off('poll:new');
    socket.off('poll:updated');
    socket.off('poll:closed');

    // 1. Online / Offline Presence
    socket.on('presence:status', (data: { userId: string; status: 'online' | 'offline' }) => {
      set((state) => ({
        onlineUsers: {
          ...state.onlineUsers,
          [data.userId]: data.status === 'online',
        },
      }));
    });

    // 2. Typing start
    socket.on('typing:start', (data: { conversationId: string; userId: string; userName?: string }) => {
      const currentUser = useAuthStore.getState().user;
      if (data.userId === currentUser?.id) return;

      set((state) => {
        const convTyping = state.typingUsers[data.conversationId] || {};
        return {
          typingUsers: {
            ...state.typingUsers,
            [data.conversationId]: {
              ...convTyping,
              [data.userId]: {
                name: data.userName || 'Alguém',
                timestamp: Date.now(),
              },
            },
          },
        };
      });
    });

    // 3. Typing stop
    socket.on('typing:stop', (data: { conversationId: string; userId: string }) => {
      set((state) => {
        const convTyping = { ...(state.typingUsers[data.conversationId] || {}) };
        delete convTyping[data.userId];
        return {
          typingUsers: {
            ...state.typingUsers,
            [data.conversationId]: convTyping,
          },
        };
      });
    });

    // 4. New incoming message
    socket.on('message:new', (msg: any) => {
      const currentUser = useAuthStore.getState().user;
      const isSelf = msg.senderId === currentUser?.id;
      const convId = msg.conversationId;

      const newMsg: Message = {
        id: msg.id,
        conversationId: convId,
        senderId: msg.senderId,
        senderName: msg.senderName || msg.sender?.name,
        content: msg.content,
        type: msg.type || 'text',
        attachmentUrl: msg.attachmentUrl || msg.metadata?.attachmentUrl,
        attachmentName: msg.attachmentName || msg.metadata?.fileName,
        attachmentSize: msg.attachmentSize || msg.metadata?.fileSize,
        metadata: msg.metadata || null,
        retentionExpiresAt: msg.retentionExpiresAt,
        createdAt: msg.createdAt || new Date().toISOString(),
        status: 'delivered',
        isSelf,
      };

      set((state) => {
        const currentConvMessages = state.messages[convId] || [];
        const alreadyExists = currentConvMessages.some((m) => m.id === msg.id);
        const isActive = state.activeConversationId === convId;

        const updatedMessages = alreadyExists
          ? currentConvMessages
          : [...currentConvMessages, newMsg];

        const updatedConversations = state.conversations.map((c) => {
          if (c.id === convId) {
            return {
              ...c,
              lastMessage: {
                id: msg.id,
                content: msg.content,
                senderId: msg.senderId,
                senderName: msg.senderName,
                createdAt: newMsg.createdAt,
              },
              unreadCount: isActive || isSelf ? 0 : (c.unreadCount || 0) + 1,
              updatedAt: newMsg.createdAt,
            };
          }
          return c;
        });

        // Re-sort conversations by most recent message
        updatedConversations.sort(
          (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
        );

        return {
          messages: {
            ...state.messages,
            [convId]: updatedMessages,
          },
          conversations: updatedConversations,
        };
      });

      // If active conversation, automatically acknowledge read
      if (get().activeConversationId === convId && !isSelf) {
        get().markAsRead(convId);
      }
    });

    // 5. Message Receipt update
    socket.on('message:receipt', (data: { messageId?: string; conversationId?: string; status: 'delivered' | 'read' }) => {
      set((state) => {
        const updated = { ...state.messages };
        if (data.conversationId && updated[data.conversationId]) {
          updated[data.conversationId] = updated[data.conversationId].map((m) =>
            m.isSelf ? { ...m, status: data.status } : m
          );
        }
        return { messages: updated };
      });
    });

    // 6. Poll updates & closure (T-26 / T-27)
    socket.on('poll:updated', (updatedPoll: PollDetailsResponse) => {
      set((state) => {
        const convId = updatedPoll.conversationId;
        const convMessages = state.messages[convId] || [];
        const updatedMessages = convMessages.map((m) => {
          if (m.metadata?.poll?.id === updatedPoll.id || (m.type === 'poll' && m.metadata?.poll?.id === updatedPoll.id)) {
            return {
              ...m,
              metadata: {
                ...(m.metadata || {}),
                poll: updatedPoll,
              },
            };
          }
          return m;
        });

        return {
          messages: {
            ...state.messages,
            [convId]: updatedMessages,
          },
        };
      });
    });

    socket.on('poll:closed', (closedPoll: PollDetailsResponse) => {
      set((state) => {
        const convId = closedPoll.conversationId;
        const convMessages = state.messages[convId] || [];
        const updatedMessages = convMessages.map((m) => {
          if (m.metadata?.poll?.id === closedPoll.id || (m.type === 'poll' && m.metadata?.poll?.id === closedPoll.id)) {
            return {
              ...m,
              metadata: {
                ...(m.metadata || {}),
                poll: closedPoll,
              },
            };
          }
          return m;
        });

        return {
          messages: {
            ...state.messages,
            [convId]: updatedMessages,
          },
        };
      });
    });
  },
}));
