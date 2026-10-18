import React, { useState, useEffect } from 'react';
import {
  QrCode,
  CreditCard,
  FileText,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CreateSubscriptionDto, PLAN_CONFIGS } from '@corpchat/shared';
import { useAccountStore } from '../../stores/account.store';

export interface UpgradeCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetPlan: 'pro' | 'enterprise';
  billingCycle: 'monthly' | 'yearly';
  onSubmitCheckout: (dto: CreateSubscriptionDto) => Promise<void>;
  checkoutResult?: {
    chargeId?: string;
    subscriptionId?: string;
    pixQrCode?: string;
    pixCopyPaste?: string;
    bankSlipUrl?: string;
    invoiceUrl?: string;
  } | null;
  isLoading?: boolean;
}

export const UpgradeCheckoutModal: React.FC<UpgradeCheckoutModalProps> = ({
  isOpen,
  onClose,
  targetPlan,
  billingCycle,
  onSubmitCheckout,
  checkoutResult,
  isLoading = false,
}) => {
  const { checkCheckoutStatus, simulatePaymentConfirmation } = useAccountStore();
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card' | 'boleto'>('pix');
  const [copiedPix, setCopiedPix] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // Customer form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [addressNumber, setAddressNumber] = useState('');

  // Credit card form state
  const [holderName, setHolderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [ccv, setCcv] = useState('');

  const planConfig = PLAN_CONFIGS[targetPlan] || PLAN_CONFIGS.pro;
  const isYearly = billingCycle === 'yearly';
  const monthlyPrice = (planConfig.priceMonthlyCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  const yearlyTotal = Math.round(planConfig.priceMonthlyCents * 12 * 0.9) / 100;
  const yearlyPriceFormatted = yearlyTotal.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  // Polling every 3 seconds while PIX QR code is waiting for confirmation
  useEffect(() => {
    if (!isOpen) {
      setIsPaid(false);
      setIsSimulating(false);
      return;
    }

    if (!checkoutResult?.chargeId || isPaid) return;

    const interval = setInterval(async () => {
      try {
        const res = await checkCheckoutStatus(checkoutResult.chargeId!);
        if (res.status === 'PAID') {
          setIsPaid(true);
        }
      } catch (_) {}
    }, 3000);

    return () => clearInterval(interval);
  }, [isOpen, checkoutResult?.chargeId, isPaid, checkCheckoutStatus]);

  const handleCopyPix = () => {
    if (checkoutResult?.pixCopyPaste) {
      navigator.clipboard.writeText(checkoutResult.pixCopyPaste);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 3000);
    }
  };

  const handleSimulatePayment = async () => {
    if (!checkoutResult?.chargeId) return;
    try {
      setIsSimulating(true);
      await simulatePaymentConfirmation(checkoutResult.chargeId);
      setIsPaid(true);
    } catch (err: any) {
      setFormError(err.message || 'Erro ao simular confirmação.');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || !email.trim() || !cpfCnpj.trim()) {
      setFormError('Por favor preencha nome completo, e-mail e CPF/CNPJ.');
      return;
    }

    if (paymentMethod === 'credit_card') {
      if (
        !holderName.trim() ||
        !cardNumber.trim() ||
        !expiryMonth.trim() ||
        !expiryYear.trim() ||
        !ccv.trim()
      ) {
        setFormError('Por favor preencha todos os dados do cartão de crédito.');
        return;
      }
    }

    const payload: CreateSubscriptionDto = {
      plan: targetPlan,
      billingCycle,
      paymentMethod,
      customer: {
        name: name.trim(),
        email: email.trim(),
        cpfCnpj: cpfCnpj.replace(/\D/g, ''),
        phone: phone.trim() || undefined,
        postalCode: postalCode.replace(/\D/g, '') || undefined,
        addressNumber: addressNumber.trim() || undefined,
      },
      creditCard:
        paymentMethod === 'credit_card'
          ? {
              holderName: holderName.trim().toUpperCase(),
              number: cardNumber.replace(/\D/g, ''),
              expiryMonth: expiryMonth.padStart(2, '0'),
              expiryYear: expiryYear.length === 2 ? `20${expiryYear}` : expiryYear,
              ccv: ccv.trim(),
            }
          : undefined,
    };

    try {
      await onSubmitCheckout(payload);
    } catch (err: any) {
      setFormError(err.message || 'Erro ao processar checkout.');
    }
  };

  const qrImageSrc = checkoutResult?.pixQrCode
    ? checkoutResult.pixQrCode.startsWith('data:')
      ? checkoutResult.pixQrCode
      : `data:image/png;base64,${checkoutResult.pixQrCode}`
    : '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isPaid ? 'Assinatura Confirmada!' : `Assinatura Plano ${planConfig.name}`}
      description={
        isPaid
          ? 'Sua organização agora possui acesso completo aos recursos Pro'
          : `Ciclo ${isYearly ? 'Anual (-10% off)' : 'Mensal'} • Gateway de Pagamento Asaas`
      }
      maxWidth="lg"
    >
      {/* 0. If payment is confirmed, show Green Success Screen */}
      {isPaid ? (
        <div className="flex flex-col items-center text-center p-6 space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center animate-bounce">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Parabéns! Sua Assinatura está Ativa
          </h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
            O pagamento foi compensado pelo gateway Asaas e o{' '}
            <strong>Plano {planConfig.name}</strong> foi ativado com sucesso para toda a sua equipe.
          </p>
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 w-full flex justify-center">
            <Button
              variant="primary"
              onClick={onClose}
              className="px-8 shadow-lg shadow-emerald-500/20"
            >
              Ir para o Painel da Organização
            </Button>
          </div>
        </div>
      ) : checkoutResult?.pixQrCode || checkoutResult?.pixCopyPaste ? (
        /* 1. If PIX result generated, show QR Code view with Live Polling */
        <div className="flex flex-col items-center text-center p-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
            <QrCode className="w-6 h-6" />
          </div>
          <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Pague via Pix para Ativação Instantânea
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
            Abra o app do seu banco, escaneie o QR Code abaixo ou utilize o código Copia e Cola.
          </p>

          {/* QR Code Image */}
          {qrImageSrc && (
            <div className="my-5 p-3 bg-white rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm inline-block">
              <img src={qrImageSrc} alt="QR Code Pix" className="w-48 h-48 object-contain" />
            </div>
          )}

          {/* Copy Paste String */}
          {checkoutResult.pixCopyPaste && (
            <div className="w-full max-w-md mt-2">
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-300 break-all border border-slate-200 dark:border-slate-700">
                <span className="truncate flex-1 text-left">{checkoutResult.pixCopyPaste}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPix}
                  className="shrink-0 text-xs py-1 px-2.5 h-8 flex items-center gap-1"
                >
                  {copiedPix ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-slate-400 mt-5">
            <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
            <span>Aguardando confirmação do pagamento pelo gateway Asaas...</span>
          </div>

          {/* Sandbox Helper Simulation */}
          <div className="mt-3">
            <button
              type="button"
              onClick={handleSimulatePayment}
              disabled={isSimulating}
              className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 opacity-75 hover:opacity-100 transition"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>
                {isSimulating ? 'Confirmando...' : 'Simular Confirmação Instantânea (Sandbox)'}
              </span>
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 w-full flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      ) : checkoutResult?.bankSlipUrl ? (
        /* 2. If Boleto result generated, show Boleto download link */
        <div className="flex flex-col items-center text-center p-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center mb-3">
            <FileText className="w-6 h-6" />
          </div>
          <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Boleto Bancário Gerado com Sucesso!
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
            Seu boleto foi emitido. O plano será ativado assim que o pagamento for compensado pelo
            banco.
          </p>

          <a
            href={checkoutResult.bankSlipUrl}
            target="_blank"
            rel="noreferrer"
            className="my-6 inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-xl font-medium text-sm shadow-md transition"
          >
            <span>Visualizar / Imprimir Boleto</span>
            <ExternalLink className="w-4 h-4" />
          </a>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 w-full flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      ) : (
        /* 3. Checkout Form */
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Plan Summary Card */}
          <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-900 dark:text-slate-100">
                Plano {planConfig.name} ({isYearly ? 'Anual' : 'Mensal'})
              </div>
              <div className="text-xs text-slate-500">
                {isYearly
                  ? `${yearlyPriceFormatted} por 12 meses`
                  : `${monthlyPrice} cobrado mensalmente`}
              </div>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-brand-600 dark:text-brand-400">
                {isYearly ? yearlyPriceFormatted : monthlyPrice}
              </span>
            </div>
          </div>

          {formError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Forma de Pagamento
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('pix')}
                className={`p-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-2 transition ${
                  paymentMethod === 'pix'
                    ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <QrCode className="w-5 h-5 text-emerald-500" />
                <span>Pix (Instantâneo)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('credit_card')}
                className={`p-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-2 transition ${
                  paymentMethod === 'credit_card'
                    ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <CreditCard className="w-5 h-5 text-brand-500" />
                <span>Cartão de Crédito</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('boleto')}
                className={`p-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-2 transition ${
                  paymentMethod === 'boleto'
                    ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <FileText className="w-5 h-5 text-amber-500" />
                <span>Boleto Bancário</span>
              </button>
            </div>
          </div>

          {/* Customer Information */}
          <div className="space-y-3 pt-2">
            <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Dados do Pagador / Nota Fiscal
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Nome / Razão Social *
                </label>
                <Input
                  type="text"
                  placeholder="Nome Completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  E-mail de Cobrança *
                </label>
                <Input
                  type="email"
                  placeholder="financeiro@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  CPF ou CNPJ *
                </label>
                <Input
                  type="text"
                  placeholder="000.000.000-00"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Telefone / WhatsApp
                </label>
                <Input
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  CEP
                </label>
                <Input
                  type="text"
                  placeholder="00000-000"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Número do Endereço
                </label>
                <Input
                  type="text"
                  placeholder="123"
                  value={addressNumber}
                  onChange={(e) => setAddressNumber(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          {/* Credit Card Specific Fields */}
          {paymentMethod === 'credit_card' && (
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Dados do Cartão de Crédito
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Nome Impresso no Cartão *
                  </label>
                  <Input
                    type="text"
                    placeholder="NOME COMO NO CARTAO"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    required
                    className="text-xs uppercase"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Número do Cartão *
                  </label>
                  <Input
                    type="text"
                    placeholder="0000 0000 0000 0000"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    required
                    maxLength={19}
                    className="text-xs"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Mês (MM) *
                    </label>
                    <Input
                      type="text"
                      placeholder="12"
                      value={expiryMonth}
                      onChange={(e) => setExpiryMonth(e.target.value)}
                      maxLength={2}
                      required
                      className="text-xs text-center"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Ano (AA) *
                    </label>
                    <Input
                      type="text"
                      placeholder="28"
                      value={expiryYear}
                      onChange={(e) => setExpiryYear(e.target.value)}
                      maxLength={4}
                      required
                      className="text-xs text-center"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Código de Segurança (CCV) *
                  </label>
                  <Input
                    type="password"
                    placeholder="123"
                    value={ccv}
                    onChange={(e) => setCcv(e.target.value)}
                    maxLength={4}
                    required
                    className="text-xs text-center"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <Button variant="outline" type="button" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-medium shadow-md flex items-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {paymentMethod === 'credit_card' ? 'Pagar e Ativar Agora' : 'Gerar Cobrança Asaas'}
              </span>
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
