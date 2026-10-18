import React, { useState, useRef } from 'react';
import { ShieldCheck, Upload, AlertCircle, CheckCircle2, XCircle, Copy, Check } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { useSignatureStore } from '../../stores/signature.store';

export interface VerifyHashModalProps {
  isOpen: boolean;
  onClose: () => void;
  signatureId: string | null;
}

export const VerifyHashModal: React.FC<VerifyHashModalProps> = ({
  isOpen,
  onClose,
  signatureId,
}) => {
  const { verificationResult, verifyDocumentHash, clearVerificationResult } = useSignatureStore();

  const [inputHash, setInputHash] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [computedFileHash, setComputedFileHash] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !signatureId) return null;

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

    try {
      setSelectedFile(file);
      setErrorMessage(null);
      const arrayBuffer = await file.arrayBuffer();
      const sha256 = await computeClientSha256(arrayBuffer);
      setComputedFileHash(sha256);
      setInputHash(sha256);
    } catch {
      setErrorMessage('Não foi possível calcular o hash do arquivo selecionado.');
    }
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const hashToVerify = (inputHash || computedFileHash).trim().toLowerCase();

    if (!hashToVerify) {
      setErrorMessage('Informe um hash SHA-256 ou selecione um arquivo.');
      return;
    }

    if (hashToVerify.length !== 64) {
      setErrorMessage('O hash SHA-256 deve conter exatamente 64 caracteres hexadecimais.');
      return;
    }

    try {
      setIsVerifying(true);
      setErrorMessage(null);
      await verifyDocumentHash(signatureId, {
        sha256: hashToVerify,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao validar integridade do documento.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    setInputHash('');
    setSelectedFile(null);
    setComputedFileHash('');
    setErrorMessage(null);
    clearVerificationResult();
    onClose();
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Verificação de Autenticidade e Integridade (SHA-256)"
      maxWidth="md"
    >
      <div className="p-6 space-y-5">
        {errorMessage && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Info header */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
            <ShieldCheck className="w-4 h-4 text-brand-500" />
            <span>Conformidade Criptográfica (Lei 14.063/2020)</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
            Selecione o arquivo PDF baixado ou insira manualmente o hash SHA-256 para comprovar que
            o documento não sofreu nenhuma adulteração desde a sua assinatura.
          </p>
        </div>

        {/* File Drop / Select Area */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Calcular Hash a partir do Arquivo
          </label>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

          {!selectedFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-brand-500/50 rounded-2xl p-4 text-center cursor-pointer transition bg-slate-50/40 dark:bg-slate-900/40 hover:bg-brand-500/5"
            >
              <Upload className="w-6 h-6 text-brand-500 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Selecione o arquivo para calcular o hash SHA-256 localmente
              </p>
            </div>
          ) : (
            <div className="bg-brand-500/10 border border-brand-500/20 rounded-2xl p-3 flex items-center justify-between">
              <div className="truncate">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {selectedFile.name}
                </div>
                <div className="text-[10px] font-mono text-brand-600 dark:text-brand-400 mt-0.5 truncate">
                  SHA-256: {computedFileHash}
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedFile(null);
                  setComputedFileHash('');
                  setInputHash('');
                }}
                className="text-xs h-7 px-2 text-slate-500 ml-2"
              >
                Remover
              </Button>
            </div>
          )}
        </div>

        {/* Manual Hash Input */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Ou digite/cole o Hash SHA-256:
          </label>
          <div className="relative">
            <Input
              type="text"
              placeholder="Ex: 8f47b567a9d... (64 caracteres)"
              value={inputHash}
              onChange={(e) => setInputHash(e.target.value.trim())}
              className="text-xs font-mono pr-8"
            />
            {inputHash && (
              <button
                type="button"
                onClick={() => handleCopy(inputHash)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title="Copiar hash"
              >
                {copiedHash ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Verification Result Display */}
        {verificationResult && (
          <div
            className={`p-4 rounded-2xl border text-xs space-y-2 animate-fadeIn ${
              verificationResult.isValid
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold">
                {verificationResult.isValid ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span>Autenticidade Confirmada!</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                    <span>Hash Divergente ou Documento Adulterado</span>
                  </>
                )}
              </div>

              <Badge
                variant={verificationResult.isValid ? 'emerald' : 'rose'}
                className="text-[10px] font-bold"
              >
                {verificationResult.isValid ? 'VÁLIDO' : 'INVÁLIDO'}
              </Badge>
            </div>

            <p className="text-[11px] leading-relaxed opacity-90">
              {verificationResult.isValid
                ? verificationResult.matchesSigned
                  ? 'Documento 100% autêntico e íntegro. O hash SHA-256 corresponde ao documento assinado final.'
                  : 'O hash SHA-256 corresponde ao documento original enviado para assinatura.'
                : 'O hash SHA-256 informado não corresponde a nenhuma versão registrada deste envelope.'}
            </p>

            <div className="pt-2 border-t border-black/10 dark:border-white/10 text-[10px] font-mono space-y-1">
              <div>Documento: {verificationResult.documentName}</div>
              <div className="truncate">Hash Fornecido: {verificationResult.providedSha256}</div>
              {verificationResult.signedSha256 && (
                <div className="truncate">
                  Hash Assinado Oficial: {verificationResult.signedSha256}
                </div>
              )}
              {verificationResult.originalSha256 && (
                <div className="truncate">
                  Hash Original Oficial: {verificationResult.originalSha256}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Footer */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <Button variant="outline" onClick={handleClose} disabled={isVerifying}>
            Fechar
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={() => handleVerify()}
            disabled={isVerifying || (!inputHash && !computedFileHash)}
            className="gap-1.5 shadow-glow"
          >
            <ShieldCheck className="w-4 h-4" />
            {isVerifying ? 'Verificando...' : 'Verificar Autenticidade'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
