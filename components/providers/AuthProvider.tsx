'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/lib/types';
import { Loader2, Phone, ShieldCheck, AlertCircle, Sprout, CheckCircle2, Zap } from 'lucide-react';

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { initialize, initialized, loading, user, profile, needsPhoneLinking, linkAuthUidToPhone, updateProfile } = useAuthStore();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [linkingError, setLinkingError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [showRoleUpgradeModal, setShowRoleUpgradeModal] = useState(false);
  const [targetRouteRole, setTargetRouteRole] = useState<UserRole | null>(null);

  // 1. Unconditionally initialize auth
  useEffect(() => {
    initialize();
  }, [initialize]);

  // 2. Redirect unauthenticated users away from private dashboard routes (except /dashboard/map which is public)
  useEffect(() => {
    if (initialized && !loading && !user && pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard/map')) {
      router.push('/login');
    }
  }, [initialized, loading, user, pathname, router]);

  // 3. Multi-role non-blocking access expansion logic
  useEffect(() => {
    if (initialized && !loading && user && profile && pathname.startsWith('/dashboard')) {
      const rawProf = profile.declared_profession || profile.role || 'farmer';
      const lower = rawProf.toLowerCase();
      let currentRole: UserRole = 'farmer';
      if (lower.includes('carrier') || lower.includes('logistics')) currentRole = 'carrier';
      else if (lower.includes('buyer') || lower.includes('enterprise buyer')) currentRole = 'buyer';
      else if (lower.includes('trader')) currentRole = 'trader';
      else if (lower === 'admin') currentRole = 'admin';
      else if (lower === 'enterprise') currentRole = 'enterprise';
      
      // Admin governance check (strict check only for /dashboard/admin)
      if (pathname.startsWith('/dashboard/admin') && currentRole !== 'admin' && currentRole !== 'enterprise') {
        setShowRoleUpgradeModal(true);
        setTargetRouteRole('admin');
        return;
      }
      
      // If user is enterprise or admin, they can browse anywhere freely
      if (currentRole === 'enterprise' || currentRole === 'admin') {
        setShowRoleUpgradeModal(false);
        return;
      }

      // Check if user is entering a route that matches a different role capability
      let neededRole: UserRole | null = null;
      if (pathname.startsWith('/dashboard/carrier') && currentRole !== 'carrier') neededRole = 'carrier';
      if (pathname.startsWith('/dashboard/buyer') && currentRole !== 'buyer') neededRole = 'buyer';

      if (neededRole) {
        setTargetRouteRole(neededRole);
        setShowRoleUpgradeModal(true);
      } else {
        setShowRoleUpgradeModal(false);
        setTargetRouteRole(null);
      }
    }
  }, [initialized, loading, user, profile, pathname]);

  // Handle phone linking submission
  const handleLinkPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) return;
    setLinkingError(null);
    setIsLinking(true);

    const result = await linkAuthUidToPhone(phoneNumber);
    if (result.error) {
      setLinkingError(result.error);
    }
    setIsLinking(false);
  };

  // Helper to get correct home portal for user's fixed role
  const getHomeRoute = () => {
    const currentRole = profile?.declared_profession || profile?.role || 'farmer';
    if (currentRole === 'carrier') return '/dashboard/carrier';
    if (currentRole === 'buyer') return '/dashboard/buyer';
    if (currentRole === 'admin' || currentRole === 'enterprise') return '/dashboard/admin';
    return '/dashboard/farmer';
  };

  // --- UNCONDITIONAL HOOKS END HERE ---
  // Now we safely render conditional screens without triggering React Error #310

  // Loading Screen
  if ((!initialized || loading) && pathname.startsWith('/dashboard')) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-2xl shadow-emerald-500/30 mb-4 animate-pulse">
          <Sprout size={32} className="text-white" />
        </div>
        <Loader2 size={28} className="animate-spin text-emerald-400 mb-2" />
        <p className="text-sm font-medium text-slate-300">Synchronizing YieldFlow Intelligence Portal...</p>
      </div>
    );
  }

  // Strict Route-Gating Screen (Blocks unauthorized role access per security policy)
  if (showRoleUpgradeModal && targetRouteRole) {
    const currentRole = profile?.declared_profession || profile?.role || 'farmer';
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white">
        <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-slate-900/95 p-8 text-center backdrop-blur-2xl shadow-2xl animate-fade-in">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/20 border border-rose-500/40 shadow-lg shadow-rose-500/20">
            <AlertCircle size={32} className="text-rose-400" />
          </div>
          <h2 className="text-xl font-black tracking-tight text-white mb-2">
            Access Restricted
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed font-light mb-6">
            Your account role is permanently fixed as <strong className="text-rose-300 uppercase">{currentRole}</strong>. You do not have permission to access the <strong className="text-white uppercase">{targetRouteRole}</strong> portal. If you require access to a different portal, please sign up for a separate account.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => {
                setShowRoleUpgradeModal(false);
                router.push(getHomeRoute());
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-400 active:scale-95 transition-all"
            >
              <span>Return to Designated Portal ({currentRole.toUpperCase()})</span>
            </button>

            <button
              onClick={() => {
                setShowRoleUpgradeModal(false);
                router.push('/login');
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              Sign Out & Register New Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {needsPhoneLinking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="max-w-md w-full rounded-2xl border border-emerald-500/30 bg-slate-900/95 p-6 animate-fade-in shadow-2xl text-white">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-md">
                <ShieldCheck size={24} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Connect Profile Phone Identity</h3>
                <p className="text-xs text-slate-400">E.164 Identity Normalization</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 mb-4 leading-relaxed font-light">
              Enter your registered mobile phone number (e.g., <code className="text-emerald-400">08024757252</code>) to synchronize your account session.
            </p>

            {linkingError && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{linkingError}</span>
              </div>
            )}

            <form onSubmit={handleLinkPhone} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">Registered Phone Number</label>
                <div className="relative mt-1">
                  <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="08024757252 or +234..."
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/10 bg-slate-800/80 pl-11 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLinking}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 transition-all"
              >
                {isLinking && <Loader2 size={16} className="animate-spin" />}
                <span>{isLinking ? 'Linking Profile...' : 'Connect & Unlock Portal'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {children}
    </>
  );
}
