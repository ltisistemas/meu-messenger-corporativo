import React, { useState } from 'react';
import { Link } from '../ui/Link';
import { MessageSquare, Menu, X, ArrowRight, Sparkles } from 'lucide-react';

export const LandingNavbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-3 group focus:outline-none">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/35 group-hover:scale-105 transition-all duration-300">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                NextMsg
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-md">
                B2B
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-400">
              Mensageria Corporativa Focada
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <button
            onClick={() => scrollToSection('features')}
            className="hover:text-emerald-400 transition-colors focus:outline-none"
          >
            Recursos
          </button>
          <button
            onClick={() => scrollToSection('comparison')}
            className="hover:text-emerald-400 transition-colors focus:outline-none"
          >
            WhatsApp vs NextMsg
          </button>
          <button
            onClick={() => scrollToSection('pricing')}
            className="hover:text-emerald-400 transition-colors focus:outline-none"
          >
            Planos
          </button>
          <button
            onClick={() => scrollToSection('security')}
            className="hover:text-emerald-400 transition-colors focus:outline-none"
          >
            Segurança & LGPD
          </button>
          <button
            onClick={() => scrollToSection('faq')}
            className="hover:text-emerald-400 transition-colors focus:outline-none"
          >
            Dúvidas
          </button>
        </nav>

        {/* Desktop Action Buttons */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            to="/login"
            className="text-sm font-semibold text-slate-300 hover:text-white px-4 py-2.5 rounded-xl hover:bg-slate-900 transition-all focus:outline-none"
          >
            Entrar
          </Link>
          <Link
            to="/register?plan=pro&trial=true"
            className="relative group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-300 hover:brightness-110 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            <Sparkles className="w-4 h-4 text-emerald-950 fill-emerald-950 animate-pulse" />
            <span>Testar Pro 14 Dias Grátis</span>
            <ArrowRight className="w-4 h-4 text-emerald-950 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <div className="flex md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 focus:outline-none"
            aria-label="Abrir menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-800 bg-slate-950/95 backdrop-blur-2xl px-4 pt-3 pb-6 space-y-4">
          <div className="flex flex-col space-y-3 font-medium text-slate-300">
            <button
              onClick={() => scrollToSection('features')}
              className="text-left py-2 hover:text-emerald-400 transition-colors"
            >
              Recursos
            </button>
            <button
              onClick={() => scrollToSection('comparison')}
              className="text-left py-2 hover:text-emerald-400 transition-colors"
            >
              WhatsApp vs NextMsg
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="text-left py-2 hover:text-emerald-400 transition-colors"
            >
              Planos & Preços
            </button>
            <button
              onClick={() => scrollToSection('security')}
              className="text-left py-2 hover:text-emerald-400 transition-colors"
            >
              Segurança & LGPD
            </button>
            <button
              onClick={() => scrollToSection('faq')}
              className="text-left py-2 hover:text-emerald-400 transition-colors"
            >
              Perguntas Frequentes
            </button>
          </div>
          <div className="pt-4 border-t border-slate-800/80 flex flex-col gap-3">
            <Link
              to="/login"
              className="w-full text-center py-2.5 rounded-xl font-semibold text-slate-300 hover:bg-slate-900 transition-all border border-slate-800"
            >
              Entrar
            </Link>
            <Link
              to="/register?plan=pro&trial=true"
              className="w-full text-center py-3 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:brightness-110 shadow-lg shadow-emerald-500/25 transition-all"
            >
              Testar Pro por 14 Dias Grátis
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

