import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChatPage } from '../pages/ChatPage';
import { App } from '../App';
import { useAuthStore } from '../stores/auth.store';
import { useChatStore } from '../stores/chat.store';

describe('Corporate Messenger App & ChatPage (T-11 / T-12 / T-13 / T-14)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        accountId: 'acc-1',
        name: 'Carlos Admin',
        email: 'admin@empresa.com',
        role: 'owner',
        status: 'active',
      },
      account: {
        id: 'acc-1',
        name: 'Tech Corp',
        plan: 'pro',
        status: 'active',
      },
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    useChatStore.setState({
      conversations: [
        {
          id: 'conv-1',
          accountId: 'acc-1',
          type: 'group',
          title: 'Engenharia & Produto',
          retentionHours: 24,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          members: [{ id: 'u1', name: 'Carlos Admin', email: 'admin@empresa.com', role: 'owner' }],
          lastMessage: {
            id: 'm1',
            content: 'Deploy da v1.2 realizado no ambiente de produção com sucesso!',
            senderId: 'u2',
            createdAt: new Date().toISOString(),
          },
          unreadCount: 3,
        },
        {
          id: 'conv-2',
          accountId: 'acc-1',
          type: 'direct',
          title: null,
          retentionHours: 0,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          otherUser: {
            id: 'u2',
            name: 'Mariana Souza',
            email: 'mariana@empresa.com',
            avatarUrl: null,
          },
          lastMessage: {
            id: 'm2',
            content: 'Você já revisou os termos do novo contrato corporativo?',
            senderId: 'u2',
            createdAt: new Date().toISOString(),
          },
          unreadCount: 0,
        },
      ],
      activeConversationId: 'conv-1',
      messages: {
        'conv-1': [
          {
            id: 'm1',
            conversationId: 'conv-1',
            senderId: 'u2',
            senderName: 'Rafael Silva',
            content: 'Pessoal, finalizamos os testes de regressão.',
            type: 'text',
            createdAt: new Date().toISOString(),
            status: 'read',
            isSelf: false,
          },
        ],
        'conv-2': [
          {
            id: 'm2',
            conversationId: 'conv-2',
            senderId: 'u2',
            senderName: 'Mariana Souza',
            content: 'Olá! Você já revisou os termos do novo contrato corporativo?',
            type: 'text',
            createdAt: new Date().toISOString(),
            status: 'read',
            isSelf: false,
          },
        ],
      },
      onlineUsers: { u2: true },
      typingUsers: {},
      isLoadingConversations: false,
      isLoadingMessages: false,
      error: null,
    });
  });

  it('renders conversations list and active conversation header in ChatPage', () => {
    render(
      <BrowserRouter>
        <ChatPage />
      </BrowserRouter>
    );

    expect(screen.getByText('Tech Corp')).toBeInTheDocument();
    expect(screen.getAllByText('Engenharia & Produto').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mariana Souza').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Mensagens protegidas por isolamento multi-tenant/i)
    ).toBeInTheDocument();
  });

  it('switches conversation when clicking on a different chat card', () => {
    render(
      <BrowserRouter>
        <ChatPage />
      </BrowserRouter>
    );

    const marianaCards = screen.getAllByText('Mariana Souza');
    fireEvent.click(marianaCards[0]);

    expect(
      screen.getByText('Olá! Você já revisou os termos do novo contrato corporativo?')
    ).toBeInTheDocument();
  });

  it('filters conversations by search term in sidebar', () => {
    render(
      <BrowserRouter>
        <ChatPage />
      </BrowserRouter>
    );

    const searchInput = screen.getByPlaceholderText('Buscar conversas...');
    fireEvent.change(searchInput, { target: { value: 'Mariana' } });

    expect(screen.getAllByText('Mariana Souza').length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('heading', { level: 3, name: 'Engenharia & Produto' })
    ).not.toBeInTheDocument();
  });

  it('opens and closes new group modal', () => {
    render(
      <BrowserRouter>
        <ChatPage />
      </BrowserRouter>
    );

    const newBtn = screen.getByText('Novo');
    fireEvent.click(newBtn);

    expect(screen.getByText('Criar Novo Grupo Corporativo')).toBeInTheDocument();

    const cancelBtn = screen.getByText('Cancelar');
    fireEvent.click(cancelBtn);

    expect(screen.queryByText('Criar Novo Grupo Corporativo')).not.toBeInTheDocument();
  });

  it('renders App router in authenticated state', () => {
    render(<App />);
    expect(screen.getByText('Tech Corp')).toBeInTheDocument();
  });

  it('triggers send message and typing interactions in ChatPage', async () => {
    const sendMessageMock = vi.fn().mockResolvedValue({});
    const sendTypingMock = vi.fn();
    useChatStore.setState({
      sendMessage: sendMessageMock,
      sendTyping: sendTypingMock,
    });

    render(
      <BrowserRouter>
        <ChatPage />
      </BrowserRouter>
    );

    const input = screen.getByPlaceholderText(/Digite uma mensagem segura/i);
    fireEvent.change(input, { target: { value: 'Olá squad!' } });
    expect(sendTypingMock).toHaveBeenCalled();

    fireEvent.submit(input.closest('form')!);
    expect(sendMessageMock).toHaveBeenCalledWith('Olá squad!', 'text');
  });

  it('navigates to settings and switches tabs in ChatPage', () => {
    render(
      <BrowserRouter>
        <ChatPage />
      </BrowserRouter>
    );

    const settingsBtn = screen.getByTitle('Configurações');
    fireEvent.click(settingsBtn);

    const broadcastNav = screen.getByTitle('Transmissão');
    fireEvent.click(broadcastNav);

    const contactsNav = screen.getByTitle('Contatos');
    fireEvent.click(contactsNav);
  });

  it('creates group and direct conversation through NewChatModal in ChatPage', async () => {
    const createGroupMock = vi.fn().mockResolvedValue('new-g');
    const createDirectMock = vi.fn().mockResolvedValue('new-d');
    useChatStore.setState({
      createGroupConversation: createGroupMock,
      createDirectConversation: createDirectMock,
    });

    render(
      <BrowserRouter>
        <ChatPage />
      </BrowserRouter>
    );

    // Create group
    const newBtn = screen.getByText('Novo');
    fireEvent.click(newBtn);

    const groupInput = screen.getByPlaceholderText(/Ex: Engenharia/i);
    fireEvent.change(groupInput, { target: { value: 'Squad Beta' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar Grupo/i }));

    await waitFor(() => {
      expect(createGroupMock).toHaveBeenCalledWith('Squad Beta', [], 24);
    });

    // Create direct
    fireEvent.click(screen.getByText('Novo'));
    fireEvent.click(screen.getByText(/Direto 1:1/i));
    const directInput = screen.getByPlaceholderText(/Ex: colaborador@empresa.com/i);
    fireEvent.change(directInput, { target: { value: 'user-direct-99' } });
    fireEvent.click(screen.getByRole('button', { name: /Iniciar Conversa/i }));

    await waitFor(() => {
      expect(createDirectMock).toHaveBeenCalledWith('user-direct-99');
    });
  });

  it('renders App router in unauthenticated state redirecting to public routes', () => {
    useAuthStore.setState({
      user: null,
      account: null,
      accessToken: null,
      isAuthenticated: false,
    });

    render(<App />);
    expect(screen.getByText('Acesse sua conta')).toBeInTheDocument();
  });
});
