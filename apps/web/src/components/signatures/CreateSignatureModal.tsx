import React, { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  Plus,
  Trash2,
  Shield,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Crown,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  SignatureAuthType,
  SignatureSignAsRole,
  CreateSignatureRequestDto,
} from '@corpchat/shared';
import { useAuthStore } from '../../stores/auth.store';

export interface CreateSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  onSubmit: (dto: CreateSignatureRequestDto) => Promise<void>;
  onNavigateToPlans?: () => void;
}

interface SignerFormItem {
  name: string;
  email: string;
  documentation: string;
  phoneNumber: string;
  authType: SignatureAuthType;
  signAs: SignatureSignAsRole;
  groupOrder: number;
}

export const CreateSignatureModal: React.FC<CreateSignatureModalProps> = ({
  isOpen,
  onClose,
  conversationId,
  onSubmit,
  onNavigateToPlans,
}) => {
  const account = useAuthStore((s) => s.account);
  const isEnterprise = account?.plan === 'enterprise';

  const [title, setTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [fileSha256Preview, setFileSha256Preview] = useState<string>('');
  const [deadlineAt, setDeadlineAt] = useState<string>('');
  const [autoClose, setAutoClose] = useState(true);

  const [signers, setSigners] = useState<SignerFormItem[]>([
    {
      name: '',
      email: '',
      documentation: '',
      phoneNumber: '',
      authType: 'email',
      signAs: 'sign',
      groupOrder: 1,
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to compute sha256 in browser for preview
  const computeClientSha256 = async (buffer: ArrayBuffer): Promise<string> => {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    return '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setFormError('Por favor, selecione um arquivo em formato PDF.');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setFormError('O tamanho máximo do documento é de 25 MB.');
      return;
    }

    setFormError(null);
    setSelectedFile(file);
    if (!title) {
      setTitle(file.name.replace('.pdf', ''));
    }

    try {
      // Convert to base64 & compute preview SHA-256
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      setFileBase64(base64);

      try {
        const hash = await computeClientSha256(arrayBuffer);
        setFileSha256Preview(hash);
      } catch {
        setFileSha256Preview('');
      }
    } catch {
      setFormError('Erro ao carregar o arquivo PDF.');
    }
  };

  const handleAddSigner = () => {
    setSigners((prev) => [
      ...prev,
      {
        name: '',
        email: '',
        documentation: '',
        phoneNumber: '',
        authType: 'email',
        signAs: 'sign',
        groupOrder: prev.length + 1,
      },
    ]);
  };

  const handleRemoveSigner = (index: number) => {
    if (signers.length <= 1) return;
    setSigners((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSignerChange = (index: number, field: keyof SignerFormItem, value: any) => {
    setSigners((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isEnterprise) {
      setFormError('Assinatura Eletrônica é um recurso exclusivo do plano Enterprise.');
      return;
    }

    if (!selectedFile || !fileBase64) {
      setFormError('Selecione um arquivo PDF para envio.');
      return;
    }

    if (!title.trim()) {
      setFormError('Informe um título ou nome para o documento.');
      return;
    }

    for (let i = 0; i < signers.length; i++) {
      const s = signers[i];
      if (!s.name.trim() || !s.email.trim()) {
        setFormError(`Preencha o nome e e-mail do signatário #${i + 1}.`);
        return;
      }
      if (!s.email.includes('@')) {
        setFormError(`E-mail inválido para o signatário #${i + 1}.`);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      const dto: CreateSignatureRequestDto = {
        conversationId,
        title: title.trim(),
        documentName: selectedFile.name,
        contentBase64: fileBase64,
        deadlineAt: deadlineAt || undefined,
        autoClose,
        signers: signers.map((s) => ({
          name: s.name.trim(),
          email: s.email.trim().toLowerCase(),
          documentation: s.documentation.trim() || undefined,
          phoneNumber: s.phoneNumber.trim() || undefined,
          authType: s.authType,
          signAs: s.signAs,
          groupOrder: s.groupOrder,
        })),
      };

      await onSubmit(dto);
      handleClose();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao criar solicitação de assinatura.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setSelectedFile(null);
    setFileBase64('');
    setFileSha256Preview('');
    setDeadlineAt('');
    setFormError(null);
    setSigners([
      {
        name: '',
        email: '',
        documentation: '',
        phoneNumber: '',
        authType: 'email',
        signAs: 'sign',
        groupOrder: 1,
      },
    ]);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Nova Solicitação de Assinatura Eletrônica"
      maxWidth="lg"
    >
      {!isEnterprise ? (
        <div className="p-6 text-center space-y-4">
          <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <Crown className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Recurso Exclusivo do Plano Enterprise
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              O módulo de assinatura eletrônica com validade jurídica (Lei 14.063/2020),
              autenticação multifator e manifesto de evidências SHA-256 está disponível no plano
              Enterprise.
            </p>
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" onClick={handleClose}>
              Fechar
            </Button>
            {onNavigateToPlans && (
              <Button
                variant="primary"
                onClick={() => {
                  handleClose();
                  onNavigateToPlans();
                }}
                className="gap-1.5"
              >
                <Crown className="w-4 h-4 text-amber-400" />
                Fazer Upgrade para Enterprise
              </Button>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {formError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Document File Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Documento PDF para Assinatura *
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-brand-500/50 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-50/50 dark:bg-slate-900/50 hover:bg-brand-500/5"
              >
                <Upload className="w-8 h-8 text-brand-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Clique para selecionar o contrato ou documento em PDF
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Limite máximo de 25 MB. Criptografia em repouso e hash SHA-256 gerado
                  automaticamente.
                </p>
              </div>
            ) : (
              <div className="bg-brand-500/10 border border-brand-500/20 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2.5 bg-brand-500/20 rounded-xl text-brand-600 dark:text-brand-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {selectedFile.name}
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-2">
                      <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                      {fileSha256Preview && (
                        <span className="font-mono text-brand-600 dark:text-brand-400">
                          SHA-256: {fileSha256Preview.slice(0, 12)}...
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedFile(null);
                    setFileBase64('');
                    setFileSha256Preview('');
                  }}
                  className="text-xs py-1 px-2.5 h-8 text-slate-500"
                >
                  Trocar
                </Button>
              </div>
            )}
          </div>

          {/* Title & Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Título do Envelope / Documento *
              </label>
              <Input
                type="text"
                placeholder="Ex.: Contrato de Prestação de Serviços"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Prazo Limite para Assinatura (Opcional)
              </label>
              <Input
                type="date"
                value={deadlineAt}
                onChange={(e) => setDeadlineAt(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoClose"
              checked={autoClose}
              onChange={(e) => setAutoClose(e.target.checked)}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <label
              htmlFor="autoClose"
              className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
            >
              Finalizar documento e gerar certificado automaticamente após todas as assinaturas
            </label>
          </div>

          {/* Signers Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-brand-500" />
                  Signatários & Autenticação ({signers.length})
                </h4>
                <p className="text-[11px] text-slate-400">
                  Defina os participantes, método de validação de identidade e papel na assinatura.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddSigner}
                className="text-xs py-1 px-2.5 h-8 gap-1 border-brand-500/30 text-brand-600 dark:text-brand-400 hover:bg-brand-500/10"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Signatário
              </Button>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {signers.map((signer, index) => (
                <div
                  key={index}
                  className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 space-y-3 relative group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <span className="w-4 h-4 rounded-full bg-brand-500 text-white flex items-center justify-center text-[10px]">
                        {index + 1}
                      </span>
                      Signatário #{index + 1}
                    </span>

                    {signers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSigner(index)}
                        className="text-slate-400 hover:text-red-500 transition p-1"
                        title="Remover signatário"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Input
                        type="text"
                        placeholder="Nome completo *"
                        value={signer.name}
                        onChange={(e) => handleSignerChange(index, 'name', e.target.value)}
                        required
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <Input
                        type="email"
                        placeholder="E-mail corporativo *"
                        value={signer.email}
                        onChange={(e) => handleSignerChange(index, 'email', e.target.value)}
                        required
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Input
                        type="text"
                        placeholder="CPF / CNPJ (Opcional)"
                        value={signer.documentation}
                        onChange={(e) => handleSignerChange(index, 'documentation', e.target.value)}
                        className="text-xs"
                      />
                    </div>

                    <div>
                      <select
                        value={signer.authType}
                        onChange={(e) => handleSignerChange(index, 'authType', e.target.value)}
                        className="w-full h-10 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-brand-500 text-slate-800 dark:text-slate-200"
                      >
                        <option value="email">Token por E-mail (Simples)</option>
                        <option value="whatsapp">Token via WhatsApp (Avançada)</option>
                        <option value="sms">Token via SMS (Avançada)</option>
                        <option value="icp_brasil">Certificado ICP-Brasil (Qualificada)</option>
                      </select>
                    </div>

                    <div>
                      <select
                        value={signer.signAs}
                        onChange={(e) => handleSignerChange(index, 'signAs', e.target.value)}
                        className="w-full h-10 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-brand-500 text-slate-800 dark:text-slate-200"
                      >
                        <option value="sign">Assinar como Parte</option>
                        <option value="approve">Aprovar Documento</option>
                        <option value="witness">Assinar como Testemunha</option>
                        <option value="acknowledge">Apenas Ciente</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Legal Compliance Footer & Submit */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Conforme MP 2.200-2/2001 e Lei Federal nº 14.063/2020.</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || !selectedFile}
                className="gap-1.5 shadow-glow w-full sm:w-auto"
              >
                <Sparkles className="w-4 h-4" />
                {isSubmitting ? 'Enviando Documento...' : 'Enviar para Assinatura'}
              </Button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
};
