import React, { useState } from 'react';
import { Search, Plus, Clock, LogOut, Radio, Hourglass, Lock } from 'lucide-react';
import { Conversation } from '../../stores/chat.store';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onlineUsers: Record<string, boolean>;
  typingUsers: Record<string, Record<string, { name: string; timestamp: number }>>;
  onSelectConversation: (conversationId: string) => void;
  onOpenNewChatModal: () => void;
  onLogout?: () => void;
  accountName?: string;
  planName?: string;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  activeConversationId,
  onlineUsers,
  typingUsers,
  onSelectConversation,
  onOpenNewChatModal,
  onLogout,
  accountName = 'NextMsg Workspace',
  planName = 'Pro',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'groups' | 'broadcast'>('all');

  const filteredConversations = conversations.filter((c) => {
    const isBroadcast = c.type === 'broadcast';
    const isGroup = c.type === 'group';
    const title = isBroadcast
      ? c.title || 'Comunicados Oficiais'
      : isGroup
        ? c.title || 'Grupo sem título'
        : c.otherUser?.name || 'Conversa';

    const lastMsg = c.lastMessage?.content || '';
    const matchesSearch =
      title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lastMsg.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterType === 'unread') return (c.unreadCount || 0) > 0;
    if (filterType === 'groups') return c.type === 'group';
    if (filterType === 'broadcast') return c.type === 'broadcast';
    return true;
  });

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const calculateGroupRemainingTime = (expiresAtIso?: string | null) => {
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

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 select-none">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
              {accountName}
            </h2>
            <Badge variant="brand" size="sm" className="capitalize shrink-0">
              {planName}
            </Badge>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={onOpenNewChatModal}
              title="Nova Conversa, Grupo ou Comunicado"
            >
              Novo
            </Button>
            {onLogout && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onLogout}
                title="Sair da conta"
                className="text-slate-400 hover:text-rose-500"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <Input
          placeholder="Buscar conversas..."
          leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 text-xs font-medium rounded-full shrink-0 transition ${
              filterType === 'all'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilterType('unread')}
            className={`px-3 py-1 text-xs font-medium rounded-full shrink-0 transition ${
              filterType === 'unread'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Não lidas
          </button>
          <button
            onClick={() => setFilterType('groups')}
            className={`px-3 py-1 text-xs font-medium rounded-full shrink-0 transition ${
              filterType === 'groups'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Grupos
          </button>
          <button
            onClick={() => setFilterType('broadcast')}
            className={`px-3 py-1 text-xs font-medium rounded-full shrink-0 transition ${
              filterType === 'broadcast'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Comunicados
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Nenhuma conversa encontrada.</div>
        ) : (
          filteredConversations.map((conv) => {
            const isSelected = conv.id === activeConversationId;
            const isBroadcast = conv.type === 'broadcast';
            const isGroup = conv.type === 'group';

            const name = isBroadcast
              ? conv.title || 'Comunicados Oficiais'
              : isGroup
                ? conv.title || 'Grupo sem título'
                : conv.otherUser?.name || 'Colaborador';

            const avatarUrl = isGroup || isBroadcast ? undefined : conv.otherUser?.avatarUrl;
            const isOnline =
              !isGroup && !isBroadcast && conv.otherUser ? onlineUsers[conv.otherUser.id] : false;

            const isExpiredGroup =
              conv.status === 'archived_readonly' ||
              (conv.isTemporary && conv.expiresAt && new Date(conv.expiresAt) <= new Date());

            const remainingGroupTime = conv.isTemporary
              ? calculateGroupRemainingTime(conv.expiresAt)
              : null;

            const convTyping = typingUsers[conv.id];
            const typingUserNames = convTyping ? Object.values(convTyping).map((u) => u.name) : [];
            const isTyping = typingUserNames.length > 0;

            const lastMessageText = isTyping
              ? `${typingUserNames[0]} está digitando...`
              : conv.lastMessage?.content ||
                (isBroadcast ? 'Canal oficial de transmissão' : 'Nenhuma mensagem');

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors relative ${
                  isSelected
                    ? 'bg-brand-500/10 dark:bg-brand-500/15 border-l-4 border-brand-500'
                    : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                }`}
              >
                {isBroadcast ? (
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Radio className="w-5 h-5" />
                  </div>
                ) : (
                  <Avatar
                    name={name}
                    src={avatarUrl}
                    isGroup={isGroup}
                    status={isOnline ? 'online' : undefined}
                    size="md"
                  />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                        {name}
                      </h3>
                      {isBroadcast && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                          Oficial
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                      {formatRelativeTime(conv.lastMessage?.createdAt || conv.updatedAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-xs truncate ${
                        isTyping
                          ? 'text-brand-500 font-medium italic'
                          : (conv.unreadCount || 0) > 0
                            ? 'text-slate-900 dark:text-slate-100 font-medium'
                            : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {lastMessageText}
                    </p>

                    {(conv.unreadCount || 0) > 0 && (
                      <span className="shrink-0 w-5 h-5 bg-brand-500 text-white rounded-full text-[11px] font-bold flex items-center justify-center shadow-glow">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Temporary Group / Expiration Badges */}
                  {isExpiredGroup ? (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                      <Lock className="w-3 h-3 text-slate-400" />
                      <span>Expirado (Somente Leitura)</span>
                    </div>
                  ) : remainingGroupTime ? (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-500 font-medium">
                      <Hourglass className="w-3 h-3" />
                      <span>{remainingGroupTime}</span>
                    </div>
                  ) : conv.retentionHours > 0 ? (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                      <Clock className="w-3 h-3" />
                      <span>Retenção {conv.retentionHours}h</span>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
