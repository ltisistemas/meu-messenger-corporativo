import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { NavItemKey } from '../components/layout/SidebarNav';
import { ConversationList } from '../components/chat/ConversationList';
import { ChatPanel } from '../components/chat/ChatPanel';
import { NewChatModal } from '../components/chat/NewChatModal';
import { QuotaWarningBanner } from '../components/account/QuotaWarningBanner';
import { useAuthStore } from '../stores/auth.store';
import { useChatStore } from '../stores/chat.store';
import { useSocketStore } from '../stores/socket.store';
import { useAccountStore } from '../stores/account.store';

export const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const { account, logout } = useAuthStore();
  const {
    conversations,
    activeConversationId,
    messages,
    onlineUsers,
    typingUsers,
    isLoadingMessages,
    fetchConversations,
    selectConversation,
    sendMessage,
    sendFileRelay,
    createGroupConversation,
    createDirectConversation,
    sendTyping,
    initializeSocketListeners,
  } = useChatStore();

  const { accountDetails, fetchAccountDetails } = useAccountStore();
  const { connect: connectSocket, disconnect: disconnectSocket } = useSocketStore();

  const [activeTab, setActiveTab] = useState<NavItemKey>('chats');
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

  useEffect(() => {
    connectSocket();
    initializeSocketListeners();
    fetchConversations();
    fetchAccountDetails();

    return () => {
      disconnectSocket();
    };
  }, [connectSocket, disconnectSocket, initializeSocketListeners, fetchConversations, fetchAccountDetails]);

  const handleSelectTab = (tab: NavItemKey) => {
    if (tab === 'settings') {
      navigate('/account');
      return;
    }
    setActiveTab(tab);
  };

  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) || null;
  const activeMessages = activeConversationId ? messages[activeConversationId] || [] : [];

  const handleSelectConversation = (id: string) => {
    selectConversation(id);
    setIsMobileChatOpen(true);
  };

  const handleSendMessage = async (content: string) => {
    await sendMessage(content, 'text');
  };

  const handleSendTyping = (isTyping: boolean) => {
    if (activeConversationId) {
      sendTyping(activeConversationId, isTyping);
    }
  };

  const handleCreateGroup = async (
    options: any,
    memberIds?: string[],
    retentionHours?: number
  ) => {
    await createGroupConversation(options, memberIds, retentionHours);
  };

  const handleCreateDirect = async (userId: string) => {
    await createDirectConversation(userId);
  };

  const convTyping = activeConversationId ? typingUsers[activeConversationId] : undefined;
  const activeTypingNames = convTyping ? Object.values(convTyping).map((u) => u.name) : [];

  const isContactOnline =
    activeConversation && activeConversation.type === 'direct' && activeConversation.otherUser
      ? onlineUsers[activeConversation.otherUser.id] || false
      : false;

  const sidebarContent = (
    <ConversationList
      conversations={conversations}
      activeConversationId={activeConversationId}
      onlineUsers={onlineUsers}
      typingUsers={typingUsers}
      onSelectConversation={handleSelectConversation}
      onOpenNewChatModal={() => setIsNewChatModalOpen(true)}
      onLogout={logout}
      accountName={accountDetails?.name || account?.name}
      planName={accountDetails?.plan || account?.plan}
    />
  );

  const mainContent = (
    <div className="flex flex-col h-full w-full">
      <QuotaWarningBanner
        status={accountDetails?.status}
        isOverQuota={accountDetails?.isOverQuota}
        excessUsersCount={accountDetails?.excessUsersCount}
        maxUsers={accountDetails?.maxUsers}
        activeUsersCount={accountDetails?.activeUsersCount}
        planName={(accountDetails?.plan || 'free').toUpperCase()}
        isTrialing={accountDetails?.isTrialing}
        trialDaysRemaining={accountDetails?.trialDaysRemaining}
        onUpgradeClick={() => navigate('/account')}
        onManageMembersClick={() => navigate('/account')}
      />
      <div className="flex-1 min-h-0">
        <ChatPanel
          conversation={activeConversation}
          messages={activeMessages}
          isOnline={isContactOnline}
          typingUserNames={activeTypingNames}
          onSendMessage={handleSendMessage}
          onSendFile={sendFileRelay}
          onSendTyping={handleSendTyping}
          onBackMobile={() => setIsMobileChatOpen(false)}
          isLoading={isLoadingMessages}
        />
      </div>
    </div>
  );

  return (
    <>
      <AppLayout
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        sidebarContent={sidebarContent}
        mainContent={mainContent}
        isChatOpenOnMobile={isMobileChatOpen}
      />

      <NewChatModal
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        onCreateGroup={handleCreateGroup}
        onCreateDirect={handleCreateDirect}
      />
    </>
  );
};

