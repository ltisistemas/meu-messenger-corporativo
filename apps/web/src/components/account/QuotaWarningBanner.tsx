import React from 'react';
import { AlertTriangle, Sparkles, ArrowRight, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/Button';

export interface QuotaWarningBannerProps {
  status?: string;
  isOverQuota?: boolean;
  excessUsersCount?: number;
  maxUsers?: number;
  activeUsersCount?: number;
  planName?: string;
  isTrialing?: boolean;
  trialDaysRemaining?: number | null;
  onUpgradeClick?: () => void;
  onManageMembersClick?: () => void;
}

export const QuotaWarningBanner: React.FC<QuotaWarningBannerProps> = ({
  status,
  isOverQuota,
  excessUsersCount = 0,
  maxUsers = 12,
  activeUsersCount = 0,
  planName = 'Free',
  isTrialing,
  trialDaysRemaining,
  onUpgradeClick,
  onManageMembersClick,
}) => {
  if (status === 'suspended') {
    return (
      <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-3 text-red-700 dark:text-red-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
            <span className="text-sm font-medium">
              <strong>Conta suspensa por inadimplência:</strong> Regularize a fatura pendente para restaurar o envio de mensagens e arquivos.
            </span>
          </div>
          {onUpgradeClick && (
            <Button
              variant="danger"
              size="sm"
              onClick={onUpgradeClick}
              className="shrink-0 font-medium"
            >
              Ver Faturas & Regularizar
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (isOverQuota || status === 'over_quota') {
    return (
      <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-3 text-amber-900 dark:text-amber-300">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 animate-bounce" />
            <div className="text-sm">
              <strong className="font-semibold">Limite de Usuários Excedido:</strong> Sua organização possui{' '}
              <span className="underline font-bold">{activeUsersCount} membros ativos</span> (limite do plano {planName}: {maxUsers}).
              O envio de mensagens e convites está em <em>somente leitura</em> até a regularização.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onManageMembersClick && (
              <Button
                variant="outline"
                size="sm"
                onClick={onManageMembersClick}
                className="text-xs border-amber-500/40 hover:bg-amber-500/10 text-amber-900 dark:text-amber-200"
              >
                Desativar {excessUsersCount > 0 ? `${excessUsersCount} ` : ''}Membros
              </Button>
            )}
            {onUpgradeClick && (
              <Button
                variant="primary"
                size="sm"
                onClick={onUpgradeClick}
                className="text-xs bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-1.5"
              >
                <span>Fazer Upgrade</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isTrialing && typeof trialDaysRemaining === 'number') {
    return (
      <div className="bg-brand-500/10 border-b border-brand-500/20 px-4 py-2.5 text-brand-900 dark:text-brand-300">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm">
            <Sparkles className="w-4 h-4 text-brand-500 shrink-0" />
            <span>
              Você está no <strong>Trial Pro de 14 dias</strong> ({trialDaysRemaining} dia{trialDaysRemaining === 1 ? '' : 's'} restante{trialDaysRemaining === 1 ? '' : 's'}). Aproveite todos os recursos ilimitados!
            </span>
          </div>
          {onUpgradeClick && (
            <Button
              variant="outline"
              size="sm"
              onClick={onUpgradeClick}
              className="text-xs border-brand-500/30 hover:bg-brand-500/10 text-brand-600 dark:text-brand-400 shrink-0"
            >
              Assinar Plano Pro
            </Button>
          )}
        </div>
      </div>
    );
  }

  return null;
};
