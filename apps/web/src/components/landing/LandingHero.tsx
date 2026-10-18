import React from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  FileCheck2,
  BarChart3,
  Send,
  Lock,
  Flame,
} from 'lucide-react';

export const LandingHero: React.FC = () => {
  return (
    <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden">
      {/* Background radial glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-emerald-600/20 via-teal-500/15 to-indigo-600/20 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-96 h-96 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Top Announcement Pill */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-900/90 border border-emerald-500/30 shadow-lg shadow-emerald-500/10 text-xs sm:text-sm font-medium text-slate-300">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-semibold text-emerald-400">Novo Lançamento</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-300">Chega de áudios infinitos e bagunça no WhatsApp</span>
            <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        </div>

        {/* Headline & Subhead */}
        <div className="text-center max-w-4xl mx-auto space-y-6">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.12]">
            Comunicação corporativa focada,{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
              sem ruídos
            </span>{' '}
            e com privacidade radical.
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Elimine as distrações de áudios longos e grupos informais. Tenha mensageria de alta
            velocidade em texto, zero retenção de arquivos no Free, grupos temporários expiráveis e
            assinatura eletrônica em total conformidade com a LGPD.
          </p>

          {/* Primary & Secondary CTAs */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register?plan=pro&trial=true"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-base font-bold text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-300 hover:brightness-110 shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all duration-200 focus:outline-none"
            >
              <Sparkles className="w-5 h-5 text-emerald-950 fill-emerald-950" />
              <span>Testar Pro por 14 Dias Grátis</span>
              <ArrowRight className="w-5 h-5 text-emerald-950" />
            </Link>

            <a
              href="#comparison"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl text-base font-semibold text-slate-200 bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 shadow-lg hover:-translate-y-0.5 transition-all duration-200 focus:outline-none"
            >
              <span>Ver Comparativo</span>
            </a>
          </div>

          {/* Trust Guarantees */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs sm:text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Sem cartão de crédito no cadastro</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Plano Free até 12 colaboradores</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>100% Conforme à LGPD (Art. 18)</span>
            </div>
          </div>
        </div>

        {/* Interactive App Mockup Preview */}
        <div className="mt-14 max-w-5xl mx-auto">
          <div className="relative rounded-3xl p-1 bg-gradient-to-b from-slate-700/60 via-slate-800/40 to-slate-900/80 shadow-2xl shadow-emerald-500/10">
            <div className="rounded-[22px] overflow-hidden bg-slate-950 border border-slate-800/80 shadow-2xl">
              {/* Window Header */}
              <div className="bg-slate-900/90 px-4 py-3 border-b border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-3 text-xs font-semibold text-slate-400">
                    NextMsg Desktop — TechCorp Soluções
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>34 Colaboradores Online</span>
                </div>
              </div>

              {/* Chat Interface Preview */}
              <div className="grid grid-cols-1 md:grid-cols-12 min-h-[460px]">
                {/* Sidebar mock */}
                <div className="hidden md:block md:col-span-4 bg-slate-900/50 border-r border-slate-800/80 p-3 space-y-2">
                  <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Conversas Ativas
                  </div>
                  {/* Channel 1 (Active) */}
                  <div className="p-3 rounded-xl bg-slate-800/80 border border-emerald-500/30 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-amber-400" />
                        Lançamento Q4
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Expira em 18h
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      Diretoria: Documento assinado disponível...
                    </p>
                  </div>

                  {/* Channel 2 */}
                  <div className="p-3 rounded-xl hover:bg-slate-800/40 text-left transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-slate-300">
                        📢 Comunicados Oficiais
                      </span>
                      <span className="text-[10px] text-slate-400">10:15</span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      Canal de transmissão: Política de folgas...
                    </p>
                  </div>

                  {/* Channel 3 */}
                  <div className="p-3 rounded-xl hover:bg-slate-800/40 text-left transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-slate-300">
                        Engenharia & Dados
                      </span>
                      <span className="text-[10px] text-slate-400">09:40</span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      Relay de arquivo completado com sucesso
                    </p>
                  </div>
                </div>

                {/* Main Chat Feed */}
                <div className="col-span-12 md:col-span-8 p-4 sm:p-6 flex flex-col justify-between bg-slate-950/60">
                  {/* Active Room Title */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                        <span>Lançamento Q4</span>
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          Grupo Temporário
                        </span>
                      </h2>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Expira e torna-se somente leitura hoje às 23:59</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Criptografado</span>
                    </div>
                  </div>

                  {/* Messages Feed */}
                  <div className="space-y-4">
                    {/* Message 1 */}
                    <div className="flex flex-col items-start max-w-[85%]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-indigo-400">
                          Mariana Souza (COO)
                        </span>
                        <span className="text-[10px] text-slate-400">10:32</span>
                      </div>
                      <div className="p-3.5 rounded-2xl rounded-tl-sm bg-slate-800/90 text-slate-200 text-sm leading-relaxed border border-slate-700/60">
                        Bom dia equipe! Finalizamos a minuta com o cliente corporativo. Documento
                        com autenticação e trilha de evidências anexado abaixo:
                      </div>
                    </div>

                    {/* Message 2: Electronic Signature Card */}
                    <div className="flex flex-col items-start max-w-[90%]">
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-850 border border-indigo-500/30 shadow-lg text-slate-200 text-xs sm:text-sm w-full">
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                              <FileCheck2 className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="font-bold text-white">Acordo_Comercial_Q4.pdf</div>
                              <div className="text-[11px] text-slate-400">
                                Autenticação Clicksign (Lei 14.063/2020)
                              </div>
                            </div>
                          </div>
                          <span className="px-2 py-1 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Assinado por 3/3
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400 text-[11px]">
                          <span>Hash SHA-256 verificado com sucesso</span>
                          <span className="font-semibold text-emerald-400 hover:underline cursor-pointer">
                            Baixar Certificado
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Message 3: Live Poll Card */}
                    <div className="flex flex-col items-start max-w-[90%]">
                      <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/30 text-xs sm:text-sm w-full">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-white flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-emerald-400" />
                            Enquete: Cronograma de homologação aprovado?
                          </span>
                          <span className="text-[10px] text-emerald-400 font-semibold">
                            Ao Vivo
                          </span>
                        </div>
                        <div className="space-y-2 pt-1">
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-300">Sim, liberado para produção</span>
                              <span className="font-bold text-emerald-400">88% (22 votos)</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div className="h-full bg-emerald-400 rounded-full w-[88%]" />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-400">Ajustar antes de subir</span>
                              <span className="text-slate-400">12% (3 votos)</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div className="h-full bg-slate-600 rounded-full w-[12%]" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Input Mock */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-3">
                    <div className="flex-1 bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-400 flex items-center justify-between">
                      <span>Digite sua mensagem de texto ou anexe um arquivo...</span>
                      <span className="text-[10px] text-emerald-400 font-medium">
                        Zero Retenção Free Ativa
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold">
                      <Send className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
