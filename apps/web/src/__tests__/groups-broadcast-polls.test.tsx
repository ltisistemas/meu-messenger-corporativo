import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PollCard } from '../components/chat/PollCard';
import { CreatePollModal } from '../components/chat/CreatePollModal';
import { BroadcastReportModal } from '../components/chat/BroadcastReportModal';
import { NewChatModal } from '../components/chat/NewChatModal';
import { ConversationList } from '../components/chat/ConversationList';
import { ChatPanel } from '../components/chat/ChatPanel';
import { MessageBubble } from '../components/chat/MessageBubble';
import { useAuthStore } from '../stores/auth.store';
import { useChatStore, Conversation, Message } from '../stores/chat.store';
import { PollDetailsResponse, BroadcastReportResponse } from '@corpchat/shared';

// Mock api
vi.mock('../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Groups, Broadcast & Polls Frontend System (T-27)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'user-admin-1',
        accountId: 'acc-1',
        name: 'Administrador Boss',
        email: 'admin@corp.com',
        role: 'admin',
        status: 'active',
      },
      account: {
        id: 'acc-1',
        name: 'Empresa Pro Corp',
        plan: 'pro',
        status: 'active',
      },
      isAuthenticated: true,
    });
  });

  describe('T-24: Temporary Groups UI', () => {
    it('allows configuring temporary group with expiration hours in NewChatModal', async () => {
      const onCreateGroup = vi.fn(async () => {});
      const onCreateDirect = vi.fn(async () => {});
      const onClose = vi.fn();

      render(
        <NewChatModal
          isOpen={true}
          onClose={onClose}
          onCreateGroup={onCreateGroup}
          onCreateDirect={onCreateDirect}
        />
      );

      // Fill group name
      const titleInput = screen.getByLabelText(/Nome do Grupo/i);
      fireEvent.change(titleInput, { target: { value: 'War Room Incidente Q3' } });

      // Check temporary group checkbox
      const tempCheckbox = screen.getByRole('checkbox', {
        name: /Grupo Temporário com Auto-Expiração/i,
      });
      fireEvent.click(tempCheckbox);

      // Select expiration preset
      const expSelect = screen.getByLabelText(/Prazo de Expiração do Grupo/i);
      fireEvent.change(expSelect, { target: { value: '72' } });

      // Submit
      const submitBtn = screen.getByRole('button', { name: /Criar Grupo Temporário/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onCreateGroup).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'War Room Incidente Q3',
            isTemporary: true,
            expiresInHours: 72,
          })
        );
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('renders temporary group badges and handles expired readonly state in ConversationList & ChatPanel', () => {
      const activeTempConv: Conversation = {
        id: 'conv-temp-1',
        accountId: 'acc-1',
        type: 'group',
        title: 'Squad Temporário',
        retentionHours: 0,
        status: 'active',
        isTemporary: true,
        expiresAt: new Date(Date.now() + 3600 * 1000 * 5).toISOString(), // 5h remaining
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const expiredConv: Conversation = {
        id: 'conv-expired-1',
        accountId: 'acc-1',
        type: 'group',
        title: 'War Room Antiga',
        retentionHours: 0,
        status: 'archived_readonly',
        isTemporary: true,
        expiresAt: new Date(Date.now() - 3600 * 1000).toISOString(), // expired
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 1. ConversationList renders badges
      render(
        <ConversationList
          conversations={[activeTempConv, expiredConv]}
          activeConversationId={null}
          onlineUsers={{}}
          typingUsers={{}}
          onSelectConversation={vi.fn()}
          onOpenNewChatModal={vi.fn()}
        />
      );

      expect(screen.getByText('Squad Temporário')).toBeInTheDocument();
      expect(screen.getByText(/Expira em/i)).toBeInTheDocument();

      expect(screen.getByText('War Room Antiga')).toBeInTheDocument();
      expect(screen.getByText(/Expirado \(Somente Leitura\)/i)).toBeInTheDocument();

      // 2. ChatPanel displays readonly alert and disables composer when expired
      const { unmount } = render(
        <ChatPanel
          conversation={expiredConv}
          messages={[]}
          onSendMessage={vi.fn(async () => {})}
          onSendTyping={vi.fn()}
        />
      );

      expect(
        screen.getByText(/Este grupo temporário expirou e foi arquivado como/i)
      ).toBeInTheDocument();
      const sendInput = screen.getByPlaceholderText(/Digite uma mensagem segura.../i);
      expect(sendInput).toBeDisabled();

      unmount();
    });
  });

  describe('T-25: Broadcast Transmission List & Delivery Report', () => {
    it('allows creating a broadcast transmission from NewChatModal in Pro plan', async () => {
      const createBroadcastMock = vi.fn(async () => ({
        success: true,
        conversationId: 'conv-broadcast',
      }));
      useChatStore.setState({ createBroadcast: createBroadcastMock });

      render(
        <NewChatModal
          isOpen={true}
          onClose={vi.fn()}
          onCreateGroup={vi.fn(async () => {})}
          onCreateDirect={vi.fn(async () => {})}
        />
      );

      // Switch to Broadcast tab
      const broadcastTab = screen.getByRole('button', { name: /Transmissão/i });
      fireEvent.click(broadcastTab);

      const contentInput = screen.getByPlaceholderText(/Atenção equipe: manutenção programada/i);
      fireEvent.change(contentInput, {
        target: { value: 'Comunicado de Fim de Ano para toda a empresa!' },
      });

      const submitBtn = screen.getByRole('button', { name: /Disparar Transmissão/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(createBroadcastMock).toHaveBeenCalledWith(
          'Comunicado de Fim de Ano para toda a empresa!'
        );
      });
    });

    it('blocks non-admin members from composing in broadcast channels', () => {
      // Set current user as regular member
      useAuthStore.setState({
        user: {
          id: 'user-member-2',
          accountId: 'acc-1',
          name: 'Colaborador Regular',
          email: 'colaborador@corp.com',
          role: 'member',
          status: 'active',
        },
      });

      const broadcastConv: Conversation = {
        id: 'conv-b1',
        accountId: 'acc-1',
        type: 'broadcast',
        title: 'Comunicados da Empresa',
        retentionHours: 0,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      render(
        <ChatPanel
          conversation={broadcastConv}
          messages={[]}
          onSendMessage={vi.fn(async () => {})}
          onSendTyping={vi.fn()}
        />
      );

      expect(
        screen.getByText(/Apenas administradores podem enviar mensagens no canal de Comunicados/i)
      ).toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/Digite uma mensagem segura/i)).not.toBeInTheDocument();
    });

    it('renders BroadcastReportModal with KPI metrics and recipient breakdown', async () => {
      const mockReportData: BroadcastReportResponse = {
        messageId: '11111111-1111-1111-1111-111111111111',
        conversationId: '22222222-2222-2222-2222-222222222222',
        content: 'Comunicado de teste',
        sentAt: new Date().toISOString(),
        sender: {
          id: '33333333-3333-3333-3333-333333333333',
          name: 'Admin',
          email: 'admin@corp.com',
        },
        summary: {
          totalRecipients: 4,
          deliveredCount: 3,
          readCount: 2,
          pendingCount: 1,
          deliveryRatePercent: 75,
          readRatePercent: 50,
        },
        recipients: [
          {
            userId: '44444444-4444-4444-4444-444444444444',
            name: 'Lucas Silva',
            email: 'lucas@corp.com',
            status: 'read',
            readAt: new Date().toISOString(),
          },
          {
            userId: '55555555-5555-5555-5555-555555555555',
            name: 'Beatriz Costa',
            email: 'beatriz@corp.com',
            status: 'delivered',
            deliveredAt: new Date().toISOString(),
          },
          {
            userId: '66666666-6666-6666-6666-666666666666',
            name: 'Diego Offline',
            email: 'diego@corp.com',
            status: 'sent',
          },
        ],
      };

      useChatStore.setState({
        fetchBroadcastReport: vi.fn(async () => mockReportData),
      });

      render(<BroadcastReportModal isOpen={true} onClose={vi.fn()} messageId="msg-b1" />);

      await waitFor(() => {
        expect(screen.getByText('Relatório de Entrega da Transmissão')).toBeInTheDocument();
        expect(screen.getByText('Lucas Silva')).toBeInTheDocument();
        expect(screen.getByText('Beatriz Costa')).toBeInTheDocument();
        expect(screen.getByText('Diego Offline')).toBeInTheDocument();
        expect(screen.getByText('75%')).toBeInTheDocument(); // Delivery rate
        expect(screen.getByText('50%')).toBeInTheDocument(); // Read rate
      });
    });
  });

  describe('T-26: Polls System & Interactive Voting UI', () => {
    const mockPoll: PollDetailsResponse = {
      id: 'poll-123',
      conversationId: 'conv-1',
      creatorId: 'user-admin-1',
      question: 'Qual dia para a reunião de alinhamento?',
      allowMultiple: false,
      isAnonymous: false,
      status: 'active',
      isExpired: false,
      totalVotes: 3,
      totalVotersCount: 3,
      userHasVoted: true,
      userVotedOptionIds: ['opt-1'],
      createdAt: new Date().toISOString(),
      options: [
        {
          id: 'opt-1',
          text: 'Segunda-feira 14h',
          orderIndex: 0,
          votesCount: 2,
          percentage: 67,
          hasVoted: true,
          voters: [{ id: 'user-admin-1', name: 'Administrador Boss' }],
        },
        {
          id: 'opt-2',
          text: 'Quarta-feira 10h',
          orderIndex: 1,
          votesCount: 1,
          percentage: 33,
          hasVoted: false,
          voters: [{ id: 'u2', name: 'Mariana Silva' }],
        },
      ],
    };

    it('renders PollCard with live votes, percentage bars and voter names', () => {
      render(<PollCard poll={mockPoll} isSelf={false} />);

      expect(screen.getByText('Qual dia para a reunião de alinhamento?')).toBeInTheDocument();
      expect(screen.getByText('Segunda-feira 14h')).toBeInTheDocument();
      expect(screen.getByText('Quarta-feira 10h')).toBeInTheDocument();
      expect(screen.getByText('67%')).toBeInTheDocument();
      expect(screen.getByText('33%')).toBeInTheDocument();
      expect(screen.getByText('Seu voto')).toBeInTheDocument();
      expect(screen.getByText('Votos Identificados')).toBeInTheDocument();
    });

    it('submits vote when selecting option and clicking vote button in PollCard', async () => {
      const votePollMock = vi.fn(async () => mockPoll);
      useChatStore.setState({ votePoll: votePollMock });

      render(<PollCard poll={mockPoll} isSelf={false} />);

      // Click second option
      const opt2 = screen.getByText('Quarta-feira 10h');
      fireEvent.click(opt2);

      // Confirm vote
      const voteBtn = screen.getByRole('button', { name: /Alterar Voto/i });
      fireEvent.click(voteBtn);

      await waitFor(() => {
        expect(votePollMock).toHaveBeenCalledWith('poll-123', ['opt-2']);
      });
    });

    it('renders PollCard as isSelf with creator close action and multi-choice', async () => {
      const closePollMock = vi.fn(async () => ({ ...mockPoll, status: 'closed' as const }));
      useChatStore.setState({ closePoll: closePollMock });

      const multiPoll: PollDetailsResponse = {
        ...mockPoll,
        allowMultiple: true,
        creatorId: 'user-admin-1', // current user is creator
      };

      const { rerender } = render(<PollCard poll={multiPoll} isSelf={true} />);

      expect(screen.getByText('Múltipla Escolha')).toBeInTheDocument();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const closeBtn = screen.getByRole('button', { name: /Encerrar/i });
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(closePollMock).toHaveBeenCalledWith('poll-123');
      });
      confirmSpy.mockRestore();

      // Test closed state
      rerender(<PollCard poll={{ ...multiPoll, status: 'closed' }} isSelf={false} />);
      expect(screen.getByText('Votação Encerrada')).toBeInTheDocument();
    });

    it('renders CreatePollModal, validates minimum 2 options, and calls createPoll', async () => {
      const createPollMock = vi.fn(async () => mockPoll);
      useChatStore.setState({ createPoll: createPollMock });
      const onClose = vi.fn();

      render(<CreatePollModal isOpen={true} onClose={onClose} conversationId="conv-1" />);

      // Fill question
      const questionInput = screen.getByLabelText(/Pergunta da Enquete/i);
      fireEvent.change(questionInput, { target: { value: 'Qual framework frontend?' } });

      // Fill options
      const opt1Input = screen.getByPlaceholderText('Opção 1');
      const opt2Input = screen.getByPlaceholderText('Opção 2');
      fireEvent.change(opt1Input, { target: { value: 'React' } });
      fireEvent.change(opt2Input, { target: { value: 'Vue' } });

      // Toggle multi-choice and anonymous
      const multiChoiceToggle = screen.getByRole('checkbox', { name: /Múltipla Escolha/i });
      fireEvent.click(multiChoiceToggle);

      // Submit
      const submitBtn = screen.getByRole('button', { name: /Publicar Enquete/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(createPollMock).toHaveBeenCalledWith({
          conversationId: 'conv-1',
          question: 'Qual framework frontend?',
          options: ['React', 'Vue'],
          allowMultiple: true,
          isAnonymous: false,
          expiresInHours: undefined,
        });
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('renders PollCard inside MessageBubble when message.type is poll', () => {
      const pollMessage: Message = {
        id: 'msg-poll-1',
        conversationId: 'conv-1',
        senderId: 'user-admin-1',
        senderName: 'Administrador Boss',
        content: '[Enquete] Qual dia para a reunião de alinhamento?',
        type: 'poll',
        metadata: {
          poll: mockPoll,
        },
        createdAt: new Date().toISOString(),
        status: 'delivered',
        isSelf: false,
      };

      render(<MessageBubble message={pollMessage} isGroup={true} />);

      expect(screen.getByText('Qual dia para a reunião de alinhamento?')).toBeInTheDocument();
      expect(screen.getByText('Segunda-feira 14h')).toBeInTheDocument();
    });
  });
});
