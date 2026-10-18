import { MetricsResponse } from '@/shared';

export class MetricsService {
  private startTime: number = Date.now();
  private requestsTotal = 0;
  private statusCodes: Record<number, number> = {};
  private totalDurationMs = 0;
  private activeWsConnections = 0;
  private messagesSentTotal = 0;
  private filesTransferredTotal = 0;
  private signaturesCreatedTotal = 0;

  recordRequest(statusCode: number, durationMs: number): void {
    this.requestsTotal++;
    this.statusCodes[statusCode] = (this.statusCodes[statusCode] || 0) + 1;
    this.totalDurationMs += durationMs;
  }

  setWsConnections(count: number): void {
    this.activeWsConnections = Math.max(0, count);
  }

  incrementWsConnections(): void {
    this.activeWsConnections++;
  }

  decrementWsConnections(): void {
    if (this.activeWsConnections > 0) {
      this.activeWsConnections--;
    }
  }

  incrementMessages(): void {
    this.messagesSentTotal++;
  }

  incrementFiles(): void {
    this.filesTransferredTotal++;
  }

  incrementSignatures(): void {
    this.signaturesCreatedTotal++;
  }

  getMetrics(): MetricsResponse {
    const memory = process.memoryUsage();
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const averageLatencyMs =
      this.requestsTotal > 0
        ? Math.round((this.totalDurationMs / this.requestsTotal) * 100) / 100
        : 0;

    return {
      uptimeSeconds,
      http: {
        requestsTotal: this.requestsTotal,
        statusCodes: this.statusCodes,
        averageLatencyMs,
      },
      realtime: {
        activeWsConnections: this.activeWsConnections,
        messagesSentTotal: this.messagesSentTotal,
        filesTransferredTotal: this.filesTransferredTotal,
        signaturesCreatedTotal: this.signaturesCreatedTotal,
      },
      system: {
        heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
        rssMb: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
      },
    };
  }

  getPrometheusFormat(): string {
    const m = this.getMetrics();
    const lines: string[] = [
      `# HELP process_uptime_seconds Total seconds the process has been active.`,
      `# TYPE process_uptime_seconds gauge`,
      `process_uptime_seconds ${m.uptimeSeconds}`,
      `# HELP http_requests_total Total number of HTTP requests processed.`,
      `# TYPE http_requests_total counter`,
      `http_requests_total ${m.http.requestsTotal}`,
      `# HELP http_request_duration_average_ms Average duration of HTTP requests in milliseconds.`,
      `# TYPE http_request_duration_average_ms gauge`,
      `http_request_duration_average_ms ${m.http.averageLatencyMs}`,
      `# HELP realtime_active_ws_connections Current number of active WebSocket connections.`,
      `# TYPE realtime_active_ws_connections gauge`,
      `realtime_active_ws_connections ${m.realtime.activeWsConnections}`,
      `# HELP realtime_messages_total Total count of messages sent.`,
      `# TYPE realtime_messages_total counter`,
      `realtime_messages_total ${m.realtime.messagesSentTotal}`,
      `# HELP realtime_files_total Total count of files transferred.`,
      `# TYPE realtime_files_total counter`,
      `realtime_files_total ${m.realtime.filesTransferredTotal}`,
      `# HELP realtime_signatures_total Total count of electronic signatures created.`,
      `# TYPE realtime_signatures_total counter`,
      `realtime_signatures_total ${m.realtime.signaturesCreatedTotal}`,
      `# HELP process_heap_used_bytes Total heap memory used in bytes.`,
      `# TYPE process_heap_used_bytes gauge`,
      `process_heap_used_bytes ${process.memoryUsage().heapUsed}`,
    ];

    Object.entries(m.http.statusCodes).forEach(([code, count]) => {
      lines.push(`http_requests_status_total{code="${code}"} ${count}`);
    });

    return lines.join('\n') + '\n';
  }

  reset(): void {
    this.startTime = Date.now();
    this.requestsTotal = 0;
    this.statusCodes = {};
    this.totalDurationMs = 0;
    this.activeWsConnections = 0;
    this.messagesSentTotal = 0;
    this.filesTransferredTotal = 0;
    this.signaturesCreatedTotal = 0;
  }
}

export const defaultMetricsService = new MetricsService();

