import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
});
