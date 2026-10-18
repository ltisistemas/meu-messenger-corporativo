import React, { useState } from 'react';
import { Link } from '../ui/Link';
import { Check, Sparkles, ArrowRight } from 'lucide-react';

export const LandingPricing: React.FC = () => {
  const [isAnnual, setIsAnnual] = useState(false);

  const plans = [
    {
      id: 'free',
      name: 'Free',
      tagline: 'Ideal para pequenas equipes testarem sem custo.',
      monthlyPrice: 'R$ 0',
      annualPrice: 'R$ 0',
      period: '/mês',
      popular: false,
      ctaText: 'Começar no Plano Free',
      ctaHref: '/register?plan=free',
      features: [
        'Até 12 colaboradores na organização',
        'Arquivos de até 5 MB por envio',
        'Relay em memória (apenas para online)',
        'Zero gravação em disco ou nuvem',
        'Conversas 1:1 e grupos fixos',
        'Grupos temporários expiráveis',
        'Indicador de entrega "X de Y"',
      ],
      disabledFeatures: [
        'Envio para destinatário offline',
        'Canal de transmissão Comunicados',
        'Enquetes corporativas',
        'Assinatura eletrônica Clicksign',
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      tagline: 'Para equipes em crescimento que precisam de produtividade.',
      monthlyPrice: 'R$ 79,90',
      annualPrice: 'R$ 66,50',
      period: '/mês',
      annualTotal: 'cobrado anualmente (R$ 798/ano)',
      popular: true,
      badge: 'Mais Escolhido · 14 Dias Grátis',
      ctaText: 'Testar Pro por 14 Dias Grátis',
      ctaHref: '/register?plan=pro&trial=true',
      features: [
        'Até 80 colaboradores na organização',
        'Arquivos de até 25 MB (teto 125 MB por envio)',
        'Envio de arquivos para membros offline',
        'Store-and-forward R2 (exclusão em até 5 dias)',
        'Canal Oficial "Comunicados" (Transmissão)',
        'Relatório de entrega e leitura da liderança',
        'Enquetes em tempo real ilimitadas',
        '14 dias de Trial gratuito sem cartão',
      ],
      disabledFeatures: ['Assinatura eletrônica Clicksign'],
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      tagline: 'Para operações que exigem governança e assinaturas digitais.',
      monthlyPrice: 'R$ 259,90',
      annualPrice: 'R$ 216,50',
      period: '/mês',
      annualTotal: 'cobrado anualmente (R$ 2.598/ano)',
      popular: false,
      badge: 'Governança Total',
      ctaText: 'Contratar Enterprise',
      ctaHref: '/register?plan=enterprise',
      features: [
        'Colaboradores ilimitados na organização',
        'Arquivos de até 25 MB (teto 100 MB por envio)',
        'Store-and-forward com ciclo de 5 dias',
        'Assinatura Eletrônica Clicksign integrada',
        'Manifesto de evidências com hash SHA-256',
        'Exportação total e anonimização LGPD',
        'Suporte prioritário com SLA empresarial',
        'Trilha completa de auditoria administrativa',
      ],
      disabledFeatures: [],
    },
  ];

  return (
    <section id="pricing" className="py-20 md:py-32 relative bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400">
            <Sparkles className="w-4 h-4" />
            <span>Planos Claros e Sem Pegadinhas</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Escolha o plano ideal para a sua equipe
          </h2>
          <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
            Comece gratuitamente no Plano Free ou ative o Trial de 14 dias do Plano Pro com todas as
            funcionalidades liberadas e sem necessidade de cartão de crédito.
          </p>

          {/* Billing Switcher */}
          <div className="pt-6 flex items-center justify-center gap-4">
            <span
              className={`text-sm font-semibold cursor-pointer ${
                !isAnnual ? 'text-white' : 'text-slate-400'
              }`}
              onClick={() => setIsAnnual(false)}
            >
              Faturamento Mensal
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="w-14 h-8 flex items-center rounded-full p-1 bg-slate-800 transition-colors focus:outline-none"
              aria-label="Alternar faturamento mensal e anual"
            >
              <div
                className={`bg-emerald-400 w-6 h-6 rounded-full shadow-md transform transition-transform ${
                  isAnnual ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-semibold cursor-pointer ${
                  isAnnual ? 'text-white' : 'text-slate-400'
                }`}
                onClick={() => setIsAnnual(true)}
              >
                Faturamento Anual
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                -17% OFF
              </span>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan) => {
            const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 ${
                  plan.popular
                    ? 'bg-slate-900/90 border-2 border-emerald-500 shadow-2xl shadow-emerald-500/15 lg:-translate-y-2'
                    : 'bg-slate-900/40 border border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Popular badge */}
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1.5 rounded-full text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 shadow-lg shadow-emerald-500/30 uppercase tracking-wider">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div>
                  {/* Title & Tagline */}
                  <div className="mb-6">
                    <h3 className="text-2xl font-extrabold text-white mb-2">{plan.name}</h3>
                    <p className="text-xs sm:text-sm text-slate-400">{plan.tagline}</p>
                  </div>

                  {/* Price */}
                  <div className="mb-8 pb-8 border-b border-slate-800">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                        {price}
                      </span>
                      <span className="text-sm font-semibold text-slate-400">{plan.period}</span>
                    </div>
                    {isAnnual && plan.annualTotal && (
                      <p className="text-xs text-emerald-400 font-medium mt-1">
                        {plan.annualTotal}
                      </p>
                    )}
                  </div>

                  {/* Features List */}
                  <div className="space-y-3.5 mb-8">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Incluso neste plano:
                    </div>
                    {plan.features.map((feature, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-3 text-sm text-slate-200">
                        <div className="p-0.5 rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5 shrink-0">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                        <span>{feature}</span>
                      </div>
                    ))}
                    {plan.disabledFeatures.map((disabled, dIdx) => (
                      <div
                        key={dIdx}
                        className="flex items-start gap-3 text-sm text-slate-600 line-through"
                      >
                        <div className="w-4 h-4 rounded-full border border-slate-700 text-slate-700 mt-0.5 shrink-0 flex items-center justify-center text-[10px]">
                          ✕
                        </div>
                        <span>{disabled}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card CTA */}
                <div>
                  <Link
                    to={plan.ctaHref}
                    className={`w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-bold text-sm transition-all duration-200 focus:outline-none ${
                      plan.popular
                        ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-300 text-slate-950 hover:brightness-110 shadow-xl shadow-emerald-500/25'
                        : 'bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <span>{plan.ctaText}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  {plan.id === 'pro' && (
                    <p className="text-center text-[11px] text-slate-400 mt-2">
                      Sem compromisso · Sem cartão de crédito
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

