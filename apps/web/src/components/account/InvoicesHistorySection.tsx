import React, { useState } from 'react';
import { FileText, ExternalLink, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { BillingSummaryResponse } from '@corpchat/shared';

export interface InvoicesHistorySectionProps {
  billingSummary: BillingSummaryResponse | null;
  onCancelSubscription: () => Promise<void>;
  isLoading?: boolean;
}

export const InvoicesHistorySection: React.FC<InvoicesHistorySectionProps> = ({
  billingSummary,
  onCancelSubscription,
  isLoading = false,
}) => {
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const sub = billingSummary?.subscription;
  const invoices = billingSummary?.invoices || [];

  const handleCancel = async () => {
    await onCancelSubscription();
    setIsConfirmingCancel(false);
  };

  const formatCents = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <Badge variant="emerald" className="text-[11px] font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Paga
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="amber" className="text-[11px] font-medium flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-500" /> Pendente
          </Badge>
        );
      case 'overdue':
        return (
          <Badge variant="rose" className="text-[11px] font-medium flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-red-500" /> Vencida
          </Badge>
        );
      case 'canceled':
        return (
          <Badge variant="neutral" className="text-[11px] font-medium flex items-center gap-1">
            <XCircle className="w-3 h-3 text-slate-400" /> Cancelada
          </Badge>
        );
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Active Subscription Card */}
      {sub ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Assinatura Plano {sub.plan.toUpperCase()}
                </h4>
                {getStatusBadge(sub.status)}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Ciclo {sub.billingCycle === 'yearly' ? 'Anual' : 'Mensal'} •{' '}
                {formatCents(sub.amountCents)} • Forma de pagamento:{' '}
                {sub.paymentMethod.toUpperCase()}
              </p>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-500">
                {sub.cancelAtPeriodEnd ? 'Expira em' : 'Próxima renovação'}:{' '}
                <strong className="text-slate-900 dark:text-slate-100">
                  {formatDate(sub.currentPeriodEnd)}
                </strong>
              </div>
            </div>
          </div>

          {sub.cancelAtPeriodEnd ? (
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Renovação cancelada. Seu plano permanecerá ativo até{' '}
                <strong>{formatDate(sub.currentPeriodEnd)}</strong>, retornando ao plano Free em
                seguida.
              </span>
            </div>
          ) : (
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Gerenciado com segurança via Asaas Pagamentos.
              </span>

              {isConfirmingCancel ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 dark:text-slate-300">
                    Confirmar cancelamento?
                  </span>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="text-xs"
                  >
                    Sim, Cancelar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsConfirmingCancel(false)}
                    className="text-xs"
                  >
                    Voltar
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsConfirmingCancel(true)}
                  className="text-xs text-slate-500 hover:text-red-500 border-slate-200 dark:border-slate-800"
                >
                  Cancelar Renovação
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-xs text-slate-500">
          Nenhuma assinatura paga ativa no momento. Você está utilizando o plano Free gratuito.
        </div>
      )}

      {/* 2. Invoices History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-brand-500" />
          <span>Histórico de Faturas</span>
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 pl-2">Data / Vencimento</th>
                <th className="pb-3">Valor</th>
                <th className="pb-3">Forma</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 pr-2 text-right">Comprovante / Boleto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                    Nenhuma fatura registrada.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition"
                  >
                    <td className="py-3.5 pl-2 text-xs text-slate-700 dark:text-slate-300">
                      <div>{formatDate(inv.createdAt)}</div>
                      <div className="text-[11px] text-slate-400">
                        Vence em {formatDate(inv.dueDate)}
                      </div>
                    </td>

                    <td className="py-3.5 font-semibold text-slate-900 dark:text-slate-100 text-xs">
                      {formatCents(inv.amountCents)}
                    </td>

                    <td className="py-3.5 text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">
                      {inv.paymentMethod}
                    </td>

                    <td className="py-3.5">{getStatusBadge(inv.status)}</td>

                    <td className="py-3.5 pr-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {inv.pdfUrl && (
                          <a
                            href={inv.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline"
                          >
                            <span>Fatura PDF</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {inv.bankSlipUrl && (
                          <a
                            href={inv.bankSlipUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline"
                          >
                            <span>Boleto</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
