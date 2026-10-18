import React from 'react';
import { Building2, Users, Crown, ShieldAlert, Sparkles, AlertTriangle } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { AccountDetailsResponse } from '@corpchat/shared';

export interface AccountOverviewCardProps {
  account: AccountDetailsResponse | null;
  onUpgradeClick: () => void;
  onInviteClick: () => void;
}

export const AccountOverviewCard: React.FC<AccountOverviewCardProps> = ({
  account,
  onUpgradeClick,
  onInviteClick,
}) => {
  if (!account) return null;

  const planName = account.plan.toUpperCase();
  const maxUsers = account.maxUsers === Number.POSITIVE_INFINITY ? 'Ilimitado' : account.maxUsers;
  const isUnlimited = account.maxUsers === Number.POSITIVE_INFINITY;

  const usagePercent = isUnlimited
    ? 0
    : Math.min(100, Math.round((account.activeUsersCount / account.maxUsers) * 100));

  const isOverQuota = account.isOverQuota || account.status === 'over_quota';
  const isSuspended = account.status === 'suspended';

  let progressColor = 'bg-emerald-500';
  if (isOverQuota || usagePercent > 100) {
    progressColor = 'bg-red-500';
  } else if (usagePercent >= 80) {
    progressColor = 'bg-amber-500';
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Org Info */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-glow shrink-0">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {account.name}
              </h2>
              <Badge
                variant={
                  account.plan === 'enterprise'
                    ? 'amber'
                    : account.plan === 'pro'
                      ? 'brand'
                      : 'neutral'
                }
                className="uppercase tracking-wider font-semibold text-xs"
              >
                Plano {planName}
              </Badge>

              {account.isTrialing && (
                <Badge
                  variant="brand"
                  className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs"
                >
                  <Sparkles className="w-3 h-3 mr-1 inline" /> Trial Pro (
                  {account.trialDaysRemaining}d)
                </Badge>
              )}

              {isOverQuota && (
                <Badge variant="rose" className="animate-pulse flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Limite Excedido
                </Badge>
              )}

              {isSuspended && (
                <Badge variant="rose" className="flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> Suspensa
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Painel de administração, limites da conta e gestão de membros.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={onInviteClick}
            disabled={isOverQuota || isSuspended}
            className="flex-1 sm:flex-initial"
          >
            <Users className="w-4 h-4 mr-2" />
            Convidar Membro
          </Button>

          {account.plan !== 'enterprise' && (
            <Button
              variant="primary"
              onClick={onUpgradeClick}
              className="flex-1 sm:flex-initial bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 shadow-md"
            >
              <Crown className="w-4 h-4 mr-2 text-amber-300" />
              Fazer Upgrade
            </Button>
          )}
        </div>
      </div>

      {/* Usage Progress Metrics */}
      <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center justify-between text-sm mb-2">
          <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
            <Users className="w-4 h-4 text-brand-500" />
            <span>Membros Ativos na Organização</span>
          </div>
          <div className="text-slate-900 dark:text-slate-100 font-semibold">
            {account.activeUsersCount} / {maxUsers} usuários{' '}
            {!isUnlimited && <span className="text-slate-400 font-normal">({usagePercent}%)</span>}
          </div>
        </div>

        {/* Progress bar */}
        {!isUnlimited && (
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{
                width: `${Math.min(100, (account.activeUsersCount / account.maxUsers) * 100)}%`,
              }}
            />
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
          <span>{account.inactiveUsersCount} membro(s) inativo(s)</span>
          {isOverQuota && (
            <span className="text-red-500 font-medium">
              {account.excessUsersCount} membro(s) acima da cota permitida
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
