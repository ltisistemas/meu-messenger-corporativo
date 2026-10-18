import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  X,
  FileText,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Zap,
  BarChart2,
  PenTool,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { PlanType } from '@corpchat/shared';
import { useAuthStore } from '../../stores/auth.store';

export interface MessageComposerProps {
  onSendMessage: (content: string) => Promise<void>;
  onSendFile?: (file: File, onProgress?: (percent: number) => void) => Promise<void>;
  onSendTyping: (isTyping: boolean) => void;
  onOpenCreatePoll?: () => void;
  onOpenCreateSignature?: () => void;
  disabled?: boolean;
  plan?: PlanType;
  isRecipientOnline?: boolean;
  recipientName?: string;
  isGroup?: boolean;
  onlineGroupCount?: number;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  onSendFile,
  onSendTyping,
  onOpenCreatePoll,
  onOpenCreateSignature,
  disabled = false,
  plan: propPlan,
  isRecipientOnline = true,
  recipientName = 'O destinatário',
  isGroup = false,
  onlineGroupCount,
}) => {
  const account = useAuthStore((s) => s.account);
  const currentPlan: PlanType = propPlan || account?.plan || 'free';

  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transferStatus, setTransferStatus] = useState<'idle' | 'streaming' | 'failed'>('idle');
  const [transferProgress, setTransferProgress] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [showOfflineNotice, setShowOfflineNotice] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const isTypingRef = useRef(false);

  // Check if attachment should be disabled due to offline recipient in Free plan
  const isFreePlan = currentPlan === 'free';
  const isAttachmentBlockedByOffline =
    isFreePlan &&
    ((!isGroup && !isRecipientOnline) ||
      (isGroup && onlineGroupCount !== undefined && onlineGroupCount === 0));

  const offlineNoticeMessage = `${recipientName} está offline. No plano Free, arquivos só são enviados para quem está online.`;

  const stopTyping = useCallback(() => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onSendTyping(false);
    }
  }, [onSendTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onSendTyping(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  };

  const handleFileClick = () => {
    if (disabled || isSending) return;

    if (isAttachmentBlockedByOffline) {
      setShowOfflineNotice(true);
      return;
    }

    setShowOfflineNotice(false);
    setFileError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so re-selecting same file triggers change
    e.target.value = '';

    // 1. Check > 25 MB global cloud share suggestion
    if (file.size > 25 * 1024 * 1024) {
      setSelectedFile(null);
      setFileError(
        'Esse arquivo passa de 25 MB. Compartilhe pelo Google Drive e cole o link aqui.'
      );
      return;
    }

    // 2. Check > 5 MB Free plan limit
    if (isFreePlan && file.size > 5 * 1024 * 1024) {
      setSelectedFile(null);
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setFileError(
        `O arquivo (${sizeMB} MB) excede o limite de 5 MB do plano Free. Faça upgrade para o plano Pro para enviar arquivos de até 25 MB.`
      );
      return;
    }

    setFileError(null);
    setSelectedFile(file);
    setTransferStatus('idle');
    setTransferProgress(0);
  };

  const handleSendSelectedFile = async () => {
    if (!selectedFile || !onSendFile || isSending) return;

    setIsSending(true);
    setTransferStatus('streaming');
    setTransferProgress(0);
    setFileError(null);

    try {
      await onSendFile(selectedFile, (progress) => {
        setTransferProgress(progress);
      });

      // Transfer completed successfully
      setSelectedFile(null);
      setTransferStatus('idle');
      setTransferProgress(0);
    } catch (err: any) {
      setTransferStatus('failed');
      setFileError(err.message || 'Falha ao transmitir arquivo em tempo real.');
    } finally {
      setIsSending(false);
    }
  };

  const handleCancelFile = () => {
    setSelectedFile(null);
    setTransferStatus('idle');
    setTransferProgress(0);
    setFileError(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSending || disabled) return;

    // If there is an attached file, send it first
    if (selectedFile) {
      await handleSendSelectedFile();
      return;
    }

    if (!text.trim()) return;

    stopTyping();
    const contentToSend = text.trim();
    setText('');
    setIsSending(true);

    try {
      await onSendMessage(contentToSend);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  return (
    <div className="p-3 sm:p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-t border-slate-200 dark:border-slate-800 transition">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isSending || isAttachmentBlockedByOffline}
      />

      {/* Offline recipient notice banner (State 1: Disabled / Offline) */}
      {showOfflineNotice && isAttachmentBlockedByOffline && (
        <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start justify-between gap-3 animate-fadeIn">
          <div className="flex items-start gap-2.5">
            <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{offlineNoticeMessage}</p>
              <p className="opacity-80 text-[11px] mt-0.5">
                Faça upgrade para o <strong>Plano Pro</strong> para enviar arquivos offline com
                retenção temporária de 5 dias.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowOfflineNotice(false)}
            className="p-1 hover:bg-amber-500/20 rounded-lg transition shrink-0"
            title="Fechar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* File limit exceeded or general error banner (State 2: Limit Exceeded / Error) */}
      {fileError && !selectedFile && (
        <div className="mb-3 p-3 rounded-xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex flex-col gap-2.5 animate-fadeIn">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-950 dark:text-amber-100">{fileError}</p>
                {fileError.includes('25 MB') && (
                  <p className="opacity-85 text-[11px] mt-0.5 text-amber-900 dark:text-amber-300">
                    O NextMsg reconhece automaticamente links de nuvem e exibe um cartão interativo
                    com pré-visualização.
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setFileError(null)}
              className="p-1 hover:bg-amber-500/20 rounded-lg transition shrink-0"
              title="Fechar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Cloud Storage Quick Links when exceeding 25 MB */}
          {fileError.includes('25 MB') && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-amber-500/20">
              <span className="text-[10.5px] font-medium opacity-80 mr-1">Gerar link:</span>
              <a
                href="https://drive.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800 text-amber-800 dark:text-amber-300 hover:bg-white border border-amber-300 dark:border-amber-700/60 transition text-[11px] font-medium shadow-xs"
              >
                <span>Google Drive</span>
              </a>
              <a
                href="https://onedrive.live.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800 text-sky-800 dark:text-sky-300 hover:bg-white border border-sky-300 dark:border-sky-700/60 transition text-[11px] font-medium shadow-xs"
              >
                <span>OneDrive</span>
              </a>
              <a
                href="https://www.dropbox.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800 text-blue-800 dark:text-blue-300 hover:bg-white border border-blue-300 dark:border-blue-700/60 transition text-[11px] font-medium shadow-xs"
              >
                <span>Dropbox</span>
              </a>
            </div>
          )}
        </div>
      )}

      {/* Selected file preview card (States 3 & 4: Progress / Failure with Retry) */}
      {selectedFile && (
        <div
          className={`mb-3 p-3 rounded-2xl border transition animate-fadeIn ${
            transferStatus === 'failed'
              ? 'bg-rose-500/10 border-rose-500/40 text-rose-900 dark:text-rose-200'
              : 'bg-brand-500/10 border-brand-500/30 text-slate-900 dark:text-slate-100'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-brand-500/20 text-brand-600 dark:text-brand-400">
                <FileText className="w-5 h-5" />
              </div>
              <div className="truncate text-xs">
                <p className="font-semibold truncate">{selectedFile.name}</p>
                <p className="opacity-75 text-[11px]">
                  {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB • Relay em streaming (Free)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {transferStatus === 'failed' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSendSelectedFile}
                  disabled={isSending}
                  className="rounded-lg text-xs gap-1 border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reenviar
                </Button>
              )}

              <button
                type="button"
                onClick={handleCancelFile}
                disabled={isSending && transferStatus === 'streaming'}
                className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition"
                title="Cancelar anexo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress bar during streaming */}
          {transferStatus === 'streaming' && (
            <div className="mt-2.5 space-y-1">
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-brand-500 h-full rounded-full transition-all duration-150"
                  style={{ width: `${transferProgress}%` }}
                />
              </div>
              <p className="text-[10.5px] text-brand-600 dark:text-brand-400 font-medium">
                Transmitindo via WebSocket... {transferProgress}%
              </p>
            </div>
          )}

          {/* Error description in failure state */}
          {transferStatus === 'failed' && fileError && (
            <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {fileError}
            </p>
          )}
        </div>
      )}

      {/* Main Composer Form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-slate-400">
          <button
            type="button"
            onClick={handleFileClick}
            className={`p-2 rounded-xl transition ${
              isAttachmentBlockedByOffline
                ? 'opacity-40 cursor-not-allowed hover:bg-transparent text-slate-400'
                : 'hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={
              isAttachmentBlockedByOffline
                ? offlineNoticeMessage
                : 'Anexar arquivo seguro (streaming sem persistência)'
            }
            disabled={disabled || isSending}
            aria-label="Anexar arquivo"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <button
            type="button"
            className="p-2 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            title="Inserir emoji"
            disabled={disabled || isSending}
          >
            <Smile className="w-5 h-5" />
          </button>

          {onOpenCreatePoll && (
            <button
              type="button"
              onClick={onOpenCreatePoll}
              className="p-2 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 rounded-xl transition text-slate-400"
              title="Criar enquete interativa"
              disabled={disabled || isSending}
              aria-label="Criar enquete"
            >
              <BarChart2 className="w-5 h-5" />
            </button>
          )}

          {onOpenCreateSignature && (
            <button
              type="button"
              onClick={onOpenCreateSignature}
              className="p-2 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 rounded-xl transition text-slate-400"
              title="Solicitar Assinatura Eletrônica (Enterprise)"
              disabled={disabled || isSending}
              aria-label="Solicitar Assinatura"
            >
              <PenTool className="w-5 h-5" />
            </button>
          )}
        </div>

        <input
          type="text"
          placeholder={
            selectedFile
              ? 'Pressione Enviar para transmitir o arquivo...'
              : 'Digite uma mensagem segura...'
          }
          value={text}
          onChange={handleInputChange}
          disabled={
            disabled || isSending || (Boolean(selectedFile) && transferStatus === 'streaming')
          }
          className="flex-1 bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 border border-transparent focus:border-brand-500 transition"
        />

        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={
            (!text.trim() && !selectedFile) ||
            isSending ||
            disabled ||
            (Boolean(selectedFile) && transferStatus === 'failed')
          }
          className="rounded-xl px-4 shadow-glow shrink-0 gap-1.5"
        >
          {selectedFile ? (
            <>
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Enviar Anexo</span>
            </>
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </form>
    </div>
  );
};
