import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import { LandingNavbar } from '../components/landing/LandingNavbar';
import { LandingHero } from '../components/landing/LandingHero';
import { LandingMetrics } from '../components/landing/LandingMetrics';
import { LandingComparison } from '../components/landing/LandingComparison';
import { LandingFeatures } from '../components/landing/LandingFeatures';
import { LandingPricing } from '../components/landing/LandingPricing';
import { LandingLgpdTrust } from '../components/landing/LandingLgpdTrust';
import { LandingFaq } from '../components/landing/LandingFaq';
import { LandingFooter } from '../components/landing/LandingFooter';

export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    document.title = 'NextMsg — Mensagens Corporativas com Foco e Privacidade Radical';
  }, []);

  // Redirect active sessions directly to the operational chat application
  if (isAuthenticated) {
    return <Navigate to="/chat" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-300">
      <LandingNavbar />
      <main className="flex-1">
        <LandingHero />
        <LandingMetrics />
        <LandingComparison />
        <LandingFeatures />
        <LandingPricing />
        <LandingLgpdTrust />
        <LandingFaq />
      </main>
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
