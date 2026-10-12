import React from 'react';
import { ShieldCheck, Zap, HardDrive, Clock4, Users, Lock } from 'lucide-react';

export const LandingMetrics: React.FC = () => {
  const metrics = [
    {
      value: '100%',
      label: 'Foco em Produtividade',
      desc: 'Sem áudios intermináveis de 5 minutos, sem chamadas invasivas fora de hora.',
      icon: Zap,
      accent: 'from-amber-400 to-amber-600',
    },
    {
      value: '0 Bytes',
      label: 'Retenção no Plano Free',
      desc: 'Streaming direto em memória via WebSocket. Nada é gravado em disco ou bucket.',
      icon: HardDrive,
      accent: 'from-emerald-400 to-teal-500',
    },
    {
      value: '5 Dias',
      label: 'Retenção Máxima no Pro',
      desc: 'Arquivos apagados imediatamente pós-download ou em no máximo 5 dias via BullMQ.',
      icon: Clock4,
      accent: 'from-indigo-400 to-indigo-600',
    },
    {
      value: 'Art. 18',
      label: 'Conformidade LGPD Nativa',
      desc: 'Exportação completa de dados e direito ao esquecimento em um clique.',
      icon: ShieldCheck,
      accent: 'from-emerald-400 to-cyan-500',
    },
  ];

  return (
    <section className="py-12 border-y border-slate-900 bg-slate-950/40 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {metrics.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${item.accent} flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/10 group-hover:scale-105 transition-transform`}
                  >
                    <Icon className="w-6 h-6 text-slate-950" />
                  </div>
                  <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {item.value}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-100 mb-1">{item.label}</h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
