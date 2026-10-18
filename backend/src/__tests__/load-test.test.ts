import { describe, it, expect } from 'vitest';
import { LoadTestService } from '../services/load-test.service';

describe('Load Testing Simulation & Bandwidth Cost Analysis (T-38)', () => {
  const loadTestService = new LoadTestService();

  it('successfully simulates 80 concurrent users with real-time messages and file transfers', async () => {
    const report = await loadTestService.runSimulation({
      concurrentUsers: 80,
      messagesPerUser: 4,
      filesPerUser: 2,
      averageFileSizeBytes: 1024 * 1024, // 1 MB
    });

    // 1. Scenario assertions
    expect(report.scenario.concurrentUsers).toBe(80);
    expect(report.scenario.totalMessagesSent).toBe(320); // 80 * 4
    expect(report.scenario.totalFilesTransferred).toBe(160); // 80 * 2
    expect(report.scenario.averageFileSizeKb).toBe(1024);

    // 2. Metrics & Reliability assertions
    expect(report.metrics.totalRequests).toBe(480); // 320 + 160
    expect(report.metrics.successfulRequests).toBe(480);
    expect(report.metrics.failedRequests).toBe(0);
    expect(report.metrics.errorRatePercent).toBe(0);
    expect(report.metrics.throughputReqSec).toBeGreaterThan(0);
    expect(report.metrics.throughputMessagesSec).toBeGreaterThan(0);

    // 3. Latency distribution assertions
    expect(report.metrics.latency.minMs).toBeGreaterThanOrEqual(0);
    expect(report.metrics.latency.p50Ms).toBeGreaterThanOrEqual(report.metrics.latency.minMs);
    expect(report.metrics.latency.p90Ms).toBeGreaterThanOrEqual(report.metrics.latency.p50Ms);
    expect(report.metrics.latency.p95Ms).toBeGreaterThanOrEqual(report.metrics.latency.p90Ms);
    expect(report.metrics.latency.p99Ms).toBeGreaterThanOrEqual(report.metrics.latency.p95Ms);
    expect(report.metrics.latency.maxMs).toBeGreaterThanOrEqual(report.metrics.latency.p99Ms);

    // 4. Bandwidth and Cost analysis assertions
    expect(report.bandwidth.totalDataTransferredMb).toBeGreaterThan(0);
    expect(report.bandwidth.peakThroughputMbps).toBeGreaterThan(0);
    expect(report.bandwidth.costAnalysis.awsS3EgressMonthlyBrl).toBeGreaterThan(0);
    expect(report.bandwidth.costAnalysis.cloudflareR2MonthlyBrl).toBeGreaterThan(0);
    expect(report.bandwidth.costAnalysis.nextMsgZeroRetentionSavingsPercent).toBeGreaterThanOrEqual(
      80
    );

    // 5. Bottlenecks and recommendations assertions
    expect(report.bottlenecksAndRecommendations.length).toBeGreaterThanOrEqual(5);
    expect(report.bottlenecksAndRecommendations.some((b) => b.includes('WebSocket'))).toBe(true);
    expect(report.bottlenecksAndRecommendations.some((b) => b.includes('Egress'))).toBe(true);
  });

  it('generates a complete, structured markdown report with cost tables and engineering recommendations', async () => {
    const report = await loadTestService.runSimulation({
      concurrentUsers: 80,
      messagesPerUser: 2,
      filesPerUser: 1,
    });

    const markdown = loadTestService.generateMarkdownReport(report);

    expect(markdown).toContain('# Relatório de Teste de Carga & Custo de Banda (T-38)');
    expect(markdown).toContain('80 Usuários Simultâneos Concorrentes');
    expect(markdown).toContain('Desempenho & Métricas de Latência');
    expect(markdown).toContain('Comparativo de Custos Mensais de Armazenamento e Egress');
    expect(markdown).toContain('AWS S3 Tradicional');
    expect(markdown).toContain('Cloudflare R2');
    expect(markdown).toContain('Diagnóstico de Gargalos & Recomendações de Engenharia');
    expect(markdown).toContain('Conclusão de Aceite do Ticket (T-38)');
  });
});
