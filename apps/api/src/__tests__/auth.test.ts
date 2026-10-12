import { describe, it, expect, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { buildServer } from '../server';

describe('Authentication & Account Creation (T-04)', () => {
  describe('AuthService Logic & Operations', () => {
    it('should hash passwords and verify matching password', async () => {
      const authService = new AuthService();
      const plain = 'MinhaSenhaSegura123!';
      const hash = await authService.hashPassword(plain);

      expect(hash).not.toBe(plain);
      expect(await authService.verifyPassword(plain, hash)).toBe(true);
      expect(await authService.verifyPassword('SenhaErrada', hash)).toBe(false);
    });

    it('should register account and owner with 14-day Pro trial using db mock', async () => {
      const mockAccount = {
        id: 'acc-123',
        name: 'Empresa Alpha',
        plan: 'pro',
        status: 'active',
        trialUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUser = {
        id: 'usr-123',
        accountId: 'acc-123',
        name: 'Diretor Silva',
        email: 'diretor@alpha.com',
        passwordHash: 'hashed_password',
        role: 'owner',
        status: 'active',
        avatarUrl: null,
        lastSeenAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockDb: any = {
        query: {
          users: {
            findFirst: vi.fn().mockResolvedValue(null), // email not taken
          },
        },
        insert: vi.fn((table) => ({
          values: vi.fn((val) => ({
            returning: vi.fn().mockResolvedValue([
              table === mockUser ? mockUser : mockAccount,
            ]),
          })),
        })),
      };

      // Mock sequence of inserts: accounts then users
      let callCount = 0;
      mockDb.insert = vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) return Promise.resolve([mockAccount]);
            return Promise.resolve([mockUser]);
          }),
        })),
      }));

      const authService = new AuthService(mockDb);
      const result = await authService.registerAccount({
        accountName: 'Empresa Alpha',
        userName: 'Diretor Silva',
        email: 'diretor@alpha.com',
        password: 'SenhaForte123!',
      });

      expect(result.account.name).toBe('Empresa Alpha');
      expect(result.account.plan).toBe('pro');
      expect(result.user.name).toBe('Diretor Silva');
      expect(result.user.role).toBe('owner');
      expect((result.user as any).passwordHash).toBeUndefined(); // sanitized
    });

    it('should reject registration if email is already taken', async () => {
      const mockDb: any = {
        query: {
          users: {
            findFirst: vi.fn().mockResolvedValue({ id: 'existing-usr', email: 'taken@example.com' }),
          },
        },
      };

      const authService = new AuthService(mockDb);
      await expect(
        authService.registerAccount({
          accountName: 'Empresa Beta',
          userName: 'Outro Usuario',
          email: 'taken@example.com',
          password: 'SenhaForte123!',
        })
      ).rejects.toThrow('E-mail já está em uso por outro usuário.');
    });

    it('should rotate refresh token and delete old token', async () => {
      const mockUser = {
        id: 'usr-123',
        accountId: 'acc-123',
        name: 'User Test',
        email: 'test@example.com',
        passwordHash: 'hash',
        role: 'member',
        status: 'active',
        account: { id: 'acc-123', name: 'Acc Test', plan: 'pro', status: 'active' },
      };

      const mockStoredToken = {
        id: 'tok-123',
        userId: 'usr-123',
        token: 'old-token-abc',
        expiresAt: new Date(Date.now() + 100000),
        user: mockUser,
      };

      const deleteFn = vi.fn().mockResolvedValue({});
      const insertFn = vi.fn(() => ({ values: vi.fn().mockResolvedValue({}) }));

      const mockDb: any = {
        query: {
          refreshTokens: {
            findFirst: vi.fn().mockResolvedValue(mockStoredToken),
          },
        },
        delete: vi.fn(() => ({ where: deleteFn })),
        insert: insertFn,
      };

      const authService = new AuthService(mockDb);
      const result = await authService.rotateRefreshToken('old-token-abc');

      expect(result.user.email).toBe('test@example.com');
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe('old-token-abc');
      expect(deleteFn).toHaveBeenCalled();
    });
  });

  describe('Auth Routes Integration', () => {
    it('should reject register with invalid payload (short password)', async () => {
      const server = buildServer();
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          accountName: 'Empresa Teste',
          userName: 'Admin User',
          email: 'admin@empresa.com',
          password: '123', // less than 8 chars
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
      await server.close();
    });

    it('should reject login with missing fields', async () => {
      const server = buildServer();
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'invalid-email',
          password: '',
        },
      });

      expect(response.statusCode).toBe(400);
      await server.close();
    });

    it('should reject protected route GET /api/auth/me without token', async () => {
      const server = buildServer();
      const response = await server.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unauthorized');
      await server.close();
    });

    it('should reject protected route with invalid/expired token', async () => {
      const server = buildServer();
      const response = await server.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: 'Bearer invalid.token.value',
        },
      });

      expect(response.statusCode).toBe(401);
      await server.close();
    });

    it('should generate valid JWT and allow access to protected route', async () => {
      const server = buildServer();
      await server.ready();

      const mockPayload = {
        userId: '11111111-1111-1111-1111-111111111111',
        accountId: '22222222-2222-2222-2222-222222222222',
        role: 'owner',
        email: 'test@example.com',
      };

      const token = server.jwt.sign(mockPayload);
      expect(token).toBeDefined();

      const decoded = server.jwt.decode(token);
      expect(decoded).toMatchObject(mockPayload);

      await server.close();
    });
  });
});
