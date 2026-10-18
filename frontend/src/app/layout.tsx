import type { Metadata } from 'next';
import './globals.css';
import { ClientProviders } from '../components/providers/ClientProviders';

export const metadata: Metadata = {
  title: 'NextMsg — Mensagens Corporativas com Foco e Privacidade Radical',
  description:
    'Mensageiro corporativo seguro em tempo real com zero retenção de arquivos no plano Free, infraestrutura isolada por tenant e total conformidade com a LGPD.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-slate-950 text-slate-100 font-sans antialiased min-h-screen">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
