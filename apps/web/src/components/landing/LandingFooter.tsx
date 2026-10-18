import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, ShieldCheck, ArrowUp, CheckCircle2 } from 'lucide-react';

export const LandingFooter: React.FC = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="w-full bg-slate-950 border-t border-slate-900 text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-slate-900">
          {/* Brand Col */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-extrabold text-white tracking-tight">NextMsg</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              O mensageiro corporativo sem ruídos, sem áudios e sem retenção indevida de arquivos.
              Comunicação ágil e segura para equipes de alta performance.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Conformidade Total com a LGPD</span>
            </div>
          </div>

          {/* Produto */}
          <div>
            <h4 className="text-sm font-semibold text-slate-100 uppercase tracking-wider mb-4">
              Produto
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="#features" className="hover:text-emerald-400 transition-colors">
                  Relay em Memória (Free)
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-emerald-400 transition-colors">
                  Grupos Temporários
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-emerald-400 transition-colors">
                  Canal Comunicados
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-emerald-400 transition-colors">
                  Enquetes em Tempo Real
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-emerald-400 transition-colors">
                  Assinatura Eletrônica (Clicksign)
                </a>
              </li>
            </ul>
          </div>

          {/* Planos & Segurança */}
          <div>
            <h4 className="text-sm font-semibold text-slate-100 uppercase tracking-wider mb-4">
              Planos & Segurança
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="#pricing" className="hover:text-emerald-400 transition-colors">
                  Plano Free (até 12 membros)
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-emerald-400 transition-colors">
                  Plano Pro (até 80 membros)
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-emerald-400 transition-colors">
                  Plano Enterprise
                </a>
              </li>
              <li>
                <a href="#security" className="hover:text-emerald-400 transition-colors">
                  Direitos do Titular (Art. 18 LGPD)
                </a>
              </li>
              <li>
                <a href="#security" className="hover:text-emerald-400 transition-colors">
                  Criptografia em Trânsito e Repouso
                </a>
              </li>
            </ul>
          </div>

          {/* Começar */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-100 uppercase tracking-wider mb-4">
              Comece Agora
            </h4>
            <p className="text-sm text-slate-400">
              Experimente todas as ferramentas do Plano Pro por 14 dias sem cadastrar cartão.
            </p>
            <Link
              to="/register?plan=pro&trial=true"
              className="inline-flex w-full items-center justify-center px-4 py-2.5 rounded-xl font-bold text-sm text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:brightness-110 shadow-lg shadow-emerald-500/20 transition-all"
            >
              Iniciar 14 Dias Grátis
            </Link>
            <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Sem cobrança automática posterior</span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} NextMsg Tecnologia Ltda. Todos os direitos reservados.</p>
          <div className="flex items-center gap-6">
            <a href="#security" className="hover:text-slate-300 transition-colors">
              Privacidade & Termos
            </a>
            <Link to="/login" className="hover:text-slate-300 transition-colors">
              Acesso ao Sistema
            </Link>
            <button
              onClick={scrollToTop}
              className="inline-flex items-center gap-1.5 p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors"
              aria-label="Voltar ao topo"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span>Topo</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
