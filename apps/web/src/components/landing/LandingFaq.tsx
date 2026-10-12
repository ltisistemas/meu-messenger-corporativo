import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export const LandingFaq: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: 'Como funciona o teste de 14 dias grátis do Plano Pro?',
      answer:
        'Você cadastra sua organização em menos de 1 minuto sem precisar informar cartão de crédito ou forma de pagamento. Durante 14 dias, você e sua equipe têm acesso irrestrito a até 80 membros, canais de transmissão e enquetes ao vivo. Caso decida não assinar ao término do período, a conta simplesmente regride para o Plano Free sem cobranças surpresa.',
    },
    {
      question: 'Por que o NextMsg não possui mensagens de áudio ou chamadas?',
      answer:
        'Esta é uma escolha deliberada de produtividade e foco. Áudios de 5 minutos consomem horas de trabalho, impedem busca por texto e geram ruído operacional desnecessário. O NextMsg foi feito para comunicação executiva rápida, objetiva e rastreável, focada em texto claro e transferência eficiente de documentos.',
    },
    {
      question: 'Como funciona o envio de arquivos no Plano Free sem salvar nada?',
      answer:
        'No Plano Free (até 12 usuários), implementamos a arquitetura de "Relay em Memória". Quando você envia um arquivo para alguém online, os dados trafegam diretamente pela memória do servidor via WebSockets e são entregues ao destinatário sem que nenhum byte seja gravado em disco rígido ou em buckets de nuvem. É a máxima privacidade possível para conversas corporativas.',
    },
    {
      question: 'O que acontece com os arquivos nos Planos Pro e Enterprise?',
      answer:
        'Nos planos pagos, utilizamos a política de "Store-and-Forward Temporário". Os arquivos são enviados com criptografia (SSE-S3) e possuem um ciclo de vida estrito: assim que todos os membros da conversa realizam o download, o arquivo é imediatamente apagado do bucket. Se alguém não baixar, nosso job de expiração automática deleta o arquivo em até 5 dias.',
    },
    {
      question: 'Como faço para convidar meus colaboradores para o NextMsg?',
      answer:
        'Após criar sua conta de administrador, basta acessar o painel da organização e gerar links de convite ou enviar convites por e-mail. Cada colaborador clica no link, define sua senha e entra instantaneamente na organização e nos canais de comunicação da empresa.',
    },
    {
      question: 'O NextMsg funciona no celular (Android e iOS)?',
      answer:
        'Sim! O NextMsg é uma aplicação web progressiva (PWA) de ponta, 100% responsiva para dispositivos móveis. Você pode adicioná-lo à tela de início do seu smartphone ou tablet como um app nativo, com carregamento instantâneo e suporte a notificações push.',
    },
  ];

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-20 md:py-32 relative bg-slate-950 border-t border-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300">
            <HelpCircle className="w-4 h-4 text-emerald-400" />
            <span>Tire Suas Dúvidas</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Perguntas Frequentes
          </h2>
          <p className="text-base sm:text-lg text-slate-400">
            Tudo o que você precisa saber sobre o NextMsg antes de começar com a sua equipe.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;

            return (
              <div
                key={idx}
                className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isOpen
                    ? 'bg-slate-900/90 border-emerald-500/40 shadow-xl shadow-emerald-500/5'
                    : 'bg-slate-900/30 border-slate-800/80 hover:border-slate-700/80'
                }`}
              >
                <button
                  onClick={() => toggleAccordion(idx)}
                  className="w-full py-5 px-6 flex items-center justify-between text-left focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span className="text-base sm:text-lg font-bold text-white pr-4">
                    {faq.question}
                  </span>
                  <div
                    className={`p-2 rounded-xl bg-slate-800 text-slate-400 transform transition-transform duration-200 shrink-0 ${
                      isOpen ? 'rotate-180 text-emerald-400 bg-emerald-500/10' : ''
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 text-sm text-slate-400 leading-relaxed border-t border-slate-800/60 pt-4">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
