import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LgpdPrivacySection } from '../components/account/LgpdPrivacySection';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(msg: string, public status: number) {
      super(msg);
    }
  },
}));

const mockLogout = vi.fn();

vi.mock('../stores/auth.store', () => ({
  useAuthStore: () => ({
    user: {
      id: 'user-1',
      name: 'Maria Titular',
      email: 'maria@empresa.com',
      role: 'member',
    },
    logout: mockLogout,
  }),
}));

describe('LGPD Privacy & Data Management Frontend (T-36)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as any).mockImplementation((url: string) => {
      if (url === '/lgpd/privacy-policy') {
        return Promise.resolve({
          version: '2026.1',
          lastUpdated: '2026-01-15T00:00:00.000Z',
          dpoContact: 'dpo@nextmsg.com.br',
          rights: [
            'Confirmação da existência de tratamento (Art. 18, I)',
            'Acesso aos dados pessoais (Art. 18, II)',
            'Portabilidade dos dados a outro fornecedor (Art. 18, V)',
            'Eliminação dos dados pessoais tratados com consentimento (Art. 18, VI)',
          ],
          retentionPolicies: {
            free: 'Zero retenção de arquivos em disco.',
            pro: 'Arquivos com retenção temporária máxima de 5 dias em bucket seguro.',
            enterprise: 'Retenção corporativa configurável com trilha de auditoria.',
          },
          legalBases: [
            'Execução de contrato de prestação de serviços (Art. 7º, V)',
          ],
        });
      }
      if (url === '/lgpd/export') {
        return Promise.resolve({
          user: { name: 'Maria Titular', email: 'maria@empresa.com' },
          sentMessages: [],
        });
      }
      return Promise.resolve({});
    });

    // Mock URL object methods
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    window.alert = vi.fn();
  });

  it('renders LGPD header, DPO email contact and statutory rights', async () => {
    render(<LgpdPrivacySection userRole="member" userEmail="maria@empresa.com" />);

    expect(screen.getByText(/Privacidade, Proteção de Dados & LGPD/i)).toBeInTheDocument();
    expect(screen.getByText(/Lei 13.709\/2018/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('dpo@nextmsg.com.br')).toBeInTheDocument();
      expect(screen.getByText(/Portabilidade dos dados a outro fornecedor/i)).toBeInTheDocument();
    });
  });

  it('exports user data when clicking on download JSON button', async () => {
    render(<LgpdPrivacySection userRole="member" userEmail="maria@empresa.com" />);

    const exportBtn = screen.getByRole('button', { name: /Baixar Meus Dados \(JSON\)/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/lgpd/export');
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  it('opens deletion modal and disables submit until confirmation word is typed', async () => {
    render(<LgpdPrivacySection userRole="member" userEmail="maria@empresa.com" />);

    const openDeleteBtn = screen.getByRole('button', { name: /Excluir Minha Conta/i });
    fireEvent.click(openDeleteBtn);

    expect(screen.getByText(/Confirmar Exclusão de Conta/i)).toBeInTheDocument();

    const submitDeleteBtn = screen.getByRole('button', { name: /Excluir Definitivamente/i });
    expect(submitDeleteBtn).toBeDisabled();

    // Fill password and text
    const passwordInput = screen.getByPlaceholderText(/Sua senha de acesso/i);
    const confirmationInput = screen.getByPlaceholderText('EXCLUIR');

    fireEvent.change(passwordInput, { target: { value: 'MinhaSenhaForte123' } });
    fireEvent.change(confirmationInput, { target: { value: 'EXCLUIR' } });

    expect(submitDeleteBtn).not.toBeDisabled();
  });

  it('executes deletion API call and triggers logout on success', async () => {
    (api.post as any).mockResolvedValueOnce({
      success: true,
      message: 'Conta excluída.',
      anonymizedAt: '2026-02-01T12:00:00Z',
    });

    render(<LgpdPrivacySection userRole="member" userEmail="maria@empresa.com" />);

    const openDeleteBtn = screen.getByRole('button', { name: /Excluir Minha Conta/i });
    fireEvent.click(openDeleteBtn);

    const passwordInput = screen.getByPlaceholderText(/Sua senha de acesso/i);
    const confirmationInput = screen.getByPlaceholderText('EXCLUIR');

    fireEvent.change(passwordInput, { target: { value: 'MinhaSenhaForte123' } });
    fireEvent.change(confirmationInput, { target: { value: 'EXCLUIR' } });

    const submitDeleteBtn = screen.getByRole('button', { name: /Excluir Definitivamente/i });
    fireEvent.click(submitDeleteBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/lgpd/delete-account', {
        password: 'MinhaSenhaForte123',
        confirmationText: 'EXCLUIR',
      });
      expect(mockLogout).toHaveBeenCalled();
    });
  });
});
