import { XCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

export const LandingComparison: React.FC = () => {
  const comparisonRows = [
    {
      feature: 'Formato de Mensagens',
      whatsapp: 'Áudios longos de 5 minutos que ninguém ouve e fragmentam o dia de trabalho',
      nextmsg: 'Foco exclusivo em mensagens de texto e arquivos estruturados para leitura rápida',
    },
    {
      feature: 'Retenção de Arquivos',
      whatsapp:
        'Arquivos corporativos salvos indefinidamente em celulares pessoais de funcionários',
      nextmsg: 'Privacidade radical: zero gravação em disco no Free e expiração em 5 dias no Pro',
    },
    {
      feature: 'Grupos e Projetos',
      whatsapp: 'Grupos antigos acumulando segredos industriais e acessíveis após demissões',
      nextmsg: 'Grupos Temporários com expiração automática que viram somente leitura após o prazo',
    },
    {
      feature: 'Comunicados Oficiais',
      whatsapp: 'Mensagens importantes soterradas por dezenas de "bom dia" e figurinhas',
      nextmsg: 'Canal oficial "Comunicados" unidirecional com relatório de entrega em tempo real',
    },
    {
      feature: 'Conformidade LGPD',
      whatsapp: 'Passivo trabalhista e risco de multas por vazamento sem trilha de auditoria',
      nextmsg: '100% conforme à Lei 13.709/2018 com exportação e anonimização de dados pessoais',
    },
    {
      feature: 'Tomada de Decisões',
      whatsapp: 'Discussões circulares e votações manuais sem apuração confiável',
      nextmsg: 'Enquetes integradas com votação única ou múltipla e resultado ao vivo na conversa',
    },
  ];

  return (
    <section id="comparison" className="py-20 md:py-28 relative bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-400">
            <AlertTriangle className="w-4 h-4" />
            <span>O Risco Oculto do WhatsApp Informal</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Por que empresas de alta performance estão saindo do WhatsApp?
          </h2>
          <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
            Misturar comunicação pessoal com trabalho gera distrações contínuas, vazamentos e riscos
            trabalhistas. O NextMsg devolve o controle e o foco à sua empresa.
          </p>
        </div>

        {/* Comparison Matrix */}
        <div className="max-w-5xl mx-auto overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/40 shadow-2xl">
          {/* Header Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 bg-slate-900/90 border-b border-slate-800 p-4 sm:p-6 text-sm font-bold uppercase tracking-wider">
            <div className="md:col-span-4 text-slate-400 mb-2 md:mb-0">Aspecto Operacional</div>
            <div className="md:col-span-4 text-red-400 flex items-center gap-2 mb-2 md:mb-0">
              <XCircle className="w-5 h-5 shrink-0" />
              <span>WhatsApp Tradicional</span>
            </div>
            <div className="md:col-span-4 text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>NextMsg Corporativo</span>
            </div>
          </div>

          {/* Data Rows */}
          <div className="divide-y divide-slate-850">
            {comparisonRows.map((row, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-12 p-4 sm:p-6 gap-3 md:gap-4 hover:bg-slate-850/40 transition-colors text-sm"
              >
                <div className="md:col-span-4 font-bold text-white flex items-center">
                  {row.feature}
                </div>
                <div className="md:col-span-4 text-slate-400 flex items-start gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-red-500/60 mt-1.5 shrink-0" />
                  <span>{row.whatsapp}</span>
                </div>
                <div className="md:col-span-4 text-emerald-200/90 font-medium flex items-start gap-2.5 bg-emerald-500/5 -m-2 p-2 rounded-xl border border-emerald-500/10">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <span>{row.nextmsg}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
