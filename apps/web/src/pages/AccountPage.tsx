import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Crown, FileText, ArrowLeft, Building2, ShieldCheck } from 'lucide-react';
import { useAccountStore } from '../stores/account.store';
import { useAuthStore } from '../stores/auth.store';
import { QuotaWarningBanner } from '../components/account/QuotaWarningBanner';
import { AccountOverviewCard } from '../components/account/AccountOverviewCard';
import { MemberManagementSection } from '../components/account/MemberManagementSection';
import { PlansComparisonSection } from '../components/account/PlansComparisonSection';
import { InvoicesHistorySection } from '../components/account/InvoicesHistorySection';
import { LgpdPrivacySection } from '../components/account/LgpdPrivacySection';
import { UpgradeCheckoutModal } from '../components/account/UpgradeCheckoutModal';
import { InviteMemberModal } from '../components/account/InviteMemberModal';
import { Button } from '../components/ui/Button';

export const AccountPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    accountDetails,
    members,
    billingSummary,
    isLoading,
    isSubscribing,
    checkoutResult,
    fetchAccountDetails,
    fetchMembers,
    fetchBillingSummary,
    updateMemberStatus,
    updateMemberRole,
    inviteMember,
    subscribePlan,
    cancelSubscription,
    downgradePlan,
    clearCheckoutResult,
  } = useAccountStore();

  const [activeTab, setActiveTab] = useState<'members' | 'plans' | 'invoices' | 'privacy'>('members');
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState<'pro' | 'enterprise'>('pro');
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    fetchAccountDetails();
    fetchMembers();
    fetchBillingSummary();
  }, [fetchAccountDetails, fetchMembers, fetchBillingSummary]);

  const handleOpenUpgrade = (plan: 'pro' | 'enterprise', cycle: 'monthly' | 'yearly') => {
    setSelectedUpgradePlan(plan);
    setSelectedBillingCycle(cycle);
    clearCheckoutResult();
    setIsUpgradeModalOpen(true);
  };

  const handleDowngradeToFree = async () => {
    if (window.confirm('Tem certeza que deseja mudar para o plano Free? Recursos como armazenamento store-and-forward, transmissão e enquetes serão desabilitados.')) {
      await downgradePlan('free');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* 1. Global Quota Warning Banner */}
      <QuotaWarningBanner
        status={accountDetails?.status}
        isOverQuota={accountDetails?.isOverQuota}
        excessUsersCount={accountDetails?.excessUsersCount}
        maxUsers={accountDetails?.maxUsers}
        activeUsersCount={accountDetails?.activeUsersCount}
        planName={accountDetails?.plan.toUpperCase()}
        isTrialing={accountDetails?.isTrialing}
        trialDaysRemaining={accountDetails?.trialDaysRemaining}
        onUpgradeClick={() => {
          setActiveTab('plans');
          handleOpenUpgrade('pro', 'monthly');
        }}
        onManageMembersClick={() => setActiveTab('members')}
      />

      {/* 2. Top Header Navigation */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 backdrop-blur sticky top-0 z-30 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
              className="text-xs flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Chat</span>
            </Button>
            <div className="h-5 w-px bg-slate-200 dark:border-slate-700 hidden sm:block" />
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-brand-500" />
              <span>Painel da Organização</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden md:inline">
              Conectado como <strong>{user?.name}</strong> ({user?.role})
            </span>
          </div>
        </div>
      </header>

      {/* 3. Main Dashboard Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 space-y-6">
        {/* Account Overview Card */}
        <AccountOverviewCard
          account={accountDetails}
          onUpgradeClick={() => {
            setActiveTab('plans');
            handleOpenUpgrade('pro', 'monthly');
          }}
          onInviteClick={() => setIsInviteModalOpen(true)}
        />

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 gap-2 sm:gap-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`pb-3 px-1 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'members'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Membros da Equipe ({members.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('plans')}
            className={`pb-3 px-1 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'plans'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Crown className="w-4 h-4 text-amber-500" />
            <span>Comparativo de Planos & Upgrade</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            className={`pb-3 px-1 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'invoices'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Faturas & Assinatura</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`pb-3 px-1 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'privacy'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Privacidade & LGPD</span>
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === 'members' && (
          <MemberManagementSection
            members={members}
            currentUserRole={user?.role}
            currentUserId={user?.id}
            isOverQuota={accountDetails?.isOverQuota}
            onUpdateStatus={updateMemberStatus}
            onUpdateRole={updateMemberRole}
            onOpenInviteModal={() => setIsInviteModalOpen(true)}
          />
        )}

        {activeTab === 'plans' && (
          <PlansComparisonSection
            currentPlan={accountDetails?.plan}
            onSelectUpgrade={handleOpenUpgrade}
            onDowngradeToFree={handleDowngradeToFree}
          />
        )}

        {activeTab === 'invoices' && (
          <InvoicesHistorySection
            billingSummary={billingSummary}
            onCancelSubscription={cancelSubscription}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'privacy' && (
          <LgpdPrivacySection
            userRole={user?.role}
            userEmail={user?.email}
          />
        )}
      </main>

      {/* 4. Modals */}
      <UpgradeCheckoutModal
        isOpen={isUpgradeModalOpen}
        onClose={() => {
          setIsUpgradeModalOpen(false);
          clearCheckoutResult();
        }}
        targetPlan={selectedUpgradePlan}
        billingCycle={selectedBillingCycle}
        onSubmitCheckout={subscribePlan}
        checkoutResult={checkoutResult}
        isLoading={isSubscribing}
      />

      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onInvite={inviteMember}
      />
    </div>
  );
};
