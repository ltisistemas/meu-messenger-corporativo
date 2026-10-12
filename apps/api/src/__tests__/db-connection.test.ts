import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import pg from 'pg';

describe('Database Connection & Serverless Pool Resilience (Ticket 03)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('detects Prisma Postgres url and configures SSL with rejectUnauthorized: false', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@db.prisma.io:5432/postgres?sslmode=require';
    delete process.env.VERCEL;

    const dbModule = await import('../db/index.js');
    expect(dbModule.pool).toBeDefined();
    // Verify ssl property is defined on pool options
    expect((dbModule.pool as any).options.ssl).toEqual({ rejectUnauthorized: false });
    expect((dbModule.pool as any).options.max).toBe(20);
  });

  it('restricts pool max to 5 connections in Vercel serverless environment', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@db.prisma.io:5432/postgres?sslmode=require';
    process.env.VERCEL = '1';

    const dbModule = await import('../db/index.js');
    expect((dbModule.pool as any).options.max).toBe(5);
  });

  it('falls back to POSTGRES_URL or PRISMA_DATABASE_URL if DATABASE_URL is not set', async () => {
    process.env.DATABASE_URL = '';
    process.env.POSTGRES_URL = '';
    process.env.PRISMA_DATABASE_URL = 'postgres://user:pass@db.prisma.io:5432/postgres?sslmode=require';

    const dbModule = await import('../db/index.js');
    expect((dbModule.pool as any).options.connectionString).toBe(process.env.PRISMA_DATABASE_URL);
  });

  it('attaches error handler on pool to prevent process crash on network interruptions', async () => {
    const dbModule = await import('../db/index.js');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Emitting error should not throw unhandled exception
    dbModule.pool.emit('error', new Error('Simulated network disconnect'));

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[PG Pool Error]'));
    warnSpy.mockRestore();
  });
});
