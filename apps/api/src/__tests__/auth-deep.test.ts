import { describe, it, expect, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { db } from '../db/index';
import { buildServer } from '../server';

describe('AuthService Deep Branch Coverage', () => {
  it('login rejects inactive user and suspended account', async () => {
    // 1. Inactive user
    const mockDbInactive: any = {
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'u-1',
            email: 'inactive@corp.com',
            status: 'inactive',
            account: { status: 'active' },
          }),
        },
      },
    };
    const authService1 = new AuthService(mockDbInactive);
    await expect(
      authService1.login({ email: 'inactive@corp.com', password: 'password123' })
    ).rejects.toThrow('Usuário inativo. Entre em contato com o administrador.');

    // 2. Suspended account
    const mockDbSuspended: any = {
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'u-2',
            email: 'user@suspended.com',
            status: 'active',
            account: { status: 'suspended' },
          }),
        },
      },
    };
    const authService2 = new AuthService(mockDbSuspended);
    await expect(
      authService2.login({ email: 'user@suspended.com', password: 'password123' })
    ).rejects.toThrow('Esta conta está suspensa. Entre em contato com o suporte.');

    // 3. Password mismatch
    const mockDbMismatch: any = {
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'u-3',
            email: 'user@mismatch.com',
            status: 'active',
            passwordHash: 'different-hash',
            account: { status: 'active' },
          }),
        },
      },
    };
    const authService3 = new AuthService(mockDbMismatch);
    vi.spyOn(authService3, 'verifyPassword').mockResolvedValueOnce(false);
    await expect(
      authService3.login({ email: 'user@mismatch.com', password: 'wrong' })
    ).rejects.toThrow('Credenciais inválidas.');

    // 4. User not found
    const mockDbNotFound: any = {
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    };
    const authService4 = new AuthService(mockDbNotFound);
    await expect(
      authService4.login({ email: 'notfound@corp.com', password: 'wrong' })
    ).rejects.toThrow('Credenciais inválidas.');
  });

  it('rotateRefreshToken rejects expired or missing token and revokes token', async () => {
    const mockDb: any = {
      query: {
        refreshTokens: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      delete: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    };

    const authService = new AuthService(mockDb);
    await expect(authService.rotateRefreshToken('invalid-token')).rejects.toThrow(
      'Refresh token inválido ou expirado.'
    );

    await authService.revokeRefreshToken('token-to-revoke');
    expect(mockDb.delete).toHaveBeenCalled();
  });
});

describe('Auth HTTP Routes Error & Edge Branches (/api/auth)', () => {
  it('POST /api/auth/register handles invalid payload, general error, DB refusal and success', async () => {
    const app = buildServer();
    await app.ready();

    // 400 Bad payload
    const bad = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'bad' },
    });
    expect(bad.statusCode).toBe(400);

    // 503 DB connection refused
    vi.spyOn(AuthService.prototype, 'registerAccount').mockRejectedValueOnce(
      new Error('connect ECONNREFUSED 127.0.0.1:5432')
    );
    const dbErr = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        accountName: 'Corp DB Err',
        userName: 'Admin',
        email: 'admin@db.com',
        password: 'password123',
      },
    });
    expect(dbErr.statusCode).toBe(503);
    expect(JSON.parse(dbErr.payload).error).toBe('Service Unavailable');

    // 400 Generic register error
    vi.spyOn(AuthService.prototype, 'registerAccount').mockRejectedValueOnce(
      new Error('Este email já está em uso.')
    );
    const genErr = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        accountName: 'Corp Dup',
        userName: 'Admin',
        email: 'dup@corp.com',
        password: 'password123',
      },
    });
    expect(genErr.statusCode).toBe(400);
    expect(JSON.parse(genErr.payload).message).toBe('Este email já está em uso.');

    // 201 Success
    vi.spyOn(AuthService.prototype, 'registerAccount').mockResolvedValueOnce({
      user: { id: 'u-reg', name: 'Admin', email: 'admin@corp.com', role: 'owner' } as any,
      rawUser: { id: 'u-reg', name: 'Admin', email: 'admin@corp.com', role: 'owner' } as any,
      account: { id: 'acc-reg', name: 'Corp', plan: 'free', status: 'active' } as any,
    });
    vi.spyOn(AuthService.prototype, 'createRefreshToken').mockResolvedValueOnce('tok-refresh-reg');

    const good = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        accountName: 'Corp Good',
        userName: 'Admin',
        email: 'admin@good.com',
        password: 'password123',
      },
    });
    expect(good.statusCode).toBe(201);
    const parsed = JSON.parse(good.payload);
    expect(parsed.accessToken).toBeDefined();
    expect(parsed.refreshToken).toBe('tok-refresh-reg');

    await app.close();
  });

  it('POST /api/auth/login handles invalid payload, DB error, generic error and success', async () => {
    const app = buildServer();
    await app.ready();

    // 400 Bad payload
    const bad = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'bad', password: '' },
    });
    expect(bad.statusCode).toBe(400);

    // 503 DB connection refused
    vi.spyOn(AuthService.prototype, 'login').mockRejectedValueOnce(
      new Error('connect ECONNREFUSED 127.0.0.1:5432')
    );
    const dbErr = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@db.com', password: 'password123' },
    });
    expect(dbErr.statusCode).toBe(503);

    // 401 Generic login failure
    vi.spyOn(AuthService.prototype, 'login').mockRejectedValueOnce(
      new Error('Credenciais inválidas.')
    );
    const badCreds = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@db.com', password: 'wrong' },
    });
    expect(badCreds.statusCode).toBe(401);

    // 200 Success
    vi.spyOn(AuthService.prototype, 'login').mockResolvedValueOnce({
      user: { id: 'u-log', name: 'User', email: 'user@corp.com', role: 'member' } as any,
      rawUser: { id: 'u-log', name: 'User', email: 'user@corp.com', role: 'member' } as any,
      account: { id: 'acc-log', name: 'Corp', plan: 'pro', status: 'active' } as any,
    });
    vi.spyOn(AuthService.prototype, 'createRefreshToken').mockResolvedValueOnce('tok-refresh-log');

    const good = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'user@corp.com', password: 'password123' },
    });
    expect(good.statusCode).toBe(200);
    const parsed = JSON.parse(good.payload);
    expect(parsed.accessToken).toBeDefined();
    expect(parsed.refreshToken).toBe('tok-refresh-log');

    await app.close();
  });

  it('POST /api/auth/refresh and /logout handle missing, invalid and rotated tokens', async () => {
    const app = buildServer();
    await app.ready();

    // Refresh missing token -> 400
    const noToken = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: {},
    });
    expect(noToken.statusCode).toBe(400);

    // Refresh invalid token -> 401
    const badToken = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: 'unknown-token' },
    });
    expect(badToken.statusCode).toBe(401);

    // Refresh success -> 200
    vi.spyOn(AuthService.prototype, 'rotateRefreshToken').mockResolvedValueOnce({
      user: { id: 'u-rot', name: 'Rotated', email: 'r@corp.com', role: 'member' } as any,
      rawUser: { id: 'u-rot', name: 'Rotated', email: 'r@corp.com', role: 'member' } as any,
      account: { id: 'acc-rot', name: 'Corp', plan: 'pro', status: 'active' } as any,
      refreshToken: 'tok-rotated-new',
    });

    const goodRefresh = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: 'tok-valid' },
    });
    expect(goodRefresh.statusCode).toBe(200);
    const parsedRef = JSON.parse(goodRefresh.payload);
    expect(parsedRef.accessToken).toBeDefined();
    expect(parsedRef.refreshToken).toBe('tok-rotated-new');

    // Logout with token -> 200
    vi.spyOn(AuthService.prototype, 'revokeRefreshToken').mockResolvedValue(undefined as any);
    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      payload: { refreshToken: 'any-token' },
    });
    expect(logout.statusCode).toBe(200);

    // Logout without token -> 200
    const logoutEmpty = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      payload: {},
    });
    expect(logoutEmpty.statusCode).toBe(200);

    await app.close();
  });

  it('GET /api/auth/me handles unauthenticated, not found and authenticated success', async () => {
    const app = buildServer();
    await app.ready();

    // 401 Unauthenticated
    const noAuth = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });
    expect(noAuth.statusCode).toBe(401);

    const token = app.jwt.sign({
      userId: 'u-me-1',
      accountId: 'acc-me-1',
      role: 'member',
      email: 'me@corp.com',
    });

    // 404 User not found in DB
    vi.spyOn(db.query.users, 'findFirst').mockImplementationOnce(async (options: any) => {
      if (typeof options?.where === 'function') {
        options.where({ id: 'u-me-1' }, { eq: (a: any, b: any) => a === b });
      }
      return null;
    });

    const notFound = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(notFound.statusCode).toBe(404);

    // 200 User found
    vi.spyOn(db.query.users, 'findFirst').mockResolvedValueOnce({
      id: 'u-me-1',
      name: 'User Me',
      email: 'me@corp.com',
      role: 'member',
      passwordHash: 'secret-hash',
      account: { id: 'acc-me-1', name: 'Corp Me' },
    } as any);

    const found = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(found.statusCode).toBe(200);
    const parsed = JSON.parse(found.payload);
    expect(parsed.user.id).toBe('u-me-1');
    expect(parsed.user.passwordHash).toBeUndefined();
    expect(parsed.account.id).toBe('acc-me-1');

    await app.close();
  });
});
