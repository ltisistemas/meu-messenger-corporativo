import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Download,
  Trash2,
  Lock,
  FileCheck,
  AlertTriangle,
  Mail,
  Scale,
  CheckCircle2,
  Database,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { api, ApiError } from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';
import { LgpdPrivacyPolicyResponse } from '@corpchat/shared';

export interface LgpdPrivacySectionProps {
  userRole?: string;
  userEmail?: string;
}

export const LgpdPrivacySection: React.FC<LgpdPrivacySectionProps> = ({ userRole, userEmail }) => {
  const { logout } = useAuthStore();
  const [policy, setPolicy] = useState<LgpdPrivacyPolicyResponse | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Deletion modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const data = await api.get<LgpdPrivacyPolicyResponse>('/lgpd/privacy-policy');
        setPolicy(data);
      } catch {
        // Fallback default
        setPolicy({
          version: '2026.1',
          lastUpdated: '2026-01-15T00:00:00.000Z',
          dpoContact: 'dpo@nextmsg.com.br',
          rights: [
            'Confirmação da existência de tratamento (Art. 18, I)',
            'Acesso aos dados pessoais (Art. 18, II)',
            'Correção de dados incompletos ou inexatos (Art. 18, III)',
            'Anonimização, bloqueio ou eliminação de dados excessivos (Art. 18, IV)',
            'Portabilidade dos dados a outro fornecedor (Art. 18, V)',
            'Eliminação dos dados pessoais tratados com consentimento (Art. 18, VI)',
            'Revogação do consentimento (Art. 18, IX)',
          ],
          retentionPolicies: {
            free: 'Zero retenção de arquivos em disco (streaming em memória somente para destinatários online).',
            pro: 'Arquivos com retenção temporária máxima de 5 dias em bucket seguro criptografado com exclusão automática.',
            enterprise:
              'Retenção corporativa configurável com trilha de auditoria SHA-256 e conformidade integral.',
          },
          legalBases: [
            'Execução de contrato de prestação de serviços (Art. 7º, V da LGPD)',
            'Cumprimento de obrigação legal ou regulatória (Art. 7º, II da LGPD)',
            'Legítimo interesse para prevenção à fraude e segurança (Art. 7º, IX da LGPD)',
          ],
        });
      }
    };

    fetchPolicy();
  }, []);

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      setExportSuccess(false);

      const exportedData = await api.get('/lgpd/export');

      // Create downloadable JSON blob
      const blob = new Blob([JSON.stringify(exportedData, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nextmsg-exportacao-lgpd-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 6000);
    } catch (err: any) {
      alert(err.message || 'Falha ao exportar dados pessoais.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);

    if (deleteConfirmation !== 'EXCLUIR') {
      setDeleteError('Por favor digite EXCLUIR em letras maiúsculas para confirmar.');
      return;
    }

    try {
      setIsDeleting(true);
      await api.post('/lgpd/delete-account', {
        password: deletePassword,
        confirmationText: deleteConfirmation,
      });

      alert(
        'Sua conta foi anonimizada e seus dados pessoais foram removidos com sucesso conforme a LGPD. Você será desconectado.'
      );
      setIsDeleteModalOpen(false);
      logout();
    } catch (err: any) {
      if (err instanceof ApiError) {
        setDeleteError(err.message);
      } else {
        setDeleteError(err.message || 'Falha ao processar solicitação de exclusão.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. LGPD Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/30 border border-emerald-500/20 rounded-2xl p-6 sm:p-8 backdrop-blur shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-100">
                  Privacidade, Proteção de Dados & LGPD
                </h2>
                <Badge variant="emerald" className="text-[11px]">
                  Lei 13.709/2018
                </Badge>
              </div>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                O NextMsg foi projetado desde a arquitetura para garantir privacidade por padrão,
                zero retenção desnecessária e total controle sobre seus dados pessoais.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:items-end text-xs text-slate-400 border-t sm:border-t-0 sm:border-l border-slate-800 pt-4 sm:pt-0 sm:pl-6 w-full sm:w-auto">
            <span className="text-slate-500 font-medium">Encarregado de Dados (DPO):</span>
            <a
              href={`mailto:${policy?.dpoContact || 'dpo@nextmsg.com.br'}`}
              className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold mt-0.5"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{policy?.dpoContact || 'dpo@nextmsg.com.br'}</span>
            </a>
            <span className="text-[11px] text-slate-500 mt-1">
              Versão da Política: {policy?.version || '2026.1'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Rights and Portability Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Titular Rights */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Scale className="w-5 h-5 text-indigo-500" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Seus Direitos como Titular (Art. 18)
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Você pode exercer a qualquer momento os direitos garantidos pela legislação
              brasileira:
            </p>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              {policy?.rights.map((right, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{right}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
            Bases legais aplicáveis: Execução de contrato, obrigação legal e prevenção à fraude.
          </div>
        </div>

        {/* Data Portability (Export) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-5 h-5 text-brand-500" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Exportação de Dados Pessoais (Art. 18, V)
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              Faça o download de uma cópia integral e estruturada em formato interoperável (JSON) de
              todos os seus dados mantidos pela plataforma, incluindo perfil, mensagens enviadas,
              participações em conversas e confirmações de leitura.
            </p>

            <div className="bg-slate-50 dark:bg-slate-950/60 rounded-lg p-4 border border-slate-200 dark:border-slate-800/80 mb-4 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-slate-500">
                <span>Usuário solicitante:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {userEmail}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span>Formato de saída:</span>
                <span className="font-mono text-emerald-500 font-semibold">JSON (UTF-8)</span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span>Disponibilidade:</span>
                <span className="text-slate-700 dark:text-slate-300">Imediata (sob demanda)</span>
              </div>
            </div>

            {exportSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs p-3 rounded-lg flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Arquivo JSON gerado e download iniciado com sucesso!</span>
              </div>
            )}
          </div>

          <Button
            type="button"
            onClick={handleExportData}
            isLoading={isExporting}
            className="w-full flex items-center justify-center gap-2 mt-4"
          >
            <Download className="w-4 h-4" />
            <span>Baixar Meus Dados (JSON)</span>
          </Button>
        </div>
      </div>

      {/* 3. Retention Policies Comparison */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <FileCheck className="w-5 h-5 text-amber-500" />
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Política de Retenção e Exclusão Automática
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] block mb-2">
              Plano Free
            </span>
            <p className="text-slate-600 dark:text-slate-400">
              {policy?.retentionPolicies.free ||
                'Zero retenção de arquivos em disco. Streaming direto em memória via WebSocket.'}
            </p>
          </div>

          <div className="p-4 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40">
            <span className="font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider text-[11px] block mb-2">
              Plano Pro
            </span>
            <p className="text-slate-600 dark:text-slate-400">
              {policy?.retentionPolicies.pro ||
                'Store-and-forward temporário até 5 dias em bucket seguro com auto-exclusão após download.'}
            </p>
          </div>

          <div className="p-4 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40">
            <span className="font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider text-[11px] block mb-2">
              Plano Enterprise
            </span>
            <p className="text-slate-600 dark:text-slate-400">
              {policy?.retentionPolicies.enterprise ||
                'Retenção personalizada, evidências auditáveis SHA-256 e conformidade com Lei 14.063/2020.'}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Danger Zone: Right to Erasure / Account Deletion */}
      <div className="border border-red-500/30 bg-red-950/10 dark:bg-red-950/20 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Direito ao Esquecimento & Exclusão de Conta (Art. 18, VI)
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Ao solicitar a exclusão da sua conta, seus dados pessoais identificáveis (nome, email,
              avatar e senhas) serão permanentemente anonimizados no banco de dados. Todas as
              sessões ativas serão invalidadas imediatamente.
            </p>
            {userRole === 'owner' && (
              <p className="text-[11px] text-amber-500 mt-2 font-medium">
                Nota: Se você for o único Proprietário da organização, deverá transferir a
                propriedade ou cancelar a conta corporativa antes de prosseguir com a exclusão
                individual.
              </p>
            )}
          </div>

          <Button
            type="button"
            variant="danger"
            onClick={() => {
              setDeletePassword('');
              setDeleteConfirmation('');
              setDeleteError(null);
              setIsDeleteModalOpen(true);
            }}
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold"
          >
            <Trash2 className="w-4 h-4" />
            <span>Excluir Minha Conta</span>
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Confirmar Exclusão de Conta
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Esta ação é irreversível e removerá permanentemente seu acesso.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirme sua senha atual:
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Sua senha de acesso"
                    className="w-full text-xs px-3 py-2 pl-9 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Digite <strong className="text-red-500">EXCLUIR</strong> para confirmar:
                </label>
                <input
                  type="text"
                  required
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="EXCLUIR"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/50 font-mono font-bold"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  isLoading={isDeleting}
                  disabled={deleteConfirmation !== 'EXCLUIR' || !deletePassword}
                  className="flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir Definitivamente</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
