import React from 'react';
import {
  ExternalLink,
  HardDrive,
  Cloud,
  Folder,
  FileText,
  FileSpreadsheet,
  FileArchive,
  Image as ImageIcon,
  Layers,
  BookOpen,
  Presentation,
  ShieldCheck,
} from 'lucide-react';
import { CloudLinkPreview, CloudResourceType } from '@corpchat/shared';

export interface CloudLinkCardProps {
  link: CloudLinkPreview;
  isSelf?: boolean;
}

export const CloudLinkCard: React.FC<CloudLinkCardProps> = ({ link, isSelf = false }) => {
  // Provider-specific theme styles
  const getProviderConfig = () => {
    switch (link.provider) {
      case 'google-drive':
        return {
          name: 'Google Drive',
          accentColor: 'text-amber-500 dark:text-amber-400',
          badgeBg: isSelf
            ? 'bg-amber-400/20 text-amber-200 border-amber-300/30'
            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
          cardBg: isSelf
            ? 'bg-brand-700/70 border-brand-400/40 hover:border-amber-300/60'
            : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/80 hover:border-amber-400/60 dark:hover:border-amber-500/60',
          buttonText: 'Abrir no Google Drive',
          buttonBg: isSelf
            ? 'bg-white/15 hover:bg-white/25 text-white'
            : 'bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-600',
          icon: <HardDrive className="w-4 h-4 text-amber-400" />,
        };
      case 'onedrive':
        return {
          name: link.domain.includes('sharepoint') ? 'SharePoint / OneDrive' : 'Microsoft OneDrive',
          accentColor: 'text-sky-500 dark:text-sky-400',
          badgeBg: isSelf
            ? 'bg-sky-400/20 text-sky-200 border-sky-300/30'
            : 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60',
          cardBg: isSelf
            ? 'bg-brand-700/70 border-brand-400/40 hover:border-sky-300/60'
            : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/80 hover:border-sky-400/60 dark:hover:border-sky-500/60',
          buttonText: 'Abrir no OneDrive',
          buttonBg: isSelf
            ? 'bg-white/15 hover:bg-white/25 text-white'
            : 'bg-sky-600 hover:bg-sky-700 text-white dark:bg-sky-500 dark:hover:bg-sky-600',
          icon: <Cloud className="w-4 h-4 text-sky-400" />,
        };
      case 'dropbox':
        return {
          name: 'Dropbox',
          accentColor: 'text-blue-500 dark:text-blue-400',
          badgeBg: isSelf
            ? 'bg-blue-400/20 text-blue-200 border-blue-300/30'
            : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
          cardBg: isSelf
            ? 'bg-brand-700/70 border-brand-400/40 hover:border-blue-300/60'
            : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/80 hover:border-blue-400/60 dark:hover:border-blue-500/60',
          buttonText: 'Abrir no Dropbox',
          buttonBg: isSelf
            ? 'bg-white/15 hover:bg-white/25 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600',
          icon: <Cloud className="w-4 h-4 text-blue-400" />,
        };
      case 'box':
        return {
          name: 'Box',
          accentColor: 'text-indigo-500 dark:text-indigo-400',
          badgeBg: isSelf
            ? 'bg-indigo-400/20 text-indigo-200 border-indigo-300/30'
            : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60',
          cardBg: isSelf
            ? 'bg-brand-700/70 border-brand-400/40 hover:border-indigo-300/60'
            : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/80 hover:border-indigo-400/60',
          buttonText: 'Abrir no Box',
          buttonBg: isSelf
            ? 'bg-white/15 hover:bg-white/25 text-white'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white',
          icon: <Cloud className="w-4 h-4 text-indigo-400" />,
        };
      case 'figma':
        return {
          name: 'Figma',
          accentColor: 'text-purple-500 dark:text-purple-400',
          badgeBg: isSelf
            ? 'bg-purple-400/20 text-purple-200 border-purple-300/30'
            : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60',
          cardBg: isSelf
            ? 'bg-brand-700/70 border-brand-400/40 hover:border-purple-300/60'
            : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/80 hover:border-purple-400/60',
          buttonText: 'Visualizar no Figma',
          buttonBg: isSelf
            ? 'bg-white/15 hover:bg-white/25 text-white'
            : 'bg-purple-600 hover:bg-purple-700 text-white',
          icon: <Layers className="w-4 h-4 text-purple-400" />,
        };
      case 'notion':
        return {
          name: 'Notion',
          accentColor: 'text-neutral-500 dark:text-neutral-300',
          badgeBg: isSelf
            ? 'bg-neutral-400/20 text-neutral-200 border-neutral-300/30'
            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700',
          cardBg: isSelf
            ? 'bg-brand-700/70 border-brand-400/40 hover:border-neutral-300/60'
            : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/80 hover:border-neutral-400/60',
          buttonText: 'Abrir no Notion',
          buttonBg: isSelf
            ? 'bg-white/15 hover:bg-white/25 text-white'
            : 'bg-neutral-800 hover:bg-neutral-900 text-white dark:bg-neutral-700 dark:hover:bg-neutral-600',
          icon: <BookOpen className="w-4 h-4 text-neutral-400" />,
        };
      default:
        return {
          name: link.providerName || 'Link Externo',
          accentColor: 'text-brand-500 dark:text-brand-400',
          badgeBg: isSelf
            ? 'bg-brand-400/20 text-brand-200 border-brand-300/30'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
          cardBg: isSelf
            ? 'bg-brand-700/70 border-brand-400/40 hover:border-brand-300/60'
            : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/80 hover:border-brand-400/60',
          buttonText: 'Acessar Link',
          buttonBg: isSelf
            ? 'bg-white/15 hover:bg-white/25 text-white'
            : 'bg-brand-600 hover:bg-brand-700 text-white',
          icon: <ExternalLink className="w-4 h-4 text-brand-400" />,
        };
    }
  };

  const getResourceIcon = (resourceType: CloudResourceType) => {
    switch (resourceType) {
      case 'spreadsheet':
        return <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />;
      case 'document':
      case 'pdf':
        return <FileText className="w-4 h-4 text-blue-500 shrink-0" />;
      case 'presentation':
        return <Presentation className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'folder':
        return <Folder className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'archive':
        return <FileArchive className="w-4 h-4 text-purple-500 shrink-0" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-rose-500 shrink-0" />;
      case 'design':
        return <Layers className="w-4 h-4 text-purple-500 shrink-0" />;
      case 'page':
        return <BookOpen className="w-4 h-4 text-slate-500 shrink-0" />;
      default:
        return <FileText className="w-4 h-4 text-brand-500 shrink-0" />;
    }
  };

  const config = getProviderConfig();

  return (
    <div
      data-testid="cloud-link-card"
      className={`my-2 p-3 rounded-2xl border shadow-sm transition-all duration-200 flex flex-col gap-2.5 ${config.cardBg}`}
    >
      {/* Top row: Provider branding + Resource type badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="p-1 rounded-lg bg-black/5 dark:bg-white/10 shrink-0">{config.icon}</div>
          <span className={`text-xs font-semibold tracking-tight truncate ${config.accentColor}`}>
            {config.name}
          </span>
        </div>

        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${config.badgeBg}`}
        >
          {link.resourceTypeLabel}
        </span>
      </div>

      {/* Center row: File / item title and resource icon */}
      <div className="flex items-start gap-2 min-w-0">
        <div className="mt-0.5 shrink-0">{getResourceIcon(link.resourceType)}</div>
        <div className="min-w-0 flex-1">
          <h4
            className={`text-xs font-bold leading-tight break-words line-clamp-2 ${
              isSelf ? 'text-white' : 'text-slate-900 dark:text-slate-100'
            }`}
            title={link.title}
          >
            {link.title}
          </h4>
          <p
            className={`text-[11px] truncate mt-0.5 ${
              isSelf ? 'text-brand-200/90' : 'text-slate-500 dark:text-slate-400'
            }`}
            title={link.url}
          >
            {link.displayUrl}
          </p>
        </div>
      </div>

      {/* Footer row: Security notice + Open Action CTA */}
      <div
        className={`pt-2 border-t flex flex-wrap items-center justify-between gap-2 ${
          isSelf ? 'border-brand-500/30' : 'border-slate-100 dark:border-slate-700/60'
        }`}
      >
        <div
          className={`flex items-center gap-1 text-[10px] ${
            isSelf ? 'text-cyan-200/90' : 'text-slate-500 dark:text-slate-400'
          }`}
          title="Arquivo armazenado no provedor em nuvem, sem retenção no servidor NextMsg"
        >
          <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
          <span>Zero retenção • Link externo</span>
        </div>

        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition shadow-sm shrink-0 ${config.buttonBg}`}
          aria-label={`${config.buttonText}: ${link.title}`}
        >
          <span>{config.buttonText}</span>
          <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      </div>
    </div>
  );
};
