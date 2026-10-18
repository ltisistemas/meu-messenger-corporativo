import React, { useState } from 'react';
import { Check, Sparkles, ArrowRight } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { PlanType } from '@/shared';

export interface PlansComparisonSectionProps {
  currentPlan?: PlanType;
  onSelectUpgrade: (plan: 'pro' | 'enterprise', billingCycle: 'monthly' | 'yearly') => void;
  onDowngradeToFree: () => void;
}

export const PlansComparisonSection: React.FC<PlansComparisonSectionProps> = ({
  currentPlan = 'free',
  onSelectUpgrade,
  onDowngradeToFree,
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const plans = [
    {
      id: 'free' as PlanType,
      name: 'Free',
      badge: 'Básico',
      monthlyPrice: 'R$ 0',
      yearlyPrice: 'R$ 0',
      description: 'Ideal para equipes pequenas que estão começando a se comunicar.',
      maxUsers: 'Até 12 usuários',
      features: [
        { label: 'Até 12 usuários na organização', included: true },
        { label: 'Envio de arquivos de até 5 MB', included: true },
        { label: '1 arquivo por envio', included: true },
        { label: 'Relay em memória (destinatário online)', included: true },
        { label: 'Grupos fixos e temporários com expiração', included: true },
        { label: 'Envio para contatos offline', included: false },
        { label: 'Lista de transmissão para toda a conta', included: false },
        { label: 'Enquetes interativas em tempo real', included: false },
        { label: 'Assinatura eletrônica com validade jurídica', included: false },
      ],
    },
    {
      id: 'pro' as PlanType,
      name: 'Pro',
      badge: 'Mais Escolhido',
      isPopular: true,
      monthlyPrice: 'R$ 79,90',
      yearlyPrice: 'R$ 71,91',
      yearlyPeriodText: '/mês (cobrado anualmente)',
      description: 'Para empresas em crescimento que precisam de retenção e recursos avançados.',
      maxUsers: 'Até 80 usuários',
      features: [
        { label: 'Até 80 usuários na organização', included: true },
        { label: 'Arquivos de até 25 MB (até 5 arquivos / 125 MB total)', included: true },
        { label: 'Store-and-forward (entrega para contatos offline)', included: true },
        { label: 'Retenção temporária de 5 dias ou exclusão pós-download', included: true },
        { label: 'Listas de transmissão ilimitadas com relatórios', included: true },
        { label: 'Enquetes com votação única ou múltipla em tempo real', included: true },
        { label: 'Grupos temporários com expiração configurável', included: true },
        { label: 'Assinatura eletrônica de contratos', included: false },
      ],
    },
    {
      id: 'enterprise' as PlanType,
      name: 'Enterprise',
      badge: 'Completo',
      monthlyPrice: 'R$ 259,90',
      yearlyPrice: 'R$ 233,91',
      yearlyPeriodText: '/mês (cobrado anualmente)',
      description: 'Para médias e grandes empresas com volume ilimitado e assinaturas eletrônicas.',
      maxUsers: 'Usuários Ilimitados',
      features: [
        { label: 'Usuários ilimitados na organização', included: true },
        { label: 'Arquivos de até 25 MB (até 20 arquivos / 100 MB total)', included: true },
        { label: 'Store-and-forward com bucket dedicado', included: true },
        { label: 'Assinaturas eletrônicas (Clicksign) Lei 14.063/2020', included: true },
        { label: 'Certificado de evidências e hash SHA-256', included: true },
        { label: 'Listas de transmissão com relatório de leitura', included: true },
        { label: 'Enquetes com relatórios de votação detalhados', included: true },
        { label: 'SLA de disponibilidade 99.9% e suporte prioritário', included: true },
      ],
    },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
      {/* Section Header */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          Planos Flexíveis para a sua Empresa
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          Comunicação corporativa segura, rápida e com privacidade absoluta. Sem custos ocultos.
        </p>

        {/* Billing Cycle Switch */}
        <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl mt-6 border border-slate-200 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-xl transition ${
              billingCycle === 'monthly'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Mensal
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('yearly')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 ${
              billingCycle === 'yearly'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span>Anual</span>
            <span className="bg-amber-400 text-amber-950 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              -10%
            </span>
          </button>
        </div>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isUpgrade =
            (currentPlan === 'free' && (plan.id === 'pro' || plan.id === 'enterprise')) ||
            (currentPlan === 'pro' && plan.id === 'enterprise');
          const isDowngrade = currentPlan === 'pro' && plan.id === 'free';

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col justify-between rounded-2xl p-6 transition-all duration-200 ${
                plan.isPopular
                  ? 'border-2 border-brand-500 bg-gradient-to-b from-brand-500/5 to-transparent dark:from-brand-900/10 shadow-lg'
                  : 'border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40'
              }`}
            >
              {/* Popular Badge */}
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-brand-600 to-indigo-600 text-white text-[11px] font-bold px-3 py-0.5 rounded-full shadow-md flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>{plan.badge}</span>
                </div>
              )}

              <div>
                {/* Plan Header */}
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {plan.name}
                  </h4>
                  {isCurrent && (
                    <Badge variant="brand" className="text-xs font-semibold">
                      Plano Atual
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 min-h-[36px]">
                  {plan.description}
                </p>

                {/* Price Display */}
                <div className="my-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                      {billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice}
                    </span>
                    <span className="text-xs text-slate-500">
                      {billingCycle === 'yearly' && plan.id !== 'free'
                        ? plan.yearlyPeriodText
                        : '/mês'}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-brand-600 dark:text-brand-400 mt-1">
                    {plan.maxUsers}
                  </div>
                </div>

                {/* Features List */}
                <div className="space-y-3 pt-4 border-t border-slate-200/60 dark:border-slate-800">
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs">
                      {feat.included ? (
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <span className="w-4 h-4 text-slate-300 dark:text-slate-700 shrink-0 text-center font-bold">
                          –
                        </span>
                      )}
                      <span
                        className={
                          feat.included
                            ? 'text-slate-700 dark:text-slate-300'
                            : 'text-slate-400 dark:text-slate-600 line-through'
                        }
                      >
                        {feat.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action CTA */}
              <div className="mt-8 pt-4">
                {isCurrent ? (
                  <Button variant="outline" disabled className="w-full text-xs">
                    Plano Ativo
                  </Button>
                ) : isUpgrade ? (
                  <Button
                    variant="primary"
                    onClick={() => onSelectUpgrade(plan.id as 'pro' | 'enterprise', billingCycle)}
                    className={`w-full text-xs font-semibold flex items-center justify-center gap-1.5 ${
                      plan.isPopular
                        ? 'bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-md'
                        : ''
                    }`}
                  >
                    <span>Fazer Upgrade para {plan.name}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                ) : isDowngrade ? (
                  <Button
                    variant="outline"
                    onClick={onDowngradeToFree}
                    className="w-full text-xs text-slate-500 hover:text-red-500 border-slate-200 dark:border-slate-800"
                  >
                    Mudar para Free
                  </Button>
                ) : (
                  <Button variant="outline" disabled className="w-full text-xs">
                    Não Disponível
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

