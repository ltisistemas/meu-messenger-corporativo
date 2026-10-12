import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  MessageSquare,
  Building,
  User,
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  Zap,
  Crown,
  AlertCircle,
} from 'lucide-react';
import { PlanType, PLAN_CONFIGS } from '@corpchat/shared';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useAuthStore } from '../stores/auth.store';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register, isLoading, error, clearError } = useAuthStore();

  const queryPlan = searchParams.get('plan') as PlanType | null;
  const initialPlan: PlanType = queryPlan && ['free', 'pro', 'enterprise'].includes(queryPlan)
    ? queryPlan
    : 'pro';
  const [selectedPlan, setSelectedPlan] = useState<PlanType>(initialPlan);
  const [accountName, setAccountName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (!accountName.trim() || !name.trim() || !email.trim() || !password.trim()) {
      setFormError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (password.length < 8) {
      setFormError('A senha deve ter no mínimo 8 caracteres.');
      return;
    }

    try {
      await register({
        accountName: accountName.trim(),
        name: name.trim(),
        email: email.trim(),
        password,
        plan: selectedPlan,
      });
      navigate('/chat');
    } catch {
      // Error handled in store
    }
  };

  const displayError = formError || error;

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-slate-950 relative overflow-x-hidden font-sans">
      {/* Ambient background glows */}
      <div className="absolute top-1/6 -left-32 w-[30rem] h-[30rem] bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/6 -right-32 w-[30rem] h-[30rem] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-2xl w-full relative z-10 my-8">
        {/* Brand Header */}
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 shadow-glow mb-2">
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Criar Organização no Next<span className="text-brand-400">Msg</span>
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Configure seu workspace corporativo com isolamento multi-tenant e política de privacidade.
          </p>
        </div>

        {/* Register Container Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Plan Selector Cards */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              1. Selecione o Plano Inicial
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.entries(PLAN_CONFIGS).map(([key, plan]) => {
                const planKey = key as PlanType;
                const isSelected = selectedPlan === planKey;

                return (
                  <div
                    key={key}
                    onClick={() => setSelectedPlan(planKey)}
                    className={`cursor-pointer rounded-xl p-4 border transition duration-200 relative flex flex-col justify-between ${
                      isSelected
                        ? 'bg-brand-500/10 border-brand-500 shadow-glow'
                        : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600 hover:bg-slate-800/60'
                    }`}
                  >
                    {planKey === 'pro' && (
                      <div className="absolute -top-2.5 right-3">
                        <Badge variant="brand" size="sm">
                          14 dias grátis
                        </Badge>
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white capitalize">{plan.name}</h3>
                        {planKey === 'enterprise' && <Crown className="w-4 h-4 text-amber-400" />}
                        {planKey === 'pro' && <Zap className="w-4 h-4 text-brand-400" />}
                        {planKey === 'free' && <ShieldCheck className="w-4 h-4 text-emerald-400" />}
                      </div>

                      <p className="text-xs text-slate-400">
                        {plan.maxUsers === Number.POSITIVE_INFINITY
                          ? 'Usuários ilimitados'
                          : `Até ${plan.maxUsers} usuários`}
                      </p>
                    </div>

                    <div className="pt-3 mt-2 border-t border-slate-700/40 flex items-center justify-between text-xs">
                      <span className="font-bold text-white">
                        {planKey === 'free'
                          ? 'Gratuito'
                          : `R$ ${(plan.priceMonthlyCents / 100).toFixed(2).replace('.', ',')}/mês`}
                      </span>
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? 'border-brand-500 bg-brand-500 text-white'
                            : 'border-slate-600'
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form Error Alert */}
          {displayError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-400 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          {/* Organization & Admin Details Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1 pt-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                2. Dados da Empresa e Administrador
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nome da Organização / Empresa"
                placeholder="Ex: Acma Corp, Tech Solutions"
                leftIcon={<Building className="w-4 h-4 text-slate-400" />}
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                disabled={isLoading}
                required
              />

              <Input
                label="Nome do Administrador (Owner)"
                placeholder="Ex: Carlos Silva"
                leftIcon={<User className="w-4 h-4 text-slate-400" />}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="E-mail de Trabalho"
                type="email"
                placeholder="carlos@empresa.com"
                leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
                required
              />

              <Input
                label="Senha Forte (mín. 8 dígitos)"
                type="password"
                placeholder="••••••••"
                leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-4"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Criar Espaço de Trabalho
            </Button>
          </form>

          <div className="pt-4 border-t border-slate-800 text-center text-xs text-slate-400">
            Já possui uma conta ou foi convidado?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 font-semibold transition">
              Fazer login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
