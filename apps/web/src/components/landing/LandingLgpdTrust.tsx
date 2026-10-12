import React from 'react';
import { ShieldCheck, Lock, Download, Trash2, Mail, FileText } from 'lucide-react';

export const LandingLgpdTrust: React.FC = () => {
  const lgpdRights = [
    {
      title: 'Art. 18, V — Portabilidade de Dados',
      desc: 'Qualquer colaborador ou gestor pode solicitar a exportação integral de seus dados em JSON estruturado com apenas um clique no painel.',
      icon: Download,
    },
    {
      title: 'Art. 18, VI — Direito ao Esquecimento',
      desc: 'Eliminação definitiva e anonimização de dados pessoais mediante solicitação, sem deixar rastros ou dados retidos indevidamente.',
      icon: Trash2,
    },
    {
      title: 'Criptografia em Repouso e Trânsito',
      desc: 'Tráfego 100% protegido por TLS 1.3 e criptografia de ponta a ponta em repouso no banco de dados e nos buckets temporários (SSE-S3).',
      icon: Lock,
    },
    {
      title: 'Canal Direto com o Encarregado (DPO)',
      desc: 'Canal oficial e política de privacidade transparente publicada com dados de contato direto do DPO em conformidade com a ANPD.',
      icon: Mail,
    },
  ];

  return (
    <section id="security" className="py-20 md:py-28 relative bg-slate-950/80 border-t border-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl p-8 sm:p-12 lg:p-16 bg-gradient-to-br from-slate-900/90 via-slate-900/50 to-slate-950 border border-slate-800 shadow-2xl relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 blur-[100px] pointer-events-none rounded-full" />

          <div className="max-w-3xl mb-12 space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Privacidade por Design (Lei 13.709/2018)</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Segurança jurídica e conformidade absoluta com a LGPD
            </h2>
            <p className="text-base text-slate-400 leading-relaxed">
              Diferente de aplicativos pessoais onde conversas e arquivos de trabalho ficam dispersos em dispositivos de funcionários sem governança, o NextMsg garante conformidade corporativa e proteção contra passivos trabalhistas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {lgpdRights.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 transition-all flex items-start gap-4"
                >
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white mb-1.5">{item.title}</h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Privacy Footnote */}
          <div className="mt-10 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <span>Logs do sistema com redação automática: zero conteúdo de mensagens registrado em texto aberto.</span>
            </div>
            <span className="font-semibold text-emerald-400">
              Auditoria e Proteção Ativa
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
