import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from '../hooks/use-navigate';
import {
  MessageSquare,
  UserCheck,
  Lock,
  User,
  Building,
  AlertCircle,
  Loader2,
  Clock,
} from 'lucide-react';
import { api, ApiError } from '../services/api';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useAuthStore } from '../stores/auth.store';

interface InvitationDetails {
  id: string;
  email: string;
  role: 'admin' | 'member';
  status: 'pending' | 'accepted' | 'expired' | 'canceled';
  expiresAt: string;
  account: {
    id: string;
    name: string;
    plan: string;
  };
}

export const AcceptInvitePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { acceptInvite, isLoading: isSubmitting, error: authError, clearError } = useAuthStore();

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [isLoadingInvite, setIsLoadingInvite] = useState(true);
  const [inviteFetchError, setInviteFetchError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setInviteFetchError('Token de convite não informado.');
      setIsLoadingInvite(false);
      return;
    }

    let isMounted = true;
    clearError();

    api
      .get<InvitationDetails>(`/invitations/${token}`)
      .then((data) => {
        if (isMounted) {
          setInvitation(data);
          setIsLoadingInvite(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          const msg =
            err instanceof ApiError ? err.message : 'Convite inválido, expirado ou já utilizado.';
          setInviteFetchError(msg);
          setIsLoadingInvite(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    clearError();

    if (!name.trim() || !password.trim()) {
      setValidationError('Preencha seu nome e defina sua senha de acesso.');
      return;
    }

    if (password.length < 8) {
      setValidationError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('As senhas digitadas não coincidem.');
      return;
    }

    if (!token) return;

    try {
      await acceptInvite({
        token,
        name: name.trim(),
        password,
      });
      navigate('/');
    } catch {
      // Store error handles display
    }
  };

  const displayError = validationError || authError;

  if (isLoadingInvite) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 text-white font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-slate-400 text-sm">Carregando dados do convite corporativo...</p>
        </div>
      </div>
    );
  }

  if (inviteFetchError || !invitation) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 text-white font-sans">
        <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold">Convite Indisponível</h2>
            <p className="text-sm text-slate-400">
              {inviteFetchError || 'Este convite expirou, foi cancelado ou não existe.'}
            </p>
          </div>
          <Link to="/login">
            <Button variant="outline" className="w-full">
              Ir para o Login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden font-sans">
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 shadow-glow mb-2">
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Você foi convidado!</h1>
          <p className="text-slate-400 text-sm">
            Junte-se à equipe no NextMsg para trocar mensagens com segurança.
          </p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Inviting Org Summary Card */}
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-brand-400 shrink-0" />
                <span className="text-sm font-bold text-white">{invitation.account.name}</span>
              </div>
              <Badge variant="brand" size="sm">
                {invitation.role === 'admin' ? 'Administrador' : 'Membro'}
              </Badge>
            </div>

            <p className="text-xs text-slate-400">
              Convite para o e-mail: <strong className="text-slate-200">{invitation.email}</strong>
            </p>

            <div className="flex items-center gap-1 text-[11px] text-slate-500 pt-1 border-t border-slate-700/40">
              <Clock className="w-3 h-3" />
              <span>
                Expira em:{' '}
                {new Date(invitation.expiresAt).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>

          {displayError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-400 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Seu Nome Completo"
              placeholder="Ex: Beatriz Lima"
              leftIcon={<User className="w-4 h-4 text-slate-400" />}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              required
            />

            <Input
              label="Crie sua Senha (mín. 8 dígitos)"
              type="password"
              placeholder="••••••••"
              leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              autoComplete="new-password"
              required
            />

            <Input
              label="Confirme sua Senha"
              type="password"
              placeholder="••••••••"
              leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSubmitting}
              autoComplete="new-password"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isSubmitting}
              rightIcon={<UserCheck className="w-4 h-4" />}
            >
              Concluir Cadastro e Acessar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

