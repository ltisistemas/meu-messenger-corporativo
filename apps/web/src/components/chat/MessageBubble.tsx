import React from 'react';
import { Check, CheckCheck, Clock, FileText, Download, BarChart3, Radio } from 'lucide-react';
import { extractCloudLinks, URL_REGEX } from '@corpchat/shared';
import { Message } from '../../stores/chat.store';
import { CloudLinkCard } from './CloudLinkCard';
import { PollCard } from './PollCard';
import { SignatureCard } from '../signatures/SignatureCard';

export interface MessageBubbleProps {
  message: Message;
  isGroup?: boolean;
  onOpenBroadcastReport?: (messageId: string) => void;
  onOpenSignatureDetails?: (signatureId: string) => void;
  onDownloadSignedSignature?: (signatureId: string) => void;
  onOpenVerifyHash?: (signatureId: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isGroup = false,
  onOpenBroadcastReport,
  onOpenSignatureDetails,
  onDownloadSignedSignature,
  onOpenVerifyHash,
}) => {
  const isSelf = message.isSelf;

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const calculateRemainingTime = (expiresAtIso?: string | null) => {
    if (!expiresAtIso) return null;
    const diffMs = new Date(expiresAtIso).getTime() - Date.now();
    if (diffMs <= 0) return 'Expirando...';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const remainingRetention = calculateRemainingTime(message.retentionExpiresAt);

  // Extract cloud storage link previews from message text
  const detectedCloudLinks = message.content ? extractCloudLinks(message.content) : [];

  // Helper to render text with clickable links
  const renderMessageContent = (content: string) => {
    const parts = content.split(URL_REGEX);
    return parts.map((part, index) => {
      if (part.match(URL_REGEX)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline font-medium break-all transition ${
              isSelf
                ? 'text-cyan-200 hover:text-white'
                : 'text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300'
            }`}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  // If this message is a poll message, render PollCard
  if (message.type === 'poll' && message.metadata?.poll) {
    return (
      <div className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} space-y-1 w-full`}>
        {!isSelf && isGroup && message.senderName && (
          <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 px-1">
            {message.senderName}
          </span>
        )}
        <PollCard poll={message.metadata.poll} isSelf={isSelf} />
      </div>
    );
  }

  // If this message is a signature envelope, render SignatureCard
  if ((message.type === 'signature' || message.metadata?.signature) && message.metadata?.signature) {
    return (
      <div className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} space-y-1 w-full`}>
        {!isSelf && isGroup && message.senderName && (
          <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 px-1">
            {message.senderName}
          </span>
        )}
        <SignatureCard
          signature={message.metadata.signature}
          isSelf={isSelf}
          onOpenDetails={(sigId) => onOpenSignatureDetails?.(sigId)}
          onDownloadSigned={(sigId) => onDownloadSignedSignature?.(sigId)}
          onOpenVerifyHash={(sigId) => onOpenVerifyHash?.(sigId)}
        />
      </div>
    );
  }

  const isBroadcastMsg =
    message.metadata?.isBroadcast ||
    message.metadata?.broadcastMessageId !== undefined ||
    message.metadata?.totalRecipients !== undefined;

  return (
    <div className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} space-y-1`}>
      {!isSelf && isGroup && message.senderName && (
        <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 px-1">
          {message.senderName}
        </span>
      )}

      <div
        className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm relative group transition ${
          isSelf
            ? 'bg-brand-600 text-white rounded-tr-none'
            : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800/80 rounded-tl-none'
        }`}
      >
        {/* Broadcast badge if broadcast message */}
        {isBroadcastMsg && (
          <div
            className={`mb-2 pb-1.5 flex items-center justify-between gap-2 border-b text-[11px] font-semibold ${
              isSelf
                ? 'border-brand-500/40 text-cyan-200'
                : 'border-slate-200 dark:border-slate-800 text-brand-600 dark:text-brand-400'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5" />
              <span>Comunicado Oficial</span>
            </div>

            {onOpenBroadcastReport && (
              <button
                type="button"
                onClick={() => onOpenBroadcastReport(message.id)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition ${
                  isSelf
                    ? 'bg-brand-700 hover:bg-brand-800 text-white'
                    : 'bg-brand-50 dark:bg-brand-950/40 hover:bg-brand-100 text-brand-600 dark:text-brand-400'
                }`}
                title="Visualizar relatório de entrega e leitura"
              >
                <BarChart3 className="w-3 h-3" />
                <span>Relatório</span>
              </button>
            )}
          </div>
        )}

        {/* Attachment / File Card if present */}
        {(message.type === 'file' || message.attachmentName || message.attachmentUrl) && (
          <div
            className={`mb-2 p-2.5 rounded-xl flex flex-col gap-2 border ${
              isSelf
                ? 'bg-brand-700/60 border-brand-500/40 text-white'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between gap-3 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-5 h-5 shrink-0 text-brand-300 dark:text-brand-400" />
                <div className="truncate text-xs">
                  <p className="font-semibold truncate">
                    {message.attachmentName || message.content || 'Arquivo anexo'}
                  </p>
                  {message.attachmentSize && (
                    <p className="opacity-70 text-[10px]">
                      {(message.attachmentSize / (1024 * 1024)).toFixed(1)} MB
                    </p>
                  )}
                </div>
              </div>

              {message.attachmentUrl && (
                <a
                  href={message.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition shrink-0"
                  title="Baixar arquivo"
                >
                  <Download className="w-4 h-4" />
                </a>
              )}
            </div>

            {/* Free Plan Group Delivery Indicator ("Entregue a X de Y") */}
            {(message.metadata?.deliverySummary ||
              (message.metadata?.deliveredToCount !== undefined &&
                message.metadata?.totalRecipientsCount !== undefined)) && (
              <div
                className={`flex items-center gap-1.5 text-[10.5px] font-medium pt-1.5 border-t ${
                  isSelf
                    ? 'border-brand-500/30 text-cyan-200'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>
                  {message.metadata?.deliverySummary ||
                    `Entregue a ${message.metadata?.deliveredToCount} de ${message.metadata?.totalRecipientsCount}`}
                </span>
                {message.metadata?.transferMethod === 'relay_memory' && (
                  <span className="opacity-75 text-[9.5px]">(somente online)</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Message Text Content (for text messages or text accompanying files) */}
        {message.content && message.type !== 'file' && (
          <div className="text-sm leading-relaxed whitespace-pre-wrap select-text break-words">
            {renderMessageContent(message.content)}
          </div>
        )}

        {/* Rich Cloud Link Cards (Google Drive, OneDrive, Dropbox, etc.) */}
        {detectedCloudLinks.length > 0 && (
          <div className="flex flex-col gap-2 my-1">
            {detectedCloudLinks.map((link) => (
              <CloudLinkCard key={link.url} link={link} isSelf={isSelf} />
            ))}
          </div>
        )}

        {/* Footer info: Retention countdown, timestamp, and read ticks */}
        <div
          className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
            isSelf ? 'text-brand-200' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {remainingRetention && (
            <span
              className="flex items-center gap-0.5 text-amber-300 dark:text-amber-400 mr-1 font-medium"
              title={`Auto-destruição em ${remainingRetention}`}
            >
              <Clock className="w-2.5 h-2.5" />
              {remainingRetention}
            </span>
          )}

          <span>{formatTime(message.createdAt)}</span>

          {isSelf && (
            <span>
              {message.status === 'read' ? (
                <span title="Lido">
                  <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />
                </span>
              ) : message.status === 'delivered' ? (
                <span title="Entregue">
                  <CheckCheck className="w-3.5 h-3.5 text-brand-200" />
                </span>
              ) : (
                <span title="Enviado">
                  <Check className="w-3.5 h-3.5 text-brand-200" />
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

