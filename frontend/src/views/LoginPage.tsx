import React, { useState } from 'react';
import { Link, useNavigate } from '../hooks/use-navigate';
import { MessageSquare, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../stores/auth.store';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (!email.trim() || !password.trim()) {
      setFormError('Preencha seu e-mail e senha corporativos.');
      return;
    }

    try {
      await login({ email: email.trim(), password });
      navigate('/chat');
    } catch {
      // Error handled in store
    }
  };

  const displayError = formError || error;

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden font-sans">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 shadow-glow mb-2">
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Next<span className="text-brand-400">Msg</span>
          </h1>
          <p className="text-slate-400 text-sm">
            Mensageiro corporativo focado em privacidade, segurança e zero retenção.
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white">Acesse sua conta</h2>
            <p className="text-xs text-slate-400">Digite suas credenciais de acesso corporativo.</p>
          </div>

          {displayError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-400 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="E-mail Corporativo"
              type="email"
              placeholder="voce@empresa.com"
              leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
              autoFocus
            />

            <Input
              label="Senha"
              type="password"
              placeholder="••••••••"
              leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="current-password"
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Entrar no NextMsg
            </Button>
          </form>

          <div className="pt-4 border-t border-slate-800 text-center text-xs text-slate-400 space-y-2">
            <p>
              Sua empresa ainda não possui uma conta?{' '}
              <Link
                to="/register"
                className="text-brand-400 hover:text-brand-300 font-semibold transition"
              >
                Criar organização
              </Link>
            </p>
            <div className="flex items-center justify-center gap-1.5 text-slate-500 text-[11px] pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Conexão criptografada de ponta a ponta</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

