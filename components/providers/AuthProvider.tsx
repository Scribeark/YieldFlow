'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Loader2, Phone, ShieldCheck, AlertCircle } from 'lucide-react';

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { initialize, initialized, loading, user, needsPhoneLinking, linkAuthUidToPhone, signOut } = useAuthStore();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [linkingError, setLinkingError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (initialized && !loading && !user && pathname.startsWith('/dashboard')) {
      router.push('/login');
    }
  }, [initialized, loading, user, pathname, router]);

  // Don't block /login or public pages while background initializing
  if ((!initialized || loading) && pathname.startsWith('/dashboard')) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2
            size={32}
            className="mx-auto mb-3 animate-spin text-agri-primary"
          />
          <p className="text-sm text-foreground-muted">Loading your portal...</p>
        </div>
      </div>
    );
  }

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

  return (
    <>
      {needsPhoneLinking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="card max-w-md w-full p-6 animate-fade-in shadow-2xl border border-agri-primary/30">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-agri-primary/10 text-agri-primary-light">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Link Account Identity</h3>
                <p className="text-xs text-foreground-dim">Profile Gate Verification</p>
              </div>
            </div>

            <p className="text-sm text-foreground-muted mb-4 leading-relaxed">
              We detected an existing account session that hasn&apos;t been linked to your phone identity yet. Enter your registered mobile number below to connect your profile.
            </p>

            {linkingError && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{linkingError}</span>
              </div>
            )}

            <form onSubmit={handleLinkPhone} className="space-y-4">
              <div>
                <label className="label">Registered Phone Number</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-dim" />
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. 08024757252 or +2348036386934"
                    className="input pl-10"
                    required
                  />
                </div>
                <span className="text-[11px] text-foreground-dim mt-1 block">
                  Supports both local (080...) and E.164 (+234...) formats.
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="btn btn-secondary flex-1 text-sm"
                  disabled={isLinking}
                >
                  Sign Out
                </button>
                <button
                  type="submit"
                  disabled={isLinking || !phoneNumber.trim()}
                  className="btn btn-primary flex-1 text-sm"
                >
                  {isLinking ? <Loader2 size={16} className="animate-spin" /> : 'Link & Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
