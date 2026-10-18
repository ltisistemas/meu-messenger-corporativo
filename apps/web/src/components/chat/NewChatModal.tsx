import React, { useState } from 'react';
import { Users, User, Clock, ShieldCheck, Radio, Hourglass, AlertTriangle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useAuthStore } from '../../stores/auth.store';
import { useChatStore, CreateGroupOptions } from '../../stores/chat.store';

export interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGroup: (
    options: CreateGroupOptions | string,
    memberIds?: string[],
    retentionHours?: number
  ) => Promise<void>;
  onCreateDirect: (userIdOrEmail: string) => Promise<void>;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  isOpen,
  onClose,
  onCreateGroup,
  onCreateDirect,
}) => {
  const account = useAuthStore((s) => s.account);
  const createBroadcast = useChatStore((s) => s.createBroadcast);

  const plan = account?.plan || 'free';
  const isFreePlan = plan === 'free';

  const [tab, setTab] = useState<'group' | 'broadcast' | 'direct'>('group');
  const [groupTitle, setGroupTitle] = useState('');
  const [isTemporary, setIsTemporary] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState('24');
  const [retentionHours, setRetentionHours] = useState('24');
  const [broadcastContent, setBroadcastContent] = useState('');
  const [directInput, setDirectInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (tab === 'group') {
        if (!groupTitle.trim()) {
          setError('Informe o título do grupo corporativo.');
          setIsSubmitting(false);
          return;
        }

        const expHours = isTemporary ? parseInt(expiresInHours, 10) || 24 : undefined;
        if (isTemporary) {
          await onCreateGroup({
            title: groupTitle.trim(),
            memberIds: [],
            retentionHours: parseInt(retentionHours, 10) || 0,
            isTemporary: true,
            expiresInHours: expHours,
          });
        } else {
          await onCreateGroup(groupTitle.trim(), [], parseInt(retentionHours, 10) || 0);
        }
      } else if (tab === 'broadcast') {
        if (isFreePlan) {
          setError('Lista de transmissão corporativa é exclusiva dos planos Pro e Enterprise.');
          setIsSubmitting(false);
          return;
        }

        if (!broadcastContent.trim()) {
          setError('Digite a mensagem do comunicado corporativo.');
          setIsSubmitting(false);
          return;
        }

        await createBroadcast(broadcastContent.trim());
      } else {
        if (!directInput.trim()) {
          setError('Informe o ID ou e-mail do colaborador.');
          setIsSubmitting(false);
          return;
        }
        await onCreateDirect(directInput.trim());
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Falha ao iniciar conversa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        tab === 'group'
          ? 'Criar Novo Grupo Corporativo'
          : tab === 'broadcast'
            ? 'Nova Transmissão Corporativa'
            : 'Iniciar Conversa Direta 1:1'
      }
    >
      <div className="space-y-4">
        {/* Switcher Tabs */}
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => {
              setTab('group');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition ${
              tab === 'group'
                ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Grupo
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('broadcast');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition ${
              tab === 'broadcast'
                ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Transmissão
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('direct');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition ${
              tab === 'direct'
                ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Direto 1:1
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'group' ? (
            <>
              <Input
                label="Nome do Grupo"
                placeholder="Ex: Engenharia & Produto, Diretoria Q4"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                autoFocus
                required
              />

              {/* Temporary Group Option (T-24) */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2.5">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTemporary}
                    onChange={(e) => setIsTemporary(e.target.checked)}
                    className="mt-0.5 rounded text-brand-600 focus:ring-brand-500"
                  />
                  <div className="text-xs">
                    <span className="font-semibold flex items-center gap-1 text-slate-900 dark:text-slate-100">
                      <Hourglass className="w-3.5 h-3.5 text-amber-500" />
                      Grupo Temporário com Auto-Expiração
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Ao expirar, o grupo é automaticamente arquivado como somente leitura.
                    </span>
                  </div>
                </label>

                {isTemporary && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <label
                      htmlFor="group-exp-select"
                      className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1"
                    >
                      Prazo de Expiração do Grupo
                    </label>
                    <select
                      id="group-exp-select"
                      value={expiresInHours}
                      onChange={(e) => setExpiresInHours(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    >
                      <option value="1">1 hora (Reunião rápida / War room)</option>
                      <option value="24">24 horas (1 dia - Incidente / Squad temporário)</option>
                      <option value="72">72 horas (3 dias - Hackathon / Sprint pontual)</option>
                      <option value="168">7 dias (1 semana)</option>
                      <option value="720">30 dias (1 mês)</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="group-retention-select"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1"
                >
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Política de Retenção de Mensagens
                </label>
                <select
                  id="group-retention-select"
                  value={retentionHours}
                  onChange={(e) => setRetentionHours(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="0">
                    Permanente (Sem auto-destruição individual de mensagens)
                  </option>
                  <option value="24">24 horas</option>
                  <option value="72">72 horas (3 dias)</option>
                  <option value="168">7 dias (1 semana)</option>
                </select>
              </div>
            </>
          ) : tab === 'broadcast' ? (
            <div className="space-y-3">
              {isFreePlan ? (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-0.5">Recurso dos Planos Pro e Enterprise</p>
                    <p>
                      Listas de transmissão corporativa e relatórios analíticos de entrega são
                      exclusivos para assinantes Pro e Enterprise.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Transmissões enviam uma mensagem oficial a todos os membros da sua organização no
                  canal <strong>Comunicados</strong> e geram relatório detalhado de entrega e
                  leitura.
                </p>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Mensagem do Comunicado
                </label>
                <textarea
                  rows={4}
                  placeholder="Ex: Atenção equipe: manutenção programada dos servidores hoje às 22h..."
                  value={broadcastContent}
                  onChange={(e) => setBroadcastContent(e.target.value)}
                  disabled={isFreePlan}
                  required
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50"
                />
              </div>
            </div>
          ) : (
            <Input
              label="ID ou E-mail do Colaborador"
              placeholder="Ex: colaborador@empresa.com"
              value={directInput}
              onChange={(e) => setDirectInput(e.target.value)}
              autoFocus
              required
            />
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Criptografado</span>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                disabled={tab === 'broadcast' && isFreePlan}
              >
                {tab === 'group'
                  ? isTemporary
                    ? 'Criar Grupo Temporário'
                    : 'Criar Grupo'
                  : tab === 'broadcast'
                    ? 'Disparar Transmissão'
                    : 'Iniciar Conversa'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
