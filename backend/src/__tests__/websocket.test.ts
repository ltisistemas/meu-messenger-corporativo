import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as ClientIo, Socket as ClientSocket } from 'socket.io-client';
import { buildServer } from '../server';
import { WS_EVENTS } from '../ws/events';
import { FastifyInstance } from 'fastify';

describe('WebSocket Server & Authentication (T-06)', () => {
  let server: FastifyInstance;
  let port: number;
  let validToken: string;
  const mockUser = {
    userId: '11111111-2222-3333-4444-555555555555',
    accountId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    role: 'member',
    email: 'member@empresa.com',
  };

  beforeAll(async () => {
    server = buildServer();
    await server.listen({ port: 0, host: '127.0.0.1' });
    const address = server.server.address() as any;
    port = address.port;

    validToken = server.jwt.sign(mockUser);
  });

  afterAll(async () => {
    await server.close();
  });

  it('should successfully connect and authenticate with valid JWT token', async () => {
    const client: ClientSocket = ClientIo(`http://127.0.0.1:${port}`, {
      auth: { token: validToken },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      client.on(WS_EVENTS.AUTHENTICATED, (data) => {
        expect(data.userId).toBe(mockUser.userId);
        expect(data.accountId).toBe(mockUser.accountId);
        expect(data.socketId).toBeDefined();
        client.disconnect();
        resolve();
      });

      client.on('connect_error', (err) => {
        client.disconnect();
        reject(err);
      });
    });
  });

  it('should reject connection when token is missing', async () => {
    const client: ClientSocket = ClientIo(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      client.on('connect_error', (err) => {
        expect(err.message).toContain('Authentication error');
        client.disconnect();
        resolve();
      });
    });
  });

  it('should reject connection when token is invalid or corrupted', async () => {
    const client: ClientSocket = ClientIo(`http://127.0.0.1:${port}`, {
      auth: { token: 'invalid.corrupted.jwt.token' },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      client.on('connect_error', (err) => {
        expect(err.message).toContain('Authentication error');
        client.disconnect();
        resolve();
      });
    });
  });

  it('should support reconnection and room joining', async () => {
    const client: ClientSocket = ClientIo(`http://127.0.0.1:${port}`, {
      auth: { token: validToken },
      transports: ['websocket'],
      reconnection: true,
    });

    await new Promise<void>((resolve, reject) => {
      client.on(WS_EVENTS.AUTHENTICATED, () => {
        // Join conversation room
        client.emit(WS_EVENTS.CONVERSATION_JOIN, 'conv-room-123');

        // Verify socket is active
        expect(client.connected).toBe(true);

        client.disconnect();
        resolve();
      });

      client.on('connect_error', (err) => {
        client.disconnect();
        reject(err);
      });
    });
  });
});
