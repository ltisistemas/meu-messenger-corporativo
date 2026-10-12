import React, { useState, useEffect } from 'react';
import {
  CheckCheck,
  Check,
  Clock,
  Search,
  Users,
  Radio,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { BroadcastReportResponse } from '@corpchat/shared';
import { useChatStore } from '../../stores/chat.store';

export interface BroadcastReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
}

export const BroadcastReportModal: React.FC<BroadcastReportModalProps> = ({
  isOpen,
  onClose,
  messageId,
}) => {
  const fetchBroadcastReport = useChatStore((s) => s.fetchBroadcastReport);

  const [report, setReport] = useState<BroadcastReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'read' | 'delivered' | 'sent'>('all');

  const loadReport = async () => {
    if (!messageId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchBroadcastReport(messageId);
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar relatório de transmissão.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadReport();
    } else {
      setReport(null);
      setError(null);
    }
  }, [isOpen, messageId]);

  const filteredRecipients = (report?.recipients || []).filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      r.email.toLowerCase().includes(searchFilter.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'read') return r.status === 'read';
    if (statusFilter === 'delivered') return r.status === 'delivered';
    if (statusFilter === 'sent') return r.status === 'sent';
    return true;
  });

  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return `${date.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} às ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return '-';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Relatório de Entrega da Transmissão">
      <div className="space-y-4">
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-brand-500" />
            <span>Carregando métricas de transmissão em tempo real...</span>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
            <Button size="sm" variant="outline" onClick={loadReport}>
              Tentar novamente
            </Button>
          </div>
        ) : report ? (
          <>
            {/* Header info */}
            <div className="p-3.5 rounded-xl bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-brand-500 text-white shadow-sm">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-brand-700 dark:text-brand-300 uppercase tracking-wider">
                    Transmissão Corporativa
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Disparada em {formatDateTime(report.sentAt)}
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={loadReport}
                title="Atualizar dados"
                className="text-xs text-brand-600 dark:text-brand-400"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Atualizar
              </Button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>Destinatários</span>
                </div>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {report.summary.totalRecipients}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40">
                <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 mb-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Entregues</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                    {report.summary.deliveredCount}
                  </p>
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                    ({report.summary.deliveryRatePercent}%)
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 mb-1">
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Lidos</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                    {report.summary.readCount}
                  </p>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    ({report.summary.readRatePercent}%)
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Pendentes</span>
                </div>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                  {report.summary.pendingCount}
                </p>
              </div>
            </div>

            {/* Visual Rate Bars */}
            <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <div>
                <div className="flex justify-between text-xs font-medium mb-1 text-slate-700 dark:text-slate-300">
                  <span>Taxa de Leitura Global</span>
                  <span className="font-bold">{report.summary.readRatePercent}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${report.summary.readRatePercent}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1 text-slate-700 dark:text-slate-300">
                  <span>Taxa de Entrega de Mensagem</span>
                  <span className="font-bold">{report.summary.deliveryRatePercent}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${report.summary.deliveryRatePercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Recipient Breakdown Header & Filter */}
            <div className="space-y-2 pt-2">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filtrar por nome ou e-mail..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>

                <div className="flex items-center gap-1">
                  {(['all', 'read', 'delivered', 'sent'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setStatusFilter(filter)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg capitalize transition ${
                        statusFilter === filter
                          ? 'bg-brand-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {filter === 'all'
                        ? 'Todos'
                        : filter === 'read'
                        ? 'Lidos'
                        : filter === 'delivered'
                        ? 'Entregues'
                        : 'Pendentes'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipient List Table */}
              <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredRecipients.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    Nenhum colaborador encontrado com esse filtro.
                  </div>
                ) : (
                  filteredRecipients.map((rec) => (
                    <div
                      key={rec.userId}
                      className="p-2.5 px-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {rec.name}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">{rec.email}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {rec.status === 'read' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 text-[11px]">
                            <CheckCheck className="w-3 h-3 text-emerald-500" />
                            Lido {rec.readAt ? formatDateTime(rec.readAt) : ''}
                          </span>
                        ) : rec.status === 'delivered' ? (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 text-[11px]">
                            <Check className="w-3 h-3 text-blue-500" />
                            Entregue
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 text-[11px]">
                            <Clock className="w-3 h-3 text-amber-500" />
                            Pendente (offline)
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : null}

        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
};
