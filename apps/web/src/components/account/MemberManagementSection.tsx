import React, { useState } from 'react';
import { Search, UserCheck, UserX, Shield, ShieldCheck, User, UserPlus, AlertCircle } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { MemberItemResponse, UserRole } from '@corpchat/shared';

export interface MemberManagementSectionProps {
  members: MemberItemResponse[];
  currentUserRole?: UserRole;
  currentUserId?: string;
  isOverQuota?: boolean;
  onUpdateStatus: (userId: string, status: 'active' | 'inactive') => Promise<void>;
  onUpdateRole: (userId: string, role: 'admin' | 'member') => Promise<void>;
  onOpenInviteModal: () => void;
}

export const MemberManagementSection: React.FC<MemberManagementSectionProps> = ({
  members,
  currentUserRole = 'member',
  currentUserId,
  isOverQuota,
  onUpdateStatus,
  onUpdateRole,
  onOpenInviteModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin';
  const isOwner = currentUserRole === 'owner';

  const filteredMembers = members.filter((m) => {
    const term = searchTerm.toLowerCase().trim();
    return (
      m.name.toLowerCase().includes(term) ||
      m.email.toLowerCase().includes(term) ||
      m.role.toLowerCase().includes(term)
    );
  });

  const handleToggleStatus = async (member: MemberItemResponse) => {
    try {
      setActionError(null);
      setLoadingUserId(member.id);
      const newStatus = member.status === 'active' ? 'inactive' : 'active';
      await onUpdateStatus(member.id, newStatus);
    } catch (err: any) {
      setActionError(err.message || 'Erro ao alterar status do membro');
    } finally {
      setLoadingUserId(null);
    }
  };

  const handleToggleRole = async (member: MemberItemResponse) => {
    try {
      setActionError(null);
      setLoadingUserId(member.id);
      const newRole = member.role === 'admin' ? 'member' : 'admin';
      await onUpdateRole(member.id, newRole);
    } catch (err: any) {
      setActionError(err.message || 'Erro ao alterar papel do membro');
    } finally {
      setLoadingUserId(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Membros da Equipe</span>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full text-slate-600 dark:text-slate-300 font-medium">
              {members.length}
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Gerencie o acesso, cargos e status ativo dos colaboradores.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Buscar por nome ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          {canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenInviteModal}
              className="shrink-0 text-xs"
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              Convidar
            </Button>
          )}
        </div>
      </div>

      {isOverQuota && (
        <div className="mb-4 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
          <span>
            <strong>Limite de membros excedido:</strong> Sua organização possui mais membros ativos do que o limite do plano. Desative membros sobressalentes ou faça upgrade do plano.
          </span>
        </div>
      )}

      {actionError && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Members List */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <th className="pb-3 pl-2">Membro</th>
              <th className="pb-3">Cargo</th>
              <th className="pb-3">Status</th>
              {canManage && <th className="pb-3 pr-2 text-right">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                  Nenhum membro encontrado.
                </td>
              </tr>
            ) : (
              filteredMembers.map((member) => {
                const isSelf = member.id === currentUserId;
                const isMemberOwner = member.role === 'owner';
                const isMemberAdmin = member.role === 'admin';
                const isActive = member.status === 'active';
                const isLoading = loadingUserId === member.id;

                return (
                  <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    {/* User Info */}
                    <td className="py-3.5 pl-2">
                      <div className="flex items-center gap-3">
                        <Avatar name={member.name} size="sm" />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span>{member.name}</span>
                            {isSelf && (
                              <span className="text-[10px] bg-brand-500/10 text-brand-600 dark:text-brand-400 px-1.5 py-0.2 rounded font-medium">
                                Você
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">{member.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3.5">
                      {isMemberOwner ? (
                        <Badge variant="amber" className="text-[11px] font-medium flex items-center gap-1 w-fit">
                          <ShieldCheck className="w-3 h-3 text-amber-500" /> Proprietário
                        </Badge>
                      ) : isMemberAdmin ? (
                        <Badge variant="brand" className="text-[11px] font-medium flex items-center gap-1 w-fit">
                          <Shield className="w-3 h-3 text-brand-500" /> Admin
                        </Badge>
                      ) : (
                        <Badge variant="neutral" className="text-[11px] font-medium flex items-center gap-1 w-fit">
                          <User className="w-3 h-3 text-slate-400" /> Membro
                        </Badge>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5">
                      <Badge
                        variant={isActive ? 'emerald' : 'rose'}
                        className="text-[11px] font-medium w-fit"
                      >
                        {isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>

                    {/* Actions */}
                    {canManage && (
                      <td className="py-3.5 pr-2 text-right">
                        {!isMemberOwner && (
                          <div className="flex items-center justify-end gap-2">
                            {/* Toggle Role (Admin vs Member - Only Owner can do this) */}
                            {isOwner && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleRole(member)}
                                disabled={isLoading}
                                className="text-xs py-1 px-2 h-7"
                                title={isMemberAdmin ? 'Rebaixar para Membro' : 'Promover a Administrador'}
                              >
                                {isMemberAdmin ? 'Tornar Membro' : 'Tornar Admin'}
                              </Button>
                            )}

                            {/* Toggle Status (Active vs Inactive) */}
                            <Button
                              variant={isActive ? 'danger' : 'outline'}
                              size="sm"
                              onClick={() => handleToggleStatus(member)}
                              disabled={isLoading}
                              className={`text-xs py-1 px-2.5 h-7 flex items-center gap-1 ${
                                !isActive ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10' : ''
                              }`}
                            >
                              {isActive ? (
                                <>
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>Desativar</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>Ativar</span>
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
