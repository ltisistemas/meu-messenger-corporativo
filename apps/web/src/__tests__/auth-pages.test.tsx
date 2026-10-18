import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { AcceptInvitePage } from '../pages/AcceptInvitePage';
import { useAuthStore } from '../stores/auth.store';
import { api } from '../services/api';

describe('Auth Pages & Flows (T-12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      account: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  describe('LoginPage', () => {
    it('renders login fields and shows validation error on empty submit', async () => {
      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Acesse sua conta')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('voce@empresa.com')).toBeInTheDocument();

      const submitBtn = screen.getByRole('button', { name: /entrar no nextmsg/i });
      fireEvent.click(submitBtn);

      expect(
        await screen.findByText('Preencha seu e-mail e senha corporativos.')
      ).toBeInTheDocument();
    });

    it('calls login on valid credentials submission', async () => {
      const loginSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
        user: { id: 'u1', name: 'Carlos Admin', email: 'carlos@empresa.com', role: 'owner' },
        account: { id: 'acc1', name: 'Empresa SA', plan: 'pro', status: 'active' },
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });

      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByPlaceholderText('voce@empresa.com'), {
        target: { value: 'carlos@empresa.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'secret123' },
      });

      const submitBtn = screen.getByRole('button', { name: /entrar no nextmsg/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(loginSpy).toHaveBeenCalledWith('/auth/login', {
          email: 'carlos@empresa.com',
          password: 'secret123',
        });
      });
    });
  });

  describe('RegisterPage', () => {
    it('allows choosing a plan and submitting organization registration', async () => {
      const registerSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
        user: { id: 'u1', name: 'Ana Owner', email: 'ana@startup.io', role: 'owner' },
        account: { id: 'acc1', name: 'Startup IO', plan: 'pro', status: 'active' },
        accessToken: 'mock-jwt-token',
        refreshToken: 'mock-refresh-jwt',
      });

      render(
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/Criar Organização no Next/i)).toBeInTheDocument();

      fireEvent.change(screen.getByPlaceholderText('Ex: Acma Corp, Tech Solutions'), {
        target: { value: 'Startup IO' },
      });
      fireEvent.change(screen.getByPlaceholderText('Ex: Carlos Silva'), {
        target: { value: 'Ana Owner' },
      });
      fireEvent.change(screen.getByPlaceholderText('carlos@empresa.com'), {
        target: { value: 'ana@startup.io' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'password123' },
      });

      const submitBtn = screen.getByRole('button', { name: /criar espaço de trabalho/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(registerSpy).toHaveBeenCalledWith('/auth/register', {
          accountName: 'Startup IO',
          name: 'Ana Owner',
          email: 'ana@startup.io',
          password: 'password123',
          plan: 'pro',
        });
      });
    });

    it('validates password length under 8 characters', async () => {
      render(
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByPlaceholderText('Ex: Acma Corp, Tech Solutions'), {
        target: { value: 'Startup IO' },
      });
      fireEvent.change(screen.getByPlaceholderText('Ex: Carlos Silva'), {
        target: { value: 'Ana Owner' },
      });
      fireEvent.change(screen.getByPlaceholderText('carlos@empresa.com'), {
        target: { value: 'ana@startup.io' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: '123' },
      });

      const submitBtn = screen.getByRole('button', { name: /criar espaço de trabalho/i });
      fireEvent.click(submitBtn);

      expect(
        await screen.findByText('A senha deve ter no mínimo 8 caracteres.')
      ).toBeInTheDocument();
    });
  });

  describe('AcceptInvitePage', () => {
    it('fetches invitation details and submits user activation', async () => {
      vi.spyOn(api, 'get').mockResolvedValueOnce({
        id: 'inv-123',
        email: 'beatriz@empresa.com',
        role: 'member',
        status: 'pending',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        account: {
          id: 'acc-1',
          name: 'Empresa Alpha',
          plan: 'pro',
        },
      });

      const acceptSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
        user: { id: 'u2', name: 'Beatriz Lima', email: 'beatriz@empresa.com', role: 'member' },
        account: { id: 'acc-1', name: 'Empresa Alpha', plan: 'pro', status: 'active' },
        accessToken: 'beatriz-token',
        refreshToken: 'beatriz-refresh',
      });

      render(
        <MemoryRouter initialEntries={['/invite/inv-token-abc']}>
          <Routes>
            <Route path="/invite/:token" element={<AcceptInvitePage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(await screen.findByText('Empresa Alpha')).toBeInTheDocument();
      expect(screen.getByText('beatriz@empresa.com')).toBeInTheDocument();

      fireEvent.change(screen.getByPlaceholderText('Ex: Beatriz Lima'), {
        target: { value: 'Beatriz Lima' },
      });
      const passwordInputs = screen.getAllByPlaceholderText('••••••••');
      fireEvent.change(passwordInputs[0], { target: { value: 'mypassword123' } });
      fireEvent.change(passwordInputs[1], { target: { value: 'mypassword123' } });

      const submitBtn = screen.getByRole('button', { name: /concluir cadastro e acessar/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(acceptSpy).toHaveBeenCalledWith('/invitations/inv-token-abc/accept', {
          name: 'Beatriz Lima',
          password: 'mypassword123',
        });
      });
    });

    it('validates password requirements and mismatch', async () => {
      vi.spyOn(api, 'get').mockResolvedValueOnce({
        id: 'inv-123',
        email: 'beatriz@empresa.com',
        role: 'member',
        status: 'pending',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        account: { id: 'acc-1', name: 'Empresa Alpha', plan: 'pro' },
      });

      const { container } = render(
        <MemoryRouter initialEntries={['/invite/inv-tok-1']}>
          <Routes>
            <Route path="/invite/:token" element={<AcceptInvitePage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(await screen.findByText('Empresa Alpha')).toBeInTheDocument();
      const form = container.querySelector('form')!;

      // 1. Empty fields via form submit
      fireEvent.submit(form);
      expect(
        screen.getByText(/Preencha seu nome e defina sua senha de acesso/i)
      ).toBeInTheDocument();

      // 2. Short password
      fireEvent.change(screen.getByPlaceholderText('Ex: Beatriz Lima'), {
        target: { value: 'Beatriz' },
      });
      const passwordInputs = screen.getAllByPlaceholderText('••••••••');
      fireEvent.change(passwordInputs[0], { target: { value: '123' } });
      fireEvent.change(passwordInputs[1], { target: { value: '123' } });
      fireEvent.submit(form);
      expect(screen.getByText(/A senha deve ter pelo menos 8 caracteres/i)).toBeInTheDocument();

      // 3. Mismatch
      fireEvent.change(passwordInputs[0], { target: { value: 'password123' } });
      fireEvent.change(passwordInputs[1], { target: { value: 'password999' } });
      fireEvent.submit(form);
      expect(screen.getByText(/As senhas digitadas não coincidem/i)).toBeInTheDocument();
    });

    it('renders error state when invitation fetch fails', async () => {
      vi.spyOn(api, 'get').mockRejectedValueOnce(new Error('Token expirado'));

      render(
        <MemoryRouter initialEntries={['/invite/invalid-token']}>
          <Routes>
            <Route path="/invite/:token" element={<AcceptInvitePage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(
        await screen.findByText(/Convite inválido, expirado ou já utilizado/i)
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Ir para o Login/i })).toBeInTheDocument();
    });
  });
});
