import React from 'react';
import { SidebarNav, NavItemKey } from './SidebarNav';

export interface AppLayoutProps {
  activeTab: NavItemKey;
  onSelectTab: (tab: NavItemKey) => void;
  sidebarContent: React.ReactNode;
  mainContent: React.ReactNode;
  isChatOpenOnMobile?: boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  activeTab,
  onSelectTab,
  sidebarContent,
  mainContent,
  isChatOpenOnMobile = false,
}) => {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* 1. Primary Left Navigation Bar */}
      <SidebarNav activeTab={activeTab} onSelectTab={onSelectTab} />

      {/* 2. Secondary Sidebar: Conversation / Module List */}
      <aside
        className={`w-full md:w-80 lg:w-96 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 z-10 ${
          isChatOpenOnMobile ? 'hidden md:flex' : 'flex'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* 3. Main Content Area / Active Conversation Chat */}
      <main
        className={`flex-1 flex flex-col h-full bg-slate-50/50 dark:bg-slate-950/50 overflow-hidden ${
          !isChatOpenOnMobile ? 'hidden md:flex' : 'flex'
        }`}
      >
        {mainContent}
      </main>
    </div>
  );
};
