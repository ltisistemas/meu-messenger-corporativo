import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  Clock,
  Download,
  Copy,
  Check,
  ShieldCheck,
  Hash,
  Sparkles,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useSignatureStore } from '../../stores/signature.store';

export interface SignatureDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  signatureId: string | null;
  onOpenVerifyHash?: (signatureId: string) => void;
}

export const SignatureDetailsModal: React.FC<SignatureDetailsModalProps> = ({
  isOpen,
  onClose,
  signatureId,
  onOpenVerifyHash,
}) => {
  const {
    activeSignature,
    evidenceReport,
    fetchSignatureDetails,
    fetchEvidenceReport,
    simulateSign,
    downloadSignedDocument,
    downloadEvidencePdf,
  } = useSignatureStore();

  const [activeTab, setActiveTab] = useState<'signers' | 'evidence'>('signers');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [simulatingSignerId, setSimulatingSignerId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && signatureId) {
      setActionError(null);
      fetchSignatureDetails(signatureId).catch(() => {});
      fetchEvidenceReport(signatureId).catch(() => {});
    }
  }, [isOpen, signatureId, fetchSignatureDetails, fetchEvidenceReport]);

  if (!isOpen || !signatureId || !activeSignature) {
    return null;
  }

  const isClosed = activeSignature.status === 'closed';
  const progressPercent = activeSignature.signersCount > 0
    ? Math.round((activeSignature.signedCount / activeSignature.signersCount) * 100)
    : 0;

  const handleCopySignUrl = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleSimulateSign = async (signerId: string) => {
    try {
      setActionError(null);
      setSimulatingSignerId(signerId);
      await simulateSign(activeSignature.id, signerId);
      await fetchEvidenceReport(activeSignature.id);
    } catch (err: any) {
      setActionError(err.message || 'Erro ao simular assinatura.');
    } finally {
      setSimulatingSignerId(null);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setActionError(null);
      await downloadSignedDocument(
        activeSignature.id,
        `${activeSignature.documentName.replace('.pdf', '')}_assinado.pdf`
      );
    } catch (err: any) {
      setActionError(err.message || 'Falha ao baixar PDF assinado.');
    }
  };

  const handleDownloadEvidence = async () => {
    try {
      setActionError(null);
      await downloadEvidencePdf(
        activeSignature.id,
        `${activeSignature.documentName.replace('.pdf', '')}_certificado_evidencias.pdf`
      );
    } catch (err: any) {
      setActionError(err.message || 'Falha ao baixar certificado de evidências.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Acompanhamento do Documento Eletrônico"
      maxWidth="lg"
    >
      <div className="p-6 space-y-6">
        {actionError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Document Overview Card */}
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-xl">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {activeSignature.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {activeSignature.documentName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isClosed ? (
                <Badge variant="emerald" className="text-xs font-semibold gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 100% Assinado
                </Badge>
              ) : (
                <Badge variant="amber" className="text-xs font-semibold gap-1">
                  <Clock className="w-3.5 h-3.5" /> Em Andamento
                </Badge>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Status das Assinaturas</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {activeSignature.signedCount} de {activeSignature.signersCount} signatários ({progressPercent}%)
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  isClosed ? 'bg-emerald-500' : 'bg-brand-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* SHA-256 Hashes & Legal Framework */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/80 dark:border-slate-800 text-[11px]">
            <div>
              <span className="text-slate-400 block mb-0.5">Hash SHA-256 Original:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300 break-all">
                {activeSignature.originalSha256}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Hash SHA-256 Assinado:</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 break-all">
                {activeSignature.signedSha256 || 'Pendente (calculado ao finalizar)'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 gap-6 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('signers')}
            className={`pb-3 border-b-2 transition ${
              activeTab === 'signers'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            Signatários ({activeSignature.signers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('evidence')}
            className={`pb-3 border-b-2 transition ${
              activeTab === 'evidence'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            Trilha de Evidências (Lei 14.063/2020)
          </button>
        </div>

        {/* Tab 1: Signers List */}
        {activeTab === 'signers' && (
          <div className="space-y-3">
            {activeSignature.signers.map((signer) => {
              const isSigned = signer.status === 'signed';
              const isSimulating = simulatingSignerId === signer.id;

              return (
                <div
                  key={signer.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2.5 rounded-xl mt-0.5 shrink-0 ${
                        isSigned
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {isSigned ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {signer.name}
                        </span>
                        <Badge
                          variant={isSigned ? 'emerald' : 'amber'}
                          className="text-[10px] font-medium"
                        >
                          {isSigned ? 'Assinado' : 'Pendente'}
                        </Badge>
                      </div>

                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {signer.email} • {signer.authType === 'email' ? 'E-mail' : signer.authType.toUpperCase()} • {signer.signAs === 'sign' ? 'Assinatura' : signer.signAs}
                      </div>

                      {signer.signedAt && (
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                          Assinado em {new Date(signer.signedAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {/* Copy Link */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopySignUrl(signer.signUrl, signer.id)}
                      className="text-xs h-8 gap-1"
                      title="Copiar link de assinatura do signatário"
                    >
                      {copiedKey === signer.id ? (
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

                    {/* Simulation button for test mode */}
                    {!isSigned && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleSimulateSign(signer.id)}
                        disabled={isSimulating}
                        className="text-xs h-8 gap-1 shadow-glow"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isSimulating ? 'Assinando...' : 'Simular Assinatura'}</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Evidence Trail */}
        {activeTab === 'evidence' && (
          <div className="space-y-4">
            <div className="p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl text-xs text-brand-700 dark:text-brand-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-brand-500" />
              <span>
                <strong>Validade Jurídica:</strong> {evidenceReport?.legalFramework || 'Conforme Medida Provisória nº 2.200-2/2001 e Lei Federal nº 14.063/2020.'}
              </span>
            </div>

            <div className="space-y-3">
              {(evidenceReport?.events || []).length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Nenhum evento registrado ainda.
                </div>
              ) : (
                evidenceReport?.events.map((ev, i) => (
                  <div
                    key={i}
                    className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                      <span>{ev.signerName} ({ev.signerEmail})</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(ev.signedAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono">
                      <div>IP: {ev.ipAddress}</div>
                      <div>Método: {ev.authType} ({ev.signatureRole})</div>
                      <div className="sm:col-span-2 truncate text-slate-400">
                        Dispositivo: {ev.userAgent}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Action Footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onOpenVerifyHash && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onOpenVerifyHash(activeSignature.id);
                }}
                className="text-xs h-9 gap-1.5 w-full sm:w-auto"
              >
                <Hash className="w-3.5 h-3.5" />
                <span>Verificar Hash</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadEvidence}
              className="text-xs h-9 gap-1.5 w-full sm:w-auto"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Certificado (PDF)</span>
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Fechar
            </Button>

            {isClosed && (
              <Button
                variant="primary"
                onClick={handleDownloadPdf}
                className="gap-1.5 shadow-glow w-full sm:w-auto"
              >
                <Download className="w-4 h-4" />
                <span>Baixar PDF Assinado</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
