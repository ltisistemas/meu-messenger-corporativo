import React, { useState } from 'react';
import { UserPlus, Copy, Check, Link, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string, role: 'admin' | 'member') => Promise<{ inviteUrl: string }>;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  isOpen,
  onClose,
  onInvite,
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      setIsLoading(true);
      setError(null);
      const res = await onInvite(email.trim(), role);
      const fullUrl = `${window.location.origin}${res.inviteUrl}`;
      setInviteUrl(fullUrl);
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar convite.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleClose = () => {
    setEmail('');
    setRole('member');
    setInviteUrl(null);
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Convidar Novo Membro"
      description="Envie um convite para um colaborador se juntar à organização."
      maxWidth="md"
    >
      {inviteUrl ? (
        <div className="space-y-4 py-2">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center">
            <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Convite Criado com Sucesso!
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Compartilhe o link abaixo com <strong>{email}</strong> para que ele possa aceitar o convite e criar sua senha.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <Link className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            <input
              type="text"
              readOnly
              value={inviteUrl}
              className="bg-transparent text-xs text-slate-700 dark:text-slate-300 flex-1 truncate outline-none"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="shrink-0 text-xs py-1 px-3 h-8 flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Link</span>
                </>
              )}
            </Button>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <Button variant="primary" onClick={handleClose}>
              Concluir
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              E-mail do Colaborador *
            </label>
            <Input
              type="email"
              placeholder="exemplo@suaempresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Papel na Organização
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
              className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 outline-none"
            >
              <option value="member">Membro (Usuário Padrão)</option>
              <option value="admin">Administrador (Gerencia membros e planos)</option>
            </select>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <Button variant="outline" type="button" onClick={handleClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isLoading ? 'Gerando...' : 'Gerar Link de Convite'}</span>
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
