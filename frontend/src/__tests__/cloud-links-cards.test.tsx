import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from '../components/chat/MessageBubble';
import { CloudLinkCard } from '../components/chat/CloudLinkCard';
import { Message } from '../stores/chat.store';
import { parseCloudLink } from '@/shared';

describe('Cloud Storage Link Cards & Preview (T-23)', () => {
  describe('CloudLinkCard Component', () => {
    it('renders Google Drive card with proper badge, title, domain, and external button', () => {
      const link = parseCloudLink('https://docs.google.com/spreadsheets/d/12345/edit#gid=0')!;
      render(<CloudLinkCard link={link} isSelf={false} />);

      expect(screen.getByText('Google Drive')).toBeInTheDocument();
      expect(screen.getByText('Planilha')).toBeInTheDocument();
      expect(screen.getByText('Planilha Google Sheets')).toBeInTheDocument();
      expect(screen.getByText(/docs.google.com/i)).toBeInTheDocument();
      expect(screen.getByText('Zero retenção • Link externo')).toBeInTheDocument();

      const actionButton = screen.getByRole('link', { name: /Abrir no Google Drive/i });
      expect(actionButton).toHaveAttribute(
        'href',
        'https://docs.google.com/spreadsheets/d/12345/edit#gid=0'
      );
      expect(actionButton).toHaveAttribute('target', '_blank');
      expect(actionButton).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders Microsoft OneDrive / SharePoint card with proper branding', () => {
      const link = parseCloudLink('https://corp.sharepoint.com/:x:/g/personal/planilha.xlsx')!;
      render(<CloudLinkCard link={link} isSelf={false} />);

      expect(screen.getByText('SharePoint / OneDrive')).toBeInTheDocument();
      expect(screen.getByText('Planilha Excel')).toBeInTheDocument();
      expect(screen.getByText(/Planilha Excel \(SharePoint \/ OneDrive\)/i)).toBeInTheDocument();

      const actionButton = screen.getByRole('link', { name: /Abrir no OneDrive/i });
      expect(actionButton).toHaveAttribute('target', '_blank');
    });

    it('renders Dropbox card with extracted filename and file type', () => {
      const link = parseCloudLink('https://www.dropbox.com/s/xyz123/Proposta_Comercial.pdf?dl=0')!;
      render(<CloudLinkCard link={link} isSelf={true} />);

      expect(screen.getByText('Dropbox')).toBeInTheDocument();
      expect(screen.getByText('Documento PDF')).toBeInTheDocument();
      expect(screen.getByText('Proposta_Comercial.pdf')).toBeInTheDocument();

      const actionButton = screen.getByRole('link', { name: /Abrir no Dropbox/i });
      expect(actionButton).toHaveAttribute('target', '_blank');
    });
  });

  describe('MessageBubble Integration with Cloud Links', () => {
    it('automatically recognizes Google Drive link in message text and renders rich card', () => {
      const message: Message = {
        id: 'msg-drive-1',
        conversationId: 'c1',
        senderId: 'user-2',
        senderName: 'Ana Paula',
        content:
          'Aqui está a documentação técnica: https://docs.google.com/document/d/1abcxyz/edit',
        type: 'text',
        createdAt: new Date().toISOString(),
        status: 'read',
        isSelf: false,
      };

      render(<MessageBubble message={message} isGroup={true} />);

      // Text part with clickable link
      expect(screen.getByText(/Aqui está a documentação técnica:/i)).toBeInTheDocument();
      const textLink = screen.getByRole('link', {
        name: 'https://docs.google.com/document/d/1abcxyz/edit',
      });
      expect(textLink).toHaveAttribute('href', 'https://docs.google.com/document/d/1abcxyz/edit');
      expect(textLink).toHaveAttribute('target', '_blank');

      // Rich CloudLinkCard preview
      expect(screen.getByTestId('cloud-link-card')).toBeInTheDocument();
      expect(screen.getByText('Google Drive')).toBeInTheDocument();
      expect(screen.getByText('Documento Google Docs')).toBeInTheDocument();
    });

    it('renders multiple cloud cards when a message contains multiple cloud links', () => {
      const message: Message = {
        id: 'msg-multi-1',
        conversationId: 'c1',
        senderId: 'user-1',
        content: `
          Arquivos da sprint:
          1. https://drive.google.com/file/d/abc1234/view
          2. https://www.dropbox.com/s/def5678/Relatorio.pdf
        `,
        type: 'text',
        createdAt: new Date().toISOString(),
        status: 'delivered',
        isSelf: true,
      };

      render(<MessageBubble message={message} isGroup={false} />);

      const cards = screen.getAllByTestId('cloud-link-card');
      expect(cards).toHaveLength(2);
      expect(screen.getByText('Google Drive')).toBeInTheDocument();
      expect(screen.getByText('Dropbox')).toBeInTheDocument();
      expect(screen.getByText('Relatorio.pdf')).toBeInTheDocument();
    });

    it('renders regular text message without cloud cards when no cloud URLs are present', () => {
      const message: Message = {
        id: 'msg-plain-1',
        conversationId: 'c1',
        senderId: 'user-1',
        content: 'Olá equipe, reunião confirmada para às 14h.',
        type: 'text',
        createdAt: new Date().toISOString(),
        status: 'sent',
        isSelf: true,
      };

      render(<MessageBubble message={message} />);
      expect(screen.queryByTestId('cloud-link-card')).not.toBeInTheDocument();
      expect(screen.getByText('Olá equipe, reunião confirmada para às 14h.')).toBeInTheDocument();
    });
  });
});

