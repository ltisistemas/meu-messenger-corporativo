import React, { useState } from 'react';
import { BarChart2, Check, Clock, Lock, Users, AlertCircle, XCircle } from 'lucide-react';
import { PollDetailsResponse } from '@/shared';
import { useChatStore } from '../../stores/chat.store';
import { useAuthStore } from '../../stores/auth.store';
import { Button } from '../ui/Button';

export interface PollCardProps {
  poll: PollDetailsResponse;
  isSelf?: boolean;
}

export const PollCard: React.FC<PollCardProps> = ({ poll, isSelf = false }) => {
  const votePoll = useChatStore((s) => s.votePoll);
  const closePoll = useChatStore((s) => s.closePoll);
  const currentUser = useAuthStore((s) => s.user);

  // Local selection state for multi-choice or pre-submission
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>(
    poll.userVotedOptionIds || []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isClosed = poll.status === 'closed' || poll.isExpired;
  const isCreator = currentUser?.id === poll.creatorId;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'owner';
  const canClose = (isCreator || isAdmin) && !isClosed;

  const handleOptionToggle = (optionId: string) => {
    if (isClosed) return;
    setError(null);

    if (poll.allowMultiple) {
      setSelectedOptionIds((prev) =>
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
      );
    } else {
      setSelectedOptionIds([optionId]);
    }
  };

  const handleVoteSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isClosed || selectedOptionIds.length === 0) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await votePoll(poll.id, selectedOptionIds);
    } catch (err: any) {
      setError(err.message || 'Falha ao registrar voto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClosePoll = async () => {
    if (!canClose) return;
    if (
      !window.confirm('Tem certeza que deseja encerrar esta enquete? Ninguém mais poderá votar.')
    ) {
      return;
    }

    setIsClosing(true);
    setError(null);
    try {
      await closePoll(poll.id);
    } catch (err: any) {
      setError(err.message || 'Falha ao encerrar enquete.');
    } finally {
      setIsClosing(false);
    }
  };

  const formatExpiresAt = (expiresAtIso?: string | null) => {
    if (!expiresAtIso) return null;
    const diffMs = new Date(expiresAtIso).getTime() - Date.now();
    if (diffMs <= 0) return 'Expirada';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `Expira em ${days}d ${hours % 24}h`;
    }
    return `Expira em ${hours}h ${minutes}m`;
  };

  const remainingTimeStr = formatExpiresAt(poll.expiresAt);

  return (
    <div
      className={`rounded-2xl p-4 border transition-all shadow-sm max-w-lg w-full ${
        isSelf
          ? 'bg-brand-700/50 border-brand-500/40 text-white'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`p-2 rounded-xl shrink-0 ${
              isSelf
                ? 'bg-brand-600 text-cyan-200'
                : 'bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400'
            }`}
          >
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <span
              className={`text-[11px] font-bold uppercase tracking-wider ${
                isSelf ? 'text-cyan-200' : 'text-brand-600 dark:text-brand-400'
              }`}
            >
              Enquete Corporativa
            </span>
            <h4 className="text-sm sm:text-base font-bold leading-snug line-clamp-2">
              {poll.question}
            </h4>
          </div>
        </div>

        {canClose && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClosePoll}
            isLoading={isClosing}
            title="Encerrar votação"
            className={`text-xs px-2 py-1 h-auto shrink-0 ${
              isSelf
                ? 'text-brand-200 hover:text-white hover:bg-brand-600'
                : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 mr-1" />
            Encerrar
          </Button>
        )}
      </div>

      {/* Badges Info */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[11px]">
        {isClosed ? (
          <span className="px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Votação Encerrada
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
            Ativa
          </span>
        )}

        {poll.allowMultiple ? (
          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            Múltipla Escolha
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            Voto Único
          </span>
        )}

        {poll.isAnonymous ? (
          <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            Anônima
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center gap-1">
            <Users className="w-3 h-3" />
            Votos Identificados
          </span>
        )}

        {remainingTimeStr && !isClosed && (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {remainingTimeStr}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-3 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Options List */}
      <div className="space-y-2 mb-3">
        {poll.options.map((opt) => {
          const isSelected = selectedOptionIds.includes(opt.id);
          const percentage = opt.percentage || 0;
          const hasVotedThis = opt.hasVoted;

          return (
            <div
              key={opt.id}
              onClick={() => handleOptionToggle(opt.id)}
              className={`group relative overflow-hidden rounded-xl border p-3 cursor-pointer transition-all ${
                isClosed
                  ? 'cursor-default opacity-90'
                  : isSelected
                    ? isSelf
                      ? 'border-cyan-300 bg-brand-600/70 shadow-sm'
                      : 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 shadow-sm'
                    : isSelf
                      ? 'border-brand-500/30 bg-brand-800/40 hover:bg-brand-800/70'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
              }`}
            >
              {/* Animated Vote Percentage Bar Background */}
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-500 ease-out pointer-events-none ${
                  isSelf
                    ? isSelected
                      ? 'bg-cyan-500/30'
                      : 'bg-white/10'
                    : isSelected
                      ? 'bg-brand-500/20 dark:bg-brand-500/30'
                      : 'bg-slate-200/50 dark:bg-slate-700/40'
                }`}
                style={{ width: `${percentage}%` }}
              />

              <div className="relative flex items-center justify-between gap-3 z-10">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* Radio / Checkbox Indicator */}
                  <div
                    className={`w-4 h-4 rounded-${
                      poll.allowMultiple ? 'md' : 'full'
                    } flex items-center justify-center border transition ${
                      isSelected
                        ? isSelf
                          ? 'bg-cyan-400 border-cyan-400 text-brand-900'
                          : 'bg-brand-500 border-brand-500 text-white'
                        : isSelf
                          ? 'border-brand-400/50'
                          : 'border-slate-400 dark:border-slate-600'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>

                  <span className="text-xs sm:text-sm font-medium leading-tight select-none truncate">
                    {opt.text}
                  </span>

                  {hasVotedThis && (
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md ${
                        isSelf
                          ? 'bg-cyan-300/20 text-cyan-200'
                          : 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                      }`}
                    >
                      Seu voto
                    </span>
                  )}
                </div>

                {/* Vote stats */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold tabular-nums">{percentage.toFixed(0)}%</span>
                  <span
                    className={`text-[11px] tabular-nums ${
                      isSelf ? 'text-brand-200' : 'text-slate-400'
                    }`}
                  >
                    ({opt.votesCount})
                  </span>
                </div>
              </div>

              {/* Voter Avatars if public / identified */}
              {!poll.isAnonymous && opt.voters && opt.voters.length > 0 && (
                <div className="relative z-10 mt-1.5 pt-1.5 border-t border-black/5 dark:border-white/5 flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`text-[10px] font-medium ${
                      isSelf ? 'text-brand-200' : 'text-slate-400'
                    }`}
                  >
                    Votado por:
                  </span>
                  {opt.voters.map((v) => (
                    <span
                      key={v.id}
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                        isSelf
                          ? 'bg-brand-800/80 text-cyan-100'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                      title={v.name}
                    >
                      {v.name.split(' ')[0]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer info & Vote action */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/5 dark:border-white/10 text-xs">
        <div
          className={`text-[11px] flex items-center gap-1 ${
            isSelf ? 'text-brand-200' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>
            {poll.totalVotersCount} {poll.totalVotersCount === 1 ? 'participante' : 'participantes'}{' '}
            ({poll.totalVotes} {poll.totalVotes === 1 ? 'voto' : 'votos'})
          </span>
        </div>

        {!isClosed && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => handleVoteSubmit()}
            isLoading={isSubmitting}
            disabled={selectedOptionIds.length === 0 || isClosed}
            className="text-xs py-1 px-3 h-auto"
          >
            {poll.userHasVoted ? 'Alterar Voto' : 'Confirmar Voto'}
          </Button>
        )}
      </div>
    </div>
  );
};

