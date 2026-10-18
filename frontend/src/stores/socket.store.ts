import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './auth.store';

export interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,

  connect: () => {
    const { accessToken } = useAuthStore.getState();
    const existingSocket = get().socket;

    if (existingSocket?.connected) return;

    if (existingSocket) {
      existingSocket.disconnect();
    }

    if (!accessToken) return;

    const envWsUrl =
      (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_WS_URL : undefined) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_WS_URL);

    const envApiUrl =
      (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_API_URL : undefined) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL);

    const fallbackUrl = envApiUrl
      ? envApiUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '')
      : typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:3001';

    const socketUrl = envWsUrl || fallbackUrl || 'http://localhost:3001';

    const newSocket = io(socketUrl, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on('connect', () => {
      set({ isConnected: true });
    });

    newSocket.on('disconnect', () => {
      set({ isConnected: false });
    });

    newSocket.on('connect_error', () => {
      set({ isConnected: false });
    });

    set({ socket: newSocket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },
}));
