import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import { SidebarNav } from '../components/layout/SidebarNav';

describe('UI Components Design System', () => {
  describe('Button', () => {
    it('renders with label and handles click', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Enviar</Button>);

      const btn = screen.getByRole('button', { name: /enviar/i });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('shows loading spinner and disables when isLoading is true', () => {
      render(<Button isLoading>Processando</Button>);
      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
      expect(screen.getByText(/processando/i)).toBeInTheDocument();
    });
  });

  describe('Input', () => {
    it('renders label, error, and handles input change', () => {
      const handleChange = vi.fn();
      render(
        <Input
          label="Email Corporativo"
          error="Email inválido"
          placeholder="seu@email.com"
          onChange={handleChange}
        />
      );

      expect(screen.getByText('Email Corporativo')).toBeInTheDocument();
      expect(screen.getByText('Email inválido')).toBeInTheDocument();
      const input = screen.getByPlaceholderText('seu@email.com');
      fireEvent.change(input, { target: { value: 'test@corp.com' } });
      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe('Badge', () => {
    it('renders variant and text correctly', () => {
      render(<Badge variant="brand">Enterprise</Badge>);
      expect(screen.getByText('Enterprise')).toBeInTheDocument();
    });
  });

  describe('Avatar', () => {
    it('renders initials when no image is provided', () => {
      render(<Avatar name="Carlos Silva" status="online" />);
      expect(screen.getByText('CS')).toBeInTheDocument();
    });

    it('renders group icon when isGroup is true', () => {
      const { container } = render(<Avatar name="Squad Backend" isGroup />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Modal', () => {
    it('renders when isOpen is true and calls onClose on backdrop click', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Novo Grupo">
          <p>Conteúdo do modal</p>
        </Modal>
      );

      expect(screen.getByText('Novo Grupo')).toBeInTheDocument();
      expect(screen.getByText('Conteúdo do modal')).toBeInTheDocument();

      const closeBtn = screen.getByRole('button');
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalled();
    });

    it('does not render when isOpen is false', () => {
      render(
        <Modal isOpen={false} onClose={vi.fn()} title="Novo Grupo">
          <p>Conteúdo oculto</p>
        </Modal>
      );

      expect(screen.queryByText('Novo Grupo')).not.toBeInTheDocument();
    });
  });

  describe('SidebarNav', () => {
    it('renders navigation tabs and triggers onSelectTab', () => {
      const handleSelect = vi.fn();
      render(<SidebarNav activeTab="chats" onSelectTab={handleSelect} />);

      const contactsBtn = screen.getByTitle('Contatos');
      fireEvent.click(contactsBtn);
      expect(handleSelect).toHaveBeenCalledWith('contacts');
    });
  });
});
