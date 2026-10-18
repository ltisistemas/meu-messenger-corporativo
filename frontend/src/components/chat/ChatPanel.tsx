import React, { useRef, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  Shield,
  Sparkles,
  Radio,
  Hourglass,
  Lock,
  BarChart2,
  PenTool,
} from 'lucide-react';
import { Conversation, Message } from '../../stores/chat.store';
import { useAuthStore } from '../../stores/auth.store';
import { useSignatureStore } from '../../stores/signature.store';
import { Avatar } from '../ui/Avatar';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { CreatePollModal } from './CreatePollModal';
import { BroadcastReportModal } from './BroadcastReportModal';
import { CreateSignatureModal } from '../signatures/CreateSignatureModal';
import { SignatureDetailsModal } from '../signatures/SignatureDetailsModal';
import { VerifyHashModal } from '../signatures/VerifyHashModal';

export interface ChatPanelProps {
  conversation: Conversation | null;
  messages: Message[];
  isOnline?: boolean;
  typingUserNames?: string[];
  onSendMessage: (content: string) => Promise<void>;
  onSendFile?: (file: File, onProgress?: (percent: number) => void) => Promise<void>;
  onSendTyping: (isTyping: boolean) => void;
  onBackMobile?: () => void;
  isLoading?: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  conversation,
  messages,
  isOnline = false,
  typingUserNames = [],
  onSendMessage,
  onSendFile,
  onSendTyping,
  onBackMobile,
  isLoading = false,
}) => {
  const currentUser = useAuthStore((s) => s.user);
  const isAdminOrOwner = currentUser?.role === 'admin' || currentUser?.role === 'owner';

  const { createSignatureRequest, downloadSignedDocument } = useSignatureStore();

  const [isCreatePollOpen, setIsCreatePollOpen] = useState(false);
  const [isCreateSignatureOpen, setIsCreateSignatureOpen] = useState(false);
  const [detailsSignatureId, setDetailsSignatureId] = useState<string | null>(null);
  const [verifyHashSignatureId, setVerifyHashSignatureId] = useState<string | null>(null);
  const [broadcastReportMessageId, setBroadcastReportMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages, typingUserNames]);

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-slate-950/50">
        <div className="w-16 h-16 rounded-3xl bg-brand-500/10 text-brand-500 flex items-center justify-center mb-4 shadow-sm">
          <Sparkles className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">
          NextMsg Enterprise
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
          Selecione uma conversa ao lado para começar a enviar mensagens protegidas por
          criptografia.
        </p>
      </div>
    );
  }

  const isBroadcast = conversation.type === 'broadcast';
  const isGroup = conversation.type === 'group';
  const name = isBroadcast
    ? conversation.title || 'Comunicados Oficiais'
    : isGroup
      ? conversation.title || 'Grupo sem título'
      : conversation.otherUser?.name || 'Colaborador';
  const avatarUrl = isGroup || isBroadcast ? undefined : conversation.otherUser?.avatarUrl;

  const isExpired =
    conversation.status === 'archived_readonly' ||
    (conversation.isTemporary &&
      conversation.expiresAt &&
      new Date(conversation.expiresAt) <= new Date());

  const isBroadcastBlockedForMember = isBroadcast && !isAdminOrOwner;
  const isComposerDisabled = isExpired || isBroadcastBlockedForMember;

  const formatRemainingTime = (expiresAtIso?: string | null) => {
    if (!expiresAtIso) return null;
    const diffMs = new Date(expiresAtIso).getTime() - Date.now();
    if (diffMs <= 0) return 'Expirado';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `Expira em ${days}d ${hours % 24}h`;
    }
    return `Expira em ${hours}h ${minutes}m`;
  };

  const remainingTimeStr = conversation.isTemporary
    ? formatRemainingTime(conversation.expiresAt)
    : null;

  return (
    <div className="flex flex-col h-full bg-slate-50/70 dark:bg-slate-950/70 relative">
      {/* Header */}
      <div className="px-5 py-3.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {onBackMobile && (
            <button
              onClick={onBackMobile}
              className="md:hidden p-1.5 -ml-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg"
              title="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {isBroadcast ? (
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5" />
            </div>
          ) : (
            <Avatar
              name={name}
              src={avatarUrl}
              isGroup={isGroup}
              status={!isGroup && !isBroadcast && isOnline ? 'online' : undefined}
              size="md"
            />
          )}

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                {name}
              </h2>
              {isBroadcast && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  Canal Oficial
                </span>
              )}
              {isGroup && !isBroadcast && (
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {conversation.members?.length || 1} membros
                </span>
              )}
              {remainingTimeStr && !isExpired && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                  <Hourglass className="w-3 h-3" />
                  {remainingTimeStr}
                </span>
              )}
              {isExpired && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Somente Leitura
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              {isBroadcast ? (
                <span>Comunicados oficiais para toda a organização</span>
              ) : isGroup ? (
                <span>Grupo corporativo com isolamento multi-tenant</span>
              ) : isOnline ? (
                <span className="text-emerald-500 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
              ) : (
                <span>Visto por último recentemente</span>
              )}
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
          {!isBroadcast && (
            <>
              <button
                onClick={() => setIsCreatePollOpen(true)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition text-brand-600 dark:text-brand-400"
                title="Criar enquete"
              >
                <BarChart2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsCreateSignatureOpen(true)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition text-brand-600 dark:text-brand-400"
                title="Solicitar Assinatura Eletrônica (Enterprise)"
              >
                <PenTool className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            title="Chamada de voz (Em breve)"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            title="Chamada de vídeo (Em breve)"
          >
            <Video className="w-4 h-4" />
          </button>
          <button
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            title="Mais opções"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Special Channel / Status Notices */}
      {isExpired ? (
        <div className="px-4 py-2.5 bg-amber-500/10 dark:bg-amber-950/30 border-b border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-center gap-2 font-medium">
          <Lock className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            Este grupo temporário expirou e foi arquivado como <strong>somente leitura</strong>. O
            envio de novas mensagens está desativado.
          </span>
        </div>
      ) : isBroadcast ? (
        <div className="px-4 py-2 bg-blue-500/10 dark:bg-blue-950/30 border-b border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 flex items-center justify-center gap-2">
          <Radio className="w-3.5 h-3.5 text-blue-500" />
          <span>
            Canal de transmissão:{' '}
            {isAdminOrOwner
              ? 'mensagens enviadas aqui notificam toda a conta com relatório analítico de entrega.'
              : 'apenas administradores podem publicar comunicados.'}
          </span>
        </div>
      ) : (
        <div className="px-4 py-2 bg-brand-500/10 dark:bg-brand-500/15 border-b border-brand-500/20 text-xs text-brand-700 dark:text-brand-300 flex items-center justify-center gap-2">
          <Shield className="w-3.5 h-3.5 text-brand-500" />
          <span>
            Mensagens protegidas por isolamento multi-tenant e política corporativa de zero
            retenção.
          </span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-xs">
            Carregando histórico seguro...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center space-y-2">
            <p className="text-sm font-medium">Nenhuma mensagem ainda.</p>
            <p className="text-xs max-w-xs">
              {isBroadcast
                ? 'Nenhum comunicado oficial publicado até o momento.'
                : 'Envie uma mensagem abaixo para iniciar a conversa segura com seus colegas.'}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isGroup={isGroup}
              onOpenBroadcastReport={(msgId) => setBroadcastReportMessageId(msgId)}
              onOpenSignatureDetails={(sigId) => setDetailsSignatureId(sigId)}
              onDownloadSignedSignature={(sigId) => downloadSignedDocument(sigId)}
              onOpenVerifyHash={(sigId) => setVerifyHashSignatureId(sigId)}
            />
          ))
        )}

        {/* Typing indicator bubble */}
        {typingUserNames.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-brand-500 dark:text-brand-400 italic py-1 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-bounce" />
            <span>
              {typingUserNames.join(', ')} {typingUserNames.length > 1 ? 'estão' : 'está'}{' '}
              digitando...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer or Readonly Notice */}
      {isBroadcastBlockedForMember ? (
        <div className="p-4 bg-slate-100/90 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
          Apenas administradores podem enviar mensagens no canal de Comunicados.
        </div>
      ) : (
        <MessageComposer
          onSendMessage={onSendMessage}
          onSendFile={onSendFile}
          onSendTyping={(isTyping) => onSendTyping(isTyping)}
          onOpenCreatePoll={() => setIsCreatePollOpen(true)}
          onOpenCreateSignature={() => setIsCreateSignatureOpen(true)}
          disabled={isComposerDisabled}
          isRecipientOnline={isOnline}
          recipientName={name}
          isGroup={isGroup}
        />
      )}

      {/* Create Poll Modal */}
      <CreatePollModal
        isOpen={isCreatePollOpen}
        onClose={() => setIsCreatePollOpen(false)}
        conversationId={conversation.id}
      />

      {/* Broadcast Delivery Report Modal */}
      {broadcastReportMessageId && (
        <BroadcastReportModal
          isOpen={Boolean(broadcastReportMessageId)}
          onClose={() => setBroadcastReportMessageId(null)}
          messageId={broadcastReportMessageId}
        />
      )}

      {/* Create Signature Modal */}
      <CreateSignatureModal
        isOpen={isCreateSignatureOpen}
        onClose={() => setIsCreateSignatureOpen(false)}
        conversationId={conversation.id}
        onSubmit={async (dto) => {
          await createSignatureRequest(dto);
        }}
      />

      {/* Signature Details & Tracking Modal */}
      <SignatureDetailsModal
        isOpen={Boolean(detailsSignatureId)}
        onClose={() => setDetailsSignatureId(null)}
        signatureId={detailsSignatureId}
        onOpenVerifyHash={(sigId) => {
          setDetailsSignatureId(null);
          setVerifyHashSignatureId(sigId);
        }}
      />

      {/* Verify Document Hash Modal */}
      <VerifyHashModal
        isOpen={Boolean(verifyHashSignatureId)}
        onClose={() => setVerifyHashSignatureId(null)}
        signatureId={verifyHashSignatureId}
      />
    </div>
  );
};
