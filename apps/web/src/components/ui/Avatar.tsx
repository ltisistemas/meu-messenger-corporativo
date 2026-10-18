import React from 'react';
import { Users } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface AvatarProps {
  name?: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'none';
  isGroup?: boolean;
  className?: string;
}

const GRADIENTS = [
  'from-indigo-500 to-purple-600',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-orange-500',
  'from-amber-500 to-pink-500',
  'from-violet-600 to-indigo-700',
];

function getGradient(name?: string): string {
  if (!name) return GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[index];
}

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = 'md',
  status = 'none',
  isGroup = false,
  className,
}) => {
  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm font-semibold',
    lg: 'w-12 h-12 text-base font-semibold',
    xl: 'w-16 h-16 text-xl font-bold',
  };

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
  };

  const statusDotSizes = {
    xs: 'w-1.5 h-1.5 ring-1',
    sm: 'w-2.5 h-2.5 ring-1.5',
    md: 'w-3 h-3 ring-2',
    lg: 'w-3.5 h-3.5 ring-2',
    xl: 'w-4 h-4 ring-2',
  };

  const gradient = getGradient(name);
  const initials = getInitials(name);

  return (
    <div className="relative inline-flex shrink-0">
      <div
        className={twMerge(
          clsx(
            'relative rounded-full flex items-center justify-center overflow-hidden select-none shadow-sm',
            sizeClasses[size],
            src
              ? 'bg-slate-200 dark:bg-slate-800'
              : isGroup
                ? 'bg-gradient-to-tr from-slate-700 to-slate-900 text-brand-400 border border-slate-700'
                : `bg-gradient-to-tr ${gradient} text-white`,
            className
          )
        )}
      >
        {src ? (
          <img src={src} alt={name || 'Avatar'} className="w-full h-full object-cover" />
        ) : isGroup ? (
          <Users className={iconSizes[size]} />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {status !== 'none' && !isGroup && (
        <span
          className={twMerge(
            clsx(
              'absolute bottom-0 right-0 rounded-full ring-white dark:ring-slate-950',
              statusDotSizes[size],
              status === 'online'
                ? 'bg-emerald-500 shadow-glowEmerald animate-pulseSlow'
                : 'bg-slate-400 dark:bg-slate-600'
            )
          )}
          title={status === 'online' ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
};
