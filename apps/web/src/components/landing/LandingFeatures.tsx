import React from 'react';
import {
  HardDrive,
  Clock,
  Radio,
  BarChart3,
  FileCheck2,
  ExternalLink,
  Sparkles,
  Zap,
} from 'lucide-react';

export const LandingFeatures: React.FC = () => {
  const features = [
    {
      title: 'Relay em Memória (Zero Retenção Free)',
      tag: 'Plano Free',
      tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      description:
        'Envio de arquivos em tempo real via streaming por WebSocket exclusivamente para destinatários online. Nada é gravado em disco ou servidores S3.',
      icon: HardDrive,
      gradient: 'from-emerald-500/20 to-teal-500/10',
    },
    {
      title: 'Grupos Temporários Expiráveis',
      tag: 'Todos os Planos',
      tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      description:
        'Defina data e hora de encerramento para grupos de projetos. Ao atingir o prazo, o grupo é arquivado e torna-se somente leitura automaticamente.',
      icon: Clock,
      gradient: 'from-amber-500/20 to-orange-500/10',
    },
    {
      title: 'Canal Oficial "Comunicados"',
      tag: 'Pro & Enterprise',
      tagColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
      description:
        'Mensagens institucionais enviadas por administradores para toda a empresa com relatório analítico de entrega e sem comentários desordenados.',
      icon: Radio,
      gradient: 'from-indigo-500/20 to-purple-500/10',
    },
    {
      title: 'Enquetes Corporativas ao Vivo',
      tag: 'Pro & Enterprise',
      tagColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
      description:
        'Votação única ou múltipla, anônima ou identificada, com apuração matemática e atualização gráfica instantânea dentro da própria conversa.',
      icon: BarChart3,
      gradient: 'from-cyan-500/20 to-blue-500/10',
    },
    {
      title: 'Assinatura Eletrônica Clicksign',
      tag: 'Enterprise',
      tagColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      description:
        'Envie PDFs para assinatura com múltiplos signatários, ordem sequencial e emissão de manifesto de evidências com hash criptográfico SHA-256.',
      icon: FileCheck2,
      gradient: 'from-purple-500/20 to-pink-500/10',
    },
    {
      title: 'Cartões Inteligentes de Nuvem',
      tag: 'Todos os Planos',
      tagColor: 'text-slate-300 bg-slate-800 border-slate-700',
      description:
        'Detecção automática e cartões enriquecidos de pré-visualização para links do Google Drive, OneDrive e Dropbox quando arquivos excedem 25 MB.',
      icon: ExternalLink,
      gradient: 'from-slate-700/20 to-slate-800/10',
    },
  ];

  return (
    <section id="features" className="py-20 md:py-32 relative bg-slate-950/70 border-t border-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400">
            <Zap className="w-4 h-4" />
            <span>Superpoderes Corporativos</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Ferramentas pensadas para o dia a dia da sua equipe
          </h2>
          <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
            Cada funcionalidade do NextMsg foi desenhada para aumentar a velocidade de tomada de decisões sem abrir mão da governança e da segurança de dados.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="group relative p-8 rounded-3xl bg-slate-900/40 border border-slate-800 hover:border-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div
                      className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.gradient} border border-slate-700/50 flex items-center justify-center text-white shadow-inner group-hover:scale-105 transition-transform`}
                    >
                      <Icon className="w-7 h-7 text-emerald-400" />
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${item.tagColor}`}
                    >
                      {item.tag}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-emerald-300 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-6">
                    {item.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center text-xs font-semibold text-emerald-400 gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>100% Funcional e Integrado</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
