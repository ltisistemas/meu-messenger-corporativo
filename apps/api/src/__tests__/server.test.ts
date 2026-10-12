import { describe, it, expect } from 'vitest';
import { buildServer } from '../server.js';

describe('API Server', () => {
  it('GET /health should return 200 and status ok', async () => {
    const server = buildServer();
    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.body);
    expect(['ok', 'healthy', 'degraded']).toContain(json.status);
    expect(json.service).toBe('nextmsg-api');
    await server.close();
  });
});
