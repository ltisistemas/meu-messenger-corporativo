import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConversationList } from '../components/chat/ConversationList';
import { ChatPanel } from '../components/chat/ChatPanel';
import { MessageBubble } from '../components/chat/MessageBubble';
import { MessageComposer } from '../components/chat/MessageComposer';
import { NewChatModal } from '../components/chat/NewChatModal';
import { Conversation, Message } from '../stores/chat.store';

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
        screen.getByText('Carlos Offline está offline. No plano Free, arquivos só são enviados para quem está online.')
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
        screen.getByText('Esse arquivo passa de 25 MB. Compartilhe pelo Google Drive e cole o link aqui.')
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

      expect(
        screen.getByText(/excede o limite de 5 MB do plano Free/i)
      ).toBeInTheDocument();
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
      const validFile = new File(['valid file content'], 'apresentacao.pdf', { type: 'application/pdf' });
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
      const handleSendFile = vi.fn().mockRejectedValueOnce(new Error('Queda de conexão WebSocket.'));

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

      const submitBtn = screen.getByRole('button', { name: /criar grupo/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(handleCreateGroup).toHaveBeenCalledWith('Novo Squad Alpha', [], 24);
        expect(handleClose).toHaveBeenCalled();
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
      expect(
        screen.getByText(/Selecione uma conversa ao lado para começar/i)
      ).toBeInTheDocument();
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
  });
});
