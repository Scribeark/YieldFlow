'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/lib/types';
import { Sprout, Mail, Lock, User, Phone, ArrowRight, Loader2, Zap, Wheat, Truck, ShoppingCart } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp, updateProfile } = useAuthStore();

  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState<UserRole>('farmer');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      if (isSignUp) {
        if (!fullName.trim()) {
          setError('Please enter your full name.');
          setIsSubmitting(false);
          return;
        }
        const result = await signUp(email, password, fullName, phoneNumber, role);
        if (result.error) {
          setError(result.error);
          setIsSubmitting(false);
        } else {
          setSuccess('Account created! Redirecting to your portal...');
          setTimeout(() => {
            router.push('/dashboard/farmer');
          }, 600);
        }
      } else {
        const result = await signIn(email, password);
        if (result.error) {
          setError(result.error);
          setIsSubmitting(false);
        } else {
          setSuccess('Login successful! Launching YieldFlow workspace...');
          setTimeout(() => {
            const currentProfile = useAuthStore.getState().profile;
            const prof = currentProfile?.declared_profession || 'farmer';
            if (prof === 'carrier') router.push('/dashboard/carrier');
            else if (prof === 'buyer') router.push('/dashboard/buyer');
            else if (prof === 'admin') router.push('/dashboard/admin');
            else router.push('/dashboard/farmer');
          }, 600);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred during authentication.');
      setIsSubmitting(false);
    }
  };

  // Instant One-Click Demo Mode (So user never gets stuck testing)
  const handleInstantDemoLogin = async (demoRole: UserRole, targetUrl: string) => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(`Instant ${demoRole.toUpperCase()} Demo Mode activated! Launching...`);
    
    // Attempt standard test login, or synthetic instant state
    const { error: signInErr } = await signIn('test@yieldflow.com', 'password123');
    if (signInErr) {
      // If no account exists yet, sign up our instant demo account
      await signUp('test@yieldflow.com', 'password123', `Simulated ${demoRole.toUpperCase()} Account`, '08024757252', demoRole);
    } else {
      await updateProfile({ declared_profession: demoRole });
    }

    setTimeout(() => {
      router.push(targetUrl);
    }, 700);
  };

  const roles: { value: UserRole; label: string; description: string }[] = [
    { value: 'farmer', label: 'Farmer', description: 'Log IoT telemetry & trade offers' },
    { value: 'trader', label: 'Trader', description: 'Aggregate crops & trade' },
    { value: 'carrier', label: 'Carrier', description: '3PL vehicle & fleet dispatch' },
    { value: 'buyer', label: 'Enterprise Buyer', description: 'Order verified harvests' },
    { value: 'enterprise', label: 'All-Access Demo', description: 'Multi-role across all portals' },
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12">
      {/* Background Agricultural Imagery with Luminous Glass Overlay */}
      <div className="absolute inset-0 z-0 opacity-25">
        <img
          src="https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&w=2000&q=80"
          alt="Lush Farm Field Background"
          className="h-full w-full object-cover scale-105 animate-pulse duration-[12000ms]"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-950/85 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/40 via-transparent to-amber-950/30" />
      </div>

      {/* Glow Orbs */}
      <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-emerald-500/15 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 right-1/4 h-96 w-96 rounded-full bg-teal-500/15 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 p-0.5 shadow-2xl shadow-emerald-500/30">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950/40 backdrop-blur-md">
              <Sprout size={30} className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            {isSignUp ? 'Create YieldFlow Account' : 'Welcome back to YieldFlow'}
          </h1>
          <p className="text-xs font-light text-slate-300 mt-1">
            {isSignUp ? 'Register for real-time agricultural intelligence & trade' : 'Sign in to access your multi-role workspace'}
          </p>
        </div>

        {/* Quick Instant Demo Launchers (So testing NEVER gets blocked or errors out!) */}
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-4 backdrop-blur-xl shadow-lg">
          <div className="flex items-center gap-2 mb-2.5 text-emerald-300">
            <Zap size={16} className="text-emerald-400 animate-bounce" />
            <span className="text-xs font-bold uppercase tracking-wider">Instant 1-Click Test Access</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleInstantDemoLogin('farmer', '/dashboard/farmer')}
              type="button"
              className="flex flex-col items-center justify-center rounded-xl border border-emerald-500/30 bg-slate-900/80 hover:bg-emerald-500/20 p-2.5 text-center transition-all active:scale-95"
            >
              <Wheat size={18} className="text-amber-400 mb-1" />
              <span className="text-[11px] font-bold text-white">Farmer Portal</span>
            </button>
            <button
              onClick={() => handleInstantDemoLogin('carrier', '/dashboard/carrier')}
              type="button"
              className="flex flex-col items-center justify-center rounded-xl border border-blue-500/30 bg-slate-900/80 hover:bg-blue-500/20 p-2.5 text-center transition-all active:scale-95"
            >
              <Truck size={18} className="text-blue-400 mb-1" />
              <span className="text-[11px] font-bold text-white">Carrier Fleet</span>
            </button>
            <button
              onClick={() => handleInstantDemoLogin('buyer', '/dashboard/buyer')}
              type="button"
              className="flex flex-col items-center justify-center rounded-xl border border-teal-500/30 bg-slate-900/80 hover:bg-teal-500/20 p-2.5 text-center transition-all active:scale-95"
            >
              <ShoppingCart size={18} className="text-teal-400 mb-1" />
              <span className="text-[11px] font-bold text-white">Enterprise Buyer</span>
            </button>
          </div>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/85 p-6 backdrop-blur-2xl shadow-2xl">
          {error && (
            <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">Full Name</label>
                  <div className="relative mt-1">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Alhaji Musa / Chinedu Fleet"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required={isSignUp}
                      className="w-full rounded-xl border border-white/10 bg-slate-800/80 pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">Phone Number</label>
                  <div className="relative mt-1">
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      placeholder="08024757252"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required={isSignUp}
                      className="w-full rounded-xl border border-white/10 bg-slate-800/80 pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 block">Primary Role Selection</label>
                  <div className="grid grid-cols-2 gap-2">
                    {roles.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setRole(r.value)}
                        className={`rounded-xl border p-3 text-left transition-all ${
                          role === r.value
                            ? 'border-emerald-400 bg-emerald-500/20 text-white shadow-md'
                            : 'border-white/10 bg-slate-800/40 text-slate-400 hover:border-white/20 hover:text-white'
                        }`}
                      >
                        <p className="text-xs font-bold">{r.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">{r.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">Email Address</label>
              <div className="relative mt-1">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  placeholder="name@yieldflow.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-slate-800/80 pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">Password</label>
              <div className="relative mt-1">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-slate-800/80 pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <span>{isSignUp ? 'Create Account & Launch' : 'Sign In to Portal'}</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Toggle between Sign In and Sign Up */}
          <div className="mt-6 border-t border-white/10 pt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setSuccess(null);
              }}
              className="text-xs font-semibold text-slate-400 hover:text-emerald-400 transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign In here' : "Don't have an account? Register new account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
