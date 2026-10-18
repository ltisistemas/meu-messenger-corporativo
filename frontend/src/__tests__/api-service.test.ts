import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError } from '../services/api';

describe('ApiClient Unit Tests (src/services/api.ts)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('instantiates ApiError correctly with status, message and data', () => {
    const err = new ApiError('Not found', 404, { code: 'NOT_FOUND' });
    expect(err.name).toBe('ApiError');
    expect(err.message).toBe('Not found');
    expect(err.status).toBe(404);
    expect(err.data).toEqual({ code: 'NOT_FOUND' });
  });

  it('performs GET request without params or auth token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ hello: 'world' }),
    } as any);

    const result = await api.get('/test');
    expect(result).toEqual({ hello: 'world' });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    );
  });

  it('appends query parameters correctly in GET request', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ count: 5 }),
    } as any);

    await api.get('items', { params: { limit: 10, offset: 20, active: true, empty: undefined } });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/items?limit=10&offset=20&active=true',
      expect.anything()
    );
  });

  it('includes Authorization header when token is in localStorage', async () => {
    localStorage.setItem(
      'corpchat_auth',
      JSON.stringify({ state: { accessToken: 'valid-jwt', refreshToken: 'valid-refresh' } })
    );

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ authenticated: true }),
    } as any);

    await api.get('/me');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer valid-jwt',
        }),
      })
    );
  });

  it('handles corrupted localStorage JSON gracefully without throwing in getTokens', async () => {
    localStorage.setItem('corpchat_auth', 'invalid-json');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ ok: true }),
    } as any);

    const res = await api.get('/test');
    expect(res).toEqual({ ok: true });
  });

  it('performs POST, PUT, PATCH and DELETE methods correctly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true }),
    } as any);

    await api.post('/resource', { name: 'Item' });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/resource',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Item' }) })
    );

    await api.put('/resource/1', { name: 'Updated' });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/resource/1',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ name: 'Updated' }) })
    );

    await api.patch('/resource/1', { active: false });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/resource/1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ active: false }) })
    );

    await api.delete('/resource/1');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/resource/1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('handles network failure throwing ApiError with status 0', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    await expect(api.get('/offline')).rejects.toThrow('Network offline');
  });

  it('handles HTTP error with json error message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      headers: { get: () => 'application/json' },
      json: async () => ({ message: 'Campo email é inválido.' }),
    } as any);

    await expect(api.post('/register', {})).rejects.toThrow('Campo email é inválido.');
  });

  it('handles HTTP error with text response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: { get: () => 'text/plain' },
      text: async () => 'Internal Error',
    } as any);

    await expect(api.get('/error')).rejects.toThrow('Erro HTTP 500: Internal Server Error');
  });

  it('refreshes token on 401 when refreshToken is present and retries request', async () => {
    localStorage.setItem(
      'corpchat_auth',
      JSON.stringify({ state: { accessToken: 'old-token', refreshToken: 'valid-refresh' } })
    );

    const mockFetch = vi.fn();
    // 1st call: 401 Unauthorized
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: { get: () => 'application/json' },
      json: async () => ({ message: 'Token expirado' }),
    });
    // 2nd call: POST /auth/refresh succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ accessToken: 'new-token', refreshToken: 'new-refresh' }),
    });
    // 3rd call: retried original request with new token succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ data: 'secret' }),
    });

    global.fetch = mockFetch;

    const res = await api.get('/protected-resource');
    expect(res).toEqual({ data: 'secret' });

    // Verify localStorage was updated with new token
    const stored = JSON.parse(localStorage.getItem('corpchat_auth')!);
    expect(stored.state.accessToken).toBe('new-token');
    expect(stored.state.refreshToken).toBe('new-refresh');
  });
});
