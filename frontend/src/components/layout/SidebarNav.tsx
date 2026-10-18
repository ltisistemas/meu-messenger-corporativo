import React from 'react';
import {
  MessageSquare,
  Users,
  Radio,
  BarChart2,
  FileSignature,
  Settings,
  Sun,
  Moon,
} from 'lucide-react';
import { useThemeStore } from '../../stores/theme.store';
import { Avatar } from '../ui/Avatar';

export type NavItemKey = 'chats' | 'contacts' | 'broadcast' | 'polls' | 'signature' | 'settings';

export interface SidebarNavProps {
  activeTab: NavItemKey;
  onSelectTab: (tab: NavItemKey) => void;
  user?: {
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  onSelectTab,
  user = { name: 'Luiz Admin', email: 'admin@empresa.com' },
}) => {
  const { isDark, toggleTheme } = useThemeStore();

  const navItems = [
    { key: 'chats' as NavItemKey, label: 'Conversas', icon: MessageSquare, badge: 3 },
    { key: 'contacts' as NavItemKey, label: 'Contatos', icon: Users },
    { key: 'broadcast' as NavItemKey, label: 'Transmissão', icon: Radio },
    { key: 'polls' as NavItemKey, label: 'Enquetes', icon: BarChart2 },
    { key: 'signature' as NavItemKey, label: 'Assinatura', icon: FileSignature },
    { key: 'settings' as NavItemKey, label: 'Configurações', icon: Settings },
  ];

  return (
    <aside className="w-16 sm:w-20 bg-slate-900 border-r border-slate-800 flex flex-col items-center justify-between py-5 select-none shrink-0 z-20">
      {/* Brand Logo */}
      <div className="flex flex-col items-center gap-6">
        <div
          onClick={() => onSelectTab('chats')}
          className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-glow cursor-pointer hover:scale-105 transition-transform"
          title="NextMsg"
        >
          <MessageSquare className="w-6 h-6 text-white" />
        </div>

        {/* Nav Items */}
        <nav className="flex flex-col items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;

            return (
              <button
                key={item.key}
                onClick={() => onSelectTab(item.key)}
                className={`relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-150 group ${
                  isActive
                    ? 'bg-brand-500/20 text-brand-400 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
                title={item.label}
              >
                {isActive && (
                  <span className="absolute -left-2.5 sm:-left-3.5 w-1.5 h-6 bg-brand-500 rounded-r-full" />
                )}
                <Icon className="w-5 h-5" />

                {item.badge && item.badge > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-500 shadow-glow" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Actions: Theme Toggle & Profile Avatar */}
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={toggleTheme}
          className="w-10 h-10 rounded-xl text-slate-400 hover:text-amber-300 dark:hover:text-amber-400 hover:bg-slate-800/60 flex items-center justify-center transition"
          title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          aria-label="Alternar tema"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <div className="cursor-pointer hover:opacity-90 transition" title={user.name}>
          <Avatar name={user.name} src={user.avatarUrl} size="sm" status="online" />
        </div>
      </div>
    </aside>
  );
};
