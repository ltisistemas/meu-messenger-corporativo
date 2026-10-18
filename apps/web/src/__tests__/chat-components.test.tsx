import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConversationList } from '../components/chat/ConversationList';
import { ChatPanel } from '../components/chat/ChatPanel';
import { MessageBubble } from '../components/chat/MessageBubble';
import { MessageComposer } from '../components/chat/MessageComposer';
import { NewChatModal } from '../components/chat/NewChatModal';
import { CreatePollModal } from '../components/chat/CreatePollModal';
import { useAuthStore } from '../stores/auth.store';
import { useChatStore, Conversation, Message } from '../stores/chat.store';

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'c1',
    accountId: 'acc1',
    type: 'group',
    title: 'Squad Core',
    retentionHours: 24,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    members: [{ id: 'u1', name: 'Carlos', email: 'carlos@corp.com', role: 'admin' }],
    lastMessage: {
      id: 'm1',
      content: 'Último deploy concluído',
      senderId: 'u1',
      createdAt: new Date().toISOString(),
    },
    unreadCount: 2,
  },
  {
    id: 'c2',
    accountId: 'acc1',
    type: 'direct',
    title: null,
    retentionHours: 0,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    otherUser: {
      id: 'u2',
      name: 'Mariana Souza',
      email: 'mariana@corp.com',
      avatarUrl: null,
    },
    lastMessage: {
      id: 'm2',
      content: 'Contrato assinado?',
      senderId: 'u2',
      createdAt: new Date().toISOString(),
    },
    unreadCount: 0,
  },
];

describe('Chat Components & Real-time UI (T-13 / T-14)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ConversationList', () => {
    it('renders conversation list with unread badges, names, and handles selection', () => {
      const handleSelect = vi.fn();
      render(
        <ConversationList
          conversations={MOCK_CONVERSATIONS}
          activeConversationId="c1"
          onlineUsers={{ u2: true }}
          typingUsers={{}}
          onSelectConversation={handleSelect}
          onOpenNewChatModal={vi.fn()}
        />
      );

      expect(screen.getByText('Squad Core')).toBeInTheDocument();
      expect(screen.getByText('Mariana Souza')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // Unread badge
      expect(screen.getByText('Retenção 24h')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Mariana Souza'));
      expect(handleSelect).toHaveBeenCalledWith('c2');
    });

    it('shows typing status when user is typing in a conversation', () => {
      render(
        <ConversationList
          conversations={MOCK_CONVERSATIONS}
          activeConversationId="c1"
          onlineUsers={{}}
          typingUsers={{ c1: { u3: { name: 'Rafael', timestamp: Date.now() } } }}
          onSelectConversation={vi.fn()}
          onOpenNewChatModal={vi.fn()}
        />
      );

      expect(screen.getByText('Rafael está digitando...')).toBeInTheDocument();
    });

    it('filters conversations by search query', () => {
      render(
        <ConversationList
          conversations={MOCK_CONVERSATIONS}
          activeConversationId="c1"
          onlineUsers={{}}
          typingUsers={{}}
          onSelectConversation={vi.fn()}
          onOpenNewChatModal={vi.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText('Buscar conversas...');
      fireEvent.change(searchInput, { target: { value: 'Mariana' } });

      expect(screen.getByText('Mariana Souza')).toBeInTheDocument();
      expect(screen.queryByText('Squad Core')).not.toBeInTheDocument();
    });
  });

  describe('MessageBubble', () => {
    it('renders outgoing message with read tick status', () => {
      const msg: Message = {
        id: 'msg-1',
        conversationId: 'c1',
        senderId: 'u1',
        content: 'Olá equipe!',
        type: 'text',
        createdAt: new Date().toISOString(),
        status: 'read',
        isSelf: true,
      };

      const { container } = render(<MessageBubble message={msg} />);
      expect(screen.getByText('Olá equipe!')).toBeInTheDocument();
      // Read receipt tick svg
      expect(container.querySelector('.lucide-check-check')).toBeInTheDocument();
    });

    it('renders incoming message with sender name in group and retention countdown', () => {
      const msg: Message = {
        id: 'msg-2',
        conversationId: 'c1',
        senderId: 'u2',
        senderName: 'Rafael Silva',
        content: 'Relatório financeiro anexado.',
        type: 'file',
        attachmentName: 'relatorio-q4.pdf',
        attachmentSize: 1024 * 1024 * 3.5, // 3.5 MB
        attachmentUrl: 'https://example.com/relatorio.pdf',
        retentionExpiresAt: new Date(Date.now() + 3600000 * 20).toISOString(),
        createdAt: new Date().toISOString(),
        status: 'delivered',
        isSelf: false,
      };

      render(<MessageBubble message={msg} isGroup={true} />);
      expect(screen.getByText('Rafael Silva')).toBeInTheDocument();
      expect(screen.getByText('relatorio-q4.pdf')).toBeInTheDocument();
      expect(screen.getByText('3.5 MB')).toBeInTheDocument();
    });

    it('renders file message with partial group delivery indicator "Entregue a 4 de 7" (T-17)', () => {
      const msg: Message = {
        id: 'msg-file-group-1',
        conversationId: 'c1',
        senderId: 'u1',
        content: 'pauta.pdf',
        type: 'file',
        attachmentName: 'pauta.pdf',
        attachmentSize: 1024 * 1024 * 2, // 2 MB
        metadata: {
          fileName: 'pauta.pdf',
          fileSize: 1024 * 1024 * 2,
          transferMethod: 'relay_memory',
          deliveredToCount: 4,
          totalRecipientsCount: 7,
          deliverySummary: 'Entregue a 4 de 7',
          isGroup: true,
        },
        createdAt: new Date().toISOString(),
        status: 'delivered',
        isSelf: true,
      };

      render(<MessageBubble message={msg} isGroup={true} />);
      expect(screen.getByText('pauta.pdf')).toBeInTheDocument();
      expect(screen.getByText('Entregue a 4 de 7')).toBeInTheDocument();
      expect(screen.getByText('(somente online)')).toBeInTheDocument();
    });
  });

  describe('MessageComposer', () => {
    it('submits text and triggers typing events', async () => {
      const handleSend = vi.fn().mockResolvedValue(undefined);
      const handleTyping = vi.fn();

      render(<MessageComposer onSendMessage={handleSend} onSendTyping={handleTyping} />);

      const input = screen.getByPlaceholderText('Digite uma mensagem segura...');
      fireEvent.change(input, { target: { value: 'Mensagem teste' } });

      expect(handleTyping).toHaveBeenCalledWith(true);

      fireEvent.submit(input.closest('form')!);
      await waitFor(() => {
        expect(handleSend).toHaveBeenCalledWith('Mensagem teste');
      });
      expect(input).toHaveValue('');
    });

    it('shows offline notice and blocks attachment when recipient is offline in Free plan (T-18 State 1: Disabled/Offline)', () => {
      render(
        <MessageComposer
          onSendMessage={vi.fn()}
          onSendTyping={vi.fn()}
          plan="free"
          isRecipientOnline={false}
          recipientName="Carlos Offline"
          isGroup={false}
        />
      );

      const attachBtn = screen.getByRole('button', { name: /anexar arquivo/i });
      expect(attachBtn).toHaveAttribute(
        'title',
        'Carlos Offline está offline. No plano Free, arquivos só são enviados para quem está online.'
      );

      // Clicking shows the offline notice banner
      fireEvent.click(attachBtn);
      expect(
        screen.getByText(
          'Carlos Offline está offline. No plano Free, arquivos só são enviados para quem está online.'
        )
      ).toBeInTheDocument();
      expect(screen.getByText(/Faça upgrade para o/i)).toBeInTheDocument();
    });

    it('shows error banner when file exceeds 25 MB suggesting Google Drive (T-18 State 2: Limit Exceeded)', () => {
      const { container } = render(
        <MessageComposer
          onSendMessage={vi.fn()}
          onSendTyping={vi.fn()}
          plan="pro"
          isRecipientOnline={true}
        />
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const oversizedFile = new File(['a'.repeat(100)], 'video.mp4', { type: 'video/mp4' });
      Object.defineProperty(oversizedFile, 'size', { value: 26 * 1024 * 1024 }); // 26 MB

      fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

      expect(
        screen.getByText(
          'Esse arquivo passa de 25 MB. Compartilhe pelo Google Drive e cole o link aqui.'
        )
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Google Drive' })).toHaveAttribute(
        'href',
        'https://drive.google.com'
      );
      expect(screen.getByRole('link', { name: 'OneDrive' })).toHaveAttribute(
        'href',
        'https://onedrive.live.com'
      );
      expect(screen.getByRole('link', { name: 'Dropbox' })).toHaveAttribute(
        'href',
        'https://www.dropbox.com'
      );
    });

    it('shows error banner when file exceeds 5 MB on Free plan (T-18 State 2: Plan Limit Exceeded)', () => {
      const { container } = render(
        <MessageComposer
          onSendMessage={vi.fn()}
          onSendTyping={vi.fn()}
          plan="free"
          isRecipientOnline={true}
        />
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const file6MB = new File(['a'.repeat(100)], 'heavy.pdf', { type: 'application/pdf' });
      Object.defineProperty(file6MB, 'size', { value: 6 * 1024 * 1024 }); // 6 MB

      fireEvent.change(fileInput, { target: { files: [file6MB] } });

      expect(screen.getByText(/excede o limite de 5 MB do plano Free/i)).toBeInTheDocument();
    });

    it('renders streaming progress bar during file transfer (T-18 State 3: Streaming Progress)', async () => {
      let resolveTransfer: () => void = () => {};
      const handleSendFile = vi.fn().mockImplementation((_file, cb) => {
        cb(65);
        return new Promise<void>((resolve) => {
          resolveTransfer = resolve;
        });
      });

      const { container } = render(
        <MessageComposer
          onSendMessage={vi.fn()}
          onSendFile={handleSendFile}
          onSendTyping={vi.fn()}
          plan="free"
          isRecipientOnline={true}
        />
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = new File(['valid file content'], 'apresentacao.pdf', {
        type: 'application/pdf',
      });
      Object.defineProperty(validFile, 'size', { value: 2 * 1024 * 1024 }); // 2 MB

      fireEvent.change(fileInput, { target: { files: [validFile] } });

      expect(screen.getByText('apresentacao.pdf')).toBeInTheDocument();
      expect(screen.getByText(/2.0 MB • Relay em streaming/i)).toBeInTheDocument();

      // Submit file
      const submitBtn = screen.getByRole('button', { name: /enviar anexo/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(handleSendFile).toHaveBeenCalled();
        expect(screen.getByText(/Transmitindo via WebSocket... 65%/i)).toBeInTheDocument();
      });

      // Complete transfer
      resolveTransfer();
    });

    it('displays failure state with Reenviar retry button upon streaming error (T-18 State 4: Failure & Retry)', async () => {
      const handleSendFile = vi
        .fn()
        .mockRejectedValueOnce(new Error('Queda de conexão WebSocket.'));

      const { container } = render(
        <MessageComposer
          onSendMessage={vi.fn()}
          onSendFile={handleSendFile}
          onSendTyping={vi.fn()}
          plan="free"
          isRecipientOnline={true}
        />
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = new File(['conteudo'], 'relatorio.pdf', { type: 'application/pdf' });
      Object.defineProperty(validFile, 'size', { value: 1 * 1024 * 1024 });

      fireEvent.change(fileInput, { target: { files: [validFile] } });

      const submitBtn = screen.getByRole('button', { name: /enviar anexo/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Queda de conexão WebSocket.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /reenviar/i })).toBeInTheDocument();
      });

      // Click Reenviar
      handleSendFile.mockResolvedValueOnce(undefined);
      const retryBtn = screen.getByRole('button', { name: /reenviar/i });
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(handleSendFile).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('NewChatModal', () => {
    it('switches tabs and creates new group', async () => {
      const handleCreateGroup = vi.fn().mockResolvedValue(undefined);
      const handleCreateDirect = vi.fn().mockResolvedValue(undefined);
      const handleClose = vi.fn();

      render(
        <NewChatModal
          isOpen={true}
          onClose={handleClose}
          onCreateGroup={handleCreateGroup}
          onCreateDirect={handleCreateDirect}
        />
      );

      expect(screen.getByText('Criar Novo Grupo Corporativo')).toBeInTheDocument();

      fireEvent.change(screen.getByPlaceholderText(/Ex: Engenharia/i), {
        target: { value: 'Novo Squad Alpha' },
      });

      const submitBtn = screen.getByRole('button', { name: /^Criar Grupo$/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(handleCreateGroup).toHaveBeenCalledWith('Novo Squad Alpha', [], 24);
        expect(handleClose).toHaveBeenCalled();
      });
    });

    it('handles temporary group toggle with retention period and error display on failure', async () => {
      const handleCreateGroup = vi.fn().mockRejectedValueOnce(new Error('Nome de grupo já em uso'));
      const handleClose = vi.fn();

      render(
        <NewChatModal
          isOpen={true}
          onClose={handleClose}
          onCreateGroup={handleCreateGroup}
          onCreateDirect={vi.fn()}
        />
      );

      fireEvent.change(screen.getByPlaceholderText(/Ex: Engenharia/i), {
        target: { value: 'Squad War Room' },
      });

      // Check temporary group checkbox to make it temporary
      const tempCheckbox = screen.getByRole('checkbox');
      fireEvent.click(tempCheckbox);

      const submitBtn = screen.getByRole('button', { name: /Criar Grupo Temporário/i });
      expect(submitBtn).toBeInTheDocument();
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(handleCreateGroup).toHaveBeenCalledWith({
          title: 'Squad War Room',
          memberIds: [],
          retentionHours: 24,
          isTemporary: true,
          expiresInHours: 24,
        });
        expect(screen.getByText('Nome de grupo já em uso')).toBeInTheDocument();
      });
    });

    it('renders broadcast tab on Free plan with warning and on Pro plan with broadcast dispatch', async () => {
      useAuthStore.setState({
        account: { id: 'acc-free', name: 'Free Org', plan: 'free', status: 'active' },
      });

      const handleBroadcast = vi.fn().mockResolvedValue(undefined);
      useChatStore.setState({ createBroadcast: handleBroadcast });

      const { rerender } = render(
        <NewChatModal
          isOpen={true}
          onClose={vi.fn()}
          onCreateGroup={vi.fn()}
          onCreateDirect={vi.fn()}
        />
      );

      // Switch to broadcast tab
      fireEvent.click(screen.getByText(/Transmissão/i));
      expect(screen.getByText(/Recurso dos Planos Pro e Enterprise/i)).toBeInTheDocument();

      // Now upgrade to Pro plan
      useAuthStore.setState({
        account: { id: 'acc-pro', name: 'Pro Org', plan: 'pro', status: 'active' },
      });

      rerender(
        <NewChatModal
          isOpen={true}
          onClose={vi.fn()}
          onCreateGroup={vi.fn()}
          onCreateDirect={vi.fn()}
        />
      );

      expect(screen.getByText(/Transmissões enviam uma mensagem oficial/i)).toBeInTheDocument();
      const textarea = screen.getByPlaceholderText(/Atenção equipe: manutenção programada/i);
      fireEvent.change(textarea, { target: { value: 'Aviso urgente da diretoria' } });

      const sendBtn = screen.getByRole('button', { name: /Disparar Transmissão/i });
      fireEvent.click(sendBtn);

      await waitFor(() => {
        expect(handleBroadcast).toHaveBeenCalledWith('Aviso urgente da diretoria');
      });
    });
  });

  describe('ChatPanel', () => {
    it('renders empty placeholder when no conversation is active', () => {
      render(
        <ChatPanel
          conversation={null}
          messages={[]}
          onSendMessage={vi.fn()}
          onSendTyping={vi.fn()}
        />
      );

      expect(screen.getByText('NextMsg Enterprise')).toBeInTheDocument();
      expect(screen.getByText(/Selecione uma conversa ao lado para começar/i)).toBeInTheDocument();
    });

    it('renders conversation header, messages list, and active typing bubble', () => {
      const messages: Message[] = [
        {
          id: 'm1',
          conversationId: 'c1',
          senderId: 'u1',
          senderName: 'Carlos',
          content: 'Primeira mensagem no grupo',
          type: 'text',
          createdAt: new Date().toISOString(),
          status: 'read',
          isSelf: false,
        },
      ];

      render(
        <ChatPanel
          conversation={MOCK_CONVERSATIONS[0]}
          messages={messages}
          isOnline={true}
          typingUserNames={['Mariana']}
          onSendMessage={vi.fn()}
          onSendTyping={vi.fn()}
        />
      );

      expect(screen.getByText('Squad Core')).toBeInTheDocument();
      expect(screen.getByText('Primeira mensagem no grupo')).toBeInTheDocument();
      expect(screen.getByText(/Mariana está digitando.../i)).toBeInTheDocument();
    });

    it('handles mobile back button, empty messages notice, and action modals', () => {
      const onBackMobile = vi.fn();
      const { rerender } = render(
        <ChatPanel
          conversation={MOCK_CONVERSATIONS[0]}
          messages={[]}
          isOnline={false}
          onBackMobile={onBackMobile}
          onSendMessage={vi.fn()}
          onSendTyping={vi.fn()}
        />
      );

      expect(
        screen.getByText(/Envie uma mensagem abaixo para iniciar a conversa/i)
      ).toBeInTheDocument();

      // Mobile back button
      const backBtn = screen.getByTitle('Voltar');
      fireEvent.click(backBtn);
      expect(onBackMobile).toHaveBeenCalled();

      // Open Create Poll Modal
      const pollBtn = screen.getByTitle('Criar enquete');
      fireEvent.click(pollBtn);
      expect(screen.getByText(/Criar Nova Enquete/i)).toBeInTheDocument();

      // Close Poll Modal
      const closePoll = screen.getByRole('button', { name: /Cancelar/i });
      fireEvent.click(closePoll);

      // Open Create Signature Modal
      const sigBtn = screen.getAllByTitle('Solicitar Assinatura Eletrônica (Enterprise)')[0];
      fireEvent.click(sigBtn);
      expect(screen.getByText(/Nova Solicitação de Assinatura/i)).toBeInTheDocument();

      // Broadcast conversation
      const broadcastConv: Conversation = {
        id: 'b-1',
        accountId: 'acc1',
        type: 'broadcast',
        title: 'Avisos da Diretoria',
        retentionHours: 0,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        unreadCount: 0,
      };

      rerender(
        <ChatPanel
          conversation={broadcastConv}
          messages={[]}
          onSendMessage={vi.fn()}
          onSendTyping={vi.fn()}
        />
      );

      expect(screen.getByText('Canal Oficial')).toBeInTheDocument();
      expect(
        screen.getByText(/Nenhum comunicado oficial publicado até o momento/i)
      ).toBeInTheDocument();
    });
  });

  describe('MessageBubble Deep Coverage', () => {
    it('renders file attachment with download link, file size and relay delivery summary', () => {
      const fileMsg: Message = {
        id: 'msg-file-1',
        conversationId: 'c1',
        senderId: 'u1',
        senderName: 'Carlos Admin',
        content: 'Relatório Trimestral.pdf',
        type: 'file',
        attachmentName: 'Relatório Trimestral.pdf',
        attachmentUrl: 'https://storage.empresa.com/doc.pdf',
        attachmentSize: 3 * 1024 * 1024,
        metadata: {
          deliveredToCount: 5,
          totalRecipientsCount: 8,
          transferMethod: 'relay_memory',
        },
        createdAt: new Date().toISOString(),
        status: 'read',
        isSelf: true,
      };

      const { rerender } = render(<MessageBubble message={fileMsg} isGroup={true} />);
      expect(screen.getByText('Relatório Trimestral.pdf')).toBeInTheDocument();
      expect(screen.getByText('3.0 MB')).toBeInTheDocument();
      expect(screen.getByText('Entregue a 5 de 8')).toBeInTheDocument();
      expect(screen.getByText('(somente online)')).toBeInTheDocument();
      expect(screen.getByTitle('Baixar arquivo')).toHaveAttribute(
        'href',
        'https://storage.empresa.com/doc.pdf'
      );

      // Not self with delivery summary
      rerender(
        <MessageBubble
          message={{
            ...fileMsg,
            isSelf: false,
            metadata: { deliverySummary: 'Entregue a todos' },
          }}
          isGroup={false}
        />
      );
      expect(screen.getByText('Entregue a todos')).toBeInTheDocument();
    });

    it('renders broadcast report button and triggers report modal', () => {
      const onOpenReport = vi.fn();
      const broadcastMsg: Message = {
        id: 'msg-b-1',
        conversationId: 'c1',
        senderId: 'u1',
        senderName: 'Carlos Admin',
        content: 'Comunicado Urgente: Feriado na sexta',
        type: 'text',
        metadata: { isBroadcast: true },
        createdAt: new Date().toISOString(),
        status: 'delivered',
        isSelf: true,
      };

      render(
        <MessageBubble
          message={broadcastMsg}
          isGroup={false}
          onOpenBroadcastReport={onOpenReport}
        />
      );

      expect(screen.getByText('Comunicado Oficial')).toBeInTheDocument();
      const reportBtn = screen.getByTitle('Visualizar relatório de entrega e leitura');
      fireEvent.click(reportBtn);
      expect(onOpenReport).toHaveBeenCalledWith('msg-b-1');
    });

    it('renders temporary message remaining expiration badges', () => {
      const in3Hours = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
      const expiredPast = new Date(Date.now() - 10000).toISOString();

      const tempMsg: Message = {
        id: 'msg-exp-1',
        conversationId: 'c1',
        senderId: 'u2',
        senderName: 'Mariana Souza',
        content: 'Mensagem com autodestruição',
        type: 'text',
        createdAt: new Date().toISOString(),
        retentionExpiresAt: in3Hours,
        status: 'sent',
        isSelf: false,
      };

      const { rerender } = render(<MessageBubble message={tempMsg} isGroup={true} />);
      expect(screen.getByText(/\d+h\s+\d+m/i)).toBeInTheDocument();

      rerender(
        <MessageBubble message={{ ...tempMsg, retentionExpiresAt: expiredPast }} isGroup={true} />
      );
      expect(screen.getByText('Expirando...')).toBeInTheDocument();
    });
  });

  describe('CreatePollModal Deep Coverage', () => {
    it('blocks poll creation on Free plan with error warning', () => {
      useAuthStore.setState({
        account: { id: 'acc-free', name: 'Free Org', plan: 'free', status: 'active' },
      });

      const onClose = vi.fn();
      const { container } = render(
        <CreatePollModal isOpen={true} onClose={onClose} conversationId="c1" />
      );

      expect(screen.getByText(/Recurso do Plano Pro \/ Enterprise/i)).toBeInTheDocument();
      const form = container.querySelector('form')!;
      fireEvent.submit(form);

      expect(
        screen.getByText(/O recurso de enquetes é exclusivo dos planos Pro e Enterprise/i)
      ).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('allows Pro plan user to add/remove options, toggle options and submit successfully', async () => {
      useAuthStore.setState({
        account: { id: 'acc-pro', name: 'Pro Org', plan: 'pro', status: 'active' },
      });

      const createPollMock = vi.fn().mockResolvedValue({ id: 'poll-1' });
      useChatStore.setState({ createPoll: createPollMock });

      const onClose = vi.fn();
      const { container, rerender } = render(
        <CreatePollModal isOpen={true} onClose={onClose} conversationId="c1" />
      );

      // Submit without question -> error via form submit
      const form = container.querySelector('form')!;
      fireEvent.submit(form);
      expect(screen.getByText('Informe a pergunta da enquete.')).toBeInTheDocument();

      // Fill question
      const questionInput = screen.getByPlaceholderText(
        /Ex: Qual dia é melhor para a retrospectiva da sprint\?/i
      );
      fireEvent.change(questionInput, { target: { value: 'Qual melhor horário para daily?' } });

      // Add a third option
      const addOptionBtn = screen.getByText('Adicionar outra opção');
      fireEvent.click(addOptionBtn);

      // Now we have 3 options
      const opt1 = screen.getByPlaceholderText('Opção 1');
      const opt2 = screen.getByPlaceholderText('Opção 2');
      const opt3 = screen.getByPlaceholderText('Opção 3');

      fireEvent.change(opt1, { target: { value: '09:00' } });
      fireEvent.change(opt2, { target: { value: '10:00' } });
      fireEvent.change(opt3, { target: { value: '11:00' } });

      // Remove third option
      const removeButtons = screen.getAllByTitle('Remover opção');
      fireEvent.click(removeButtons[removeButtons.length - 1]);

      // Check allowMultiple and isAnonymous checkboxes
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);

      // Submit valid poll
      const submitBtn = screen.getByRole('button', { name: /Publicar Enquete/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(createPollMock).toHaveBeenCalledWith({
          conversationId: 'c1',
          question: 'Qual melhor horário para daily?',
          options: ['09:00', '10:00'],
          allowMultiple: true,
          isAnonymous: true,
          expiresInHours: undefined,
        });
        expect(onClose).toHaveBeenCalled();
      });

      // Test error from createPoll
      createPollMock.mockRejectedValueOnce(new Error('Servidor indisponível'));
      rerender(<CreatePollModal isOpen={true} onClose={onClose} conversationId="c1" />);

      fireEvent.change(
        screen.getByPlaceholderText(/Ex: Qual dia é melhor para a retrospectiva da sprint\?/i),
        {
          target: { value: 'Pergunta 2' },
        }
      );
      fireEvent.change(screen.getByPlaceholderText('Opção 1'), { target: { value: 'A' } });
      fireEvent.change(screen.getByPlaceholderText('Opção 2'), { target: { value: 'B' } });
      fireEvent.click(screen.getByRole('button', { name: /Publicar Enquete/i }));

      await waitFor(() => {
        expect(screen.getByText('Servidor indisponível')).toBeInTheDocument();
      });
    });
  });
});
