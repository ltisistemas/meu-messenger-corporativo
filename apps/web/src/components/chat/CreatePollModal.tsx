import React, { useState } from 'react';
import {
  BarChart2,
  Plus,
  Trash2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useAuthStore } from '../../stores/auth.store';
import { useChatStore } from '../../stores/chat.store';

export interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
}

export const CreatePollModal: React.FC<CreatePollModalProps> = ({
  isOpen,
  onClose,
  conversationId,
}) => {
  const account = useAuthStore((s) => s.account);
  const createPoll = useChatStore((s) => s.createPoll);

  const plan = account?.plan || 'free';
  const isFreePlan = plan === 'free';

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState<string>('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddOption = () => {
    if (options.length >= 10) return;
    setOptions([...options, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isFreePlan) {
      setError('O recurso de enquetes é exclusivo dos planos Pro e Enterprise. Faça upgrade para desbloquear.');
      return;
    }

    if (!question.trim()) {
      setError('Informe a pergunta da enquete.');
      return;
    }

    const filteredOptions = options.map((o) => o.trim()).filter(Boolean);
    if (filteredOptions.length < 2) {
      setError('A enquete deve ter no mínimo 2 opções preenchidas.');
      return;
    }

    setIsSubmitting(true);
    try {
      const hours = parseInt(expiresInHours, 10) || 0;
      await createPoll({
        conversationId,
        question: question.trim(),
        options: filteredOptions,
        allowMultiple,
        isAnonymous,
        expiresInHours: hours > 0 ? hours : undefined,
      });

      onClose();
      // Reset form
      setQuestion('');
      setOptions(['', '']);
      setAllowMultiple(false);
      setIsAnonymous(false);
      setExpiresInHours('0');
    } catch (err: any) {
      setError(err.message || 'Falha ao criar enquete.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Criar Nova Enquete">
      <form onSubmit={handleSubmit} className="space-y-4">
        {isFreePlan && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">Recurso do Plano Pro / Enterprise</p>
              <p>
                Sua organização está no plano Free. Faça upgrade para o Pro para criar enquetes com votação em tempo real e resultados analíticos.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
            {error}
          </div>
        )}

        {/* Question */}
        <Input
          label="Pergunta da Enquete"
          placeholder="Ex: Qual dia é melhor para a retrospectiva da sprint?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={isFreePlan}
          autoFocus
          required
        />

        {/* Options */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Opções de Resposta ({options.length}/10)
          </label>

          <div className="space-y-2">
            {options.map((option, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 w-4 text-center">
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  placeholder={`Opção ${idx + 1}`}
                  value={option}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  disabled={isFreePlan}
                  required={idx < 2}
                  className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition"
                    title="Remover opção"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {options.length < 10 && (
            <button
              type="button"
              onClick={handleAddOption}
              disabled={isFreePlan}
              className="mt-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-950/40 transition disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar outra opção
            </button>
          )}
        </div>

        {/* Configurations */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Multiple Choice Toggle */}
            <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer">
              <input
                type="checkbox"
                checked={allowMultiple}
                onChange={(e) => setAllowMultiple(e.target.checked)}
                disabled={isFreePlan}
                className="mt-0.5 rounded text-brand-600 focus:ring-brand-500"
              />
              <div className="text-xs">
                <span className="font-semibold block text-slate-900 dark:text-slate-100">
                  Múltipla Escolha
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  Votar em mais de uma opção
                </span>
              </div>
            </label>

            {/* Anonymous Vote Toggle */}
            <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                disabled={isFreePlan}
                className="mt-0.5 rounded text-brand-600 focus:ring-brand-500"
              />
              <div className="text-xs">
                <span className="font-semibold block text-slate-900 dark:text-slate-100">
                  Votação Anônima
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  Ocultar identidade dos votantes
                </span>
              </div>
            </label>
          </div>

          {/* Expiration Dropdown */}
          <div>
            <label htmlFor="poll-expiration-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              Prazo para Votação
            </label>
            <select
              id="poll-expiration-select"
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(e.target.value)}
              disabled={isFreePlan}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50"
            >
              <option value="0">Sem prazo (Permanece aberta até encerramento)</option>
              <option value="1">1 hora</option>
              <option value="24">24 horas (1 dia)</option>
              <option value="72">72 horas (3 dias)</option>
              <option value="168">7 dias (1 semana)</option>
            </select>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={isFreePlan}
            leftIcon={<BarChart2 className="w-4 h-4" />}
          >
            Publicar Enquete
          </Button>
        </div>
      </form>
    </Modal>
  );
};
