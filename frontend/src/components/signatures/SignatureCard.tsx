import React from 'react';
import {
  FileText,
  CheckCircle2,
  Clock,
  Download,
  ShieldCheck,
  PenTool,
  Hash,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { SignatureRequestResponse } from '@/shared';

export interface SignatureCardProps {
  signature: Partial<SignatureRequestResponse> & {
    id?: string;
    title?: string;
    documentName?: string;
    status?: 'draft' | 'running' | 'closed' | 'canceled';
    signersCount?: number;
    signedCount?: number;
    originalSha256?: string | null;
    signedSha256?: string | null;
    [key: string]: any;
  };
  isSelf?: boolean;
  onOpenDetails: (signatureId: string) => void;
  onDownloadSigned?: (signatureId: string) => void;
  onOpenVerifyHash?: (signatureId: string) => void;
}

export const SignatureCard: React.FC<SignatureCardProps> = ({
  signature,
  isSelf = false,
  onOpenDetails,
  onDownloadSigned,
  onOpenVerifyHash,
}) => {
  const isClosed = signature.status === 'closed';
  const isCanceled = signature.status === 'canceled';
  const signersCount = signature.signersCount ?? 0;
  const signedCount = signature.signedCount ?? 0;
  const progressPercent =
    signersCount > 0
      ? Math.round((signedCount / signersCount) * 100)
      : 0;

  return (
    <div
      className={`rounded-2xl p-4 transition border ${
        isSelf
          ? 'bg-slate-900/90 text-white border-brand-500/30'
          : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 shadow-sm'
      } max-w-sm sm:max-w-md w-full space-y-3.5`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-xl shrink-0 mt-0.5">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold leading-tight">{signature.title}</div>
            <div className="text-[11px] text-slate-400 truncate mt-0.5 max-w-[200px] sm:max-w-[240px]">
              {signature.documentName}
            </div>
          </div>
        </div>

        <div>
          {isClosed ? (
            <Badge variant="emerald" className="text-[10px] font-semibold gap-1 shrink-0">
              <CheckCircle2 className="w-3 h-3" /> Assinado
            </Badge>
          ) : isCanceled ? (
            <Badge variant="rose" className="text-[10px] font-semibold gap-1 shrink-0">
              <AlertTriangle className="w-3 h-3" /> Cancelado
            </Badge>
          ) : (
            <Badge variant="amber" className="text-[10px] font-semibold gap-1 shrink-0">
              <Clock className="w-3 h-3" /> Em Andamento
            </Badge>
          )}
        </div>
      </div>

      {/* Progress & Stats */}
      <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            Progresso das Assinaturas
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-200">
            {signedCount} de {signersCount} ({progressPercent}%)
          </span>
        </div>

        <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isClosed ? 'bg-emerald-500' : 'bg-brand-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {signature.originalSha256 && (
          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 pt-0.5 truncate">
            <Hash className="w-3 h-3 shrink-0 text-slate-400" />
            <span className="truncate">SHA-256: {signature.originalSha256.slice(0, 16)}...</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenDetails(signature.id || '')}
          className="text-xs flex-1 gap-1 h-8"
        >
          <PenTool className="w-3.5 h-3.5" />
          <span>Acompanhar & Assinar</span>
        </Button>

        {isClosed && onDownloadSigned && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => onDownloadSigned(signature.id || '')}
            className="text-xs gap-1 h-8 px-3 shadow-glow"
            title="Baixar PDF Assinado"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar PDF</span>
          </Button>
        )}

        {onOpenVerifyHash && (
          <button
            type="button"
            onClick={() => onOpenVerifyHash(signature.id || '')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Verificar Hash de Autenticidade"
          >
            <ShieldCheck className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

