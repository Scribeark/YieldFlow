'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/lib/types';
import { Sprout, Mail, Lock, User, Phone, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp } = useAuthStore();

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
          const prof = role || 'farmer';
          setTimeout(() => {
            router.push(`/dashboard/${prof === 'admin' || prof === 'buyer' || prof === 'carrier' ? prof : 'farmer'}`);
          }, 800);
        }
      } else {
        const result = await signIn(email, password);
        if (result.error) {
          setError(result.error);
          setIsSubmitting(false);
        } else {
          setSuccess('Login successful! Redirecting to dashboard...');
          const profile = useAuthStore.getState().profile;
          let targetRoute = '/dashboard/farmer';
          if (profile) {
            const prof = profile.declared_profession || 'farmer';
            if (prof === 'buyer') targetRoute = '/dashboard/buyer';
            else if (prof === 'carrier') targetRoute = '/dashboard/carrier';
            else if (prof === 'admin') targetRoute = '/dashboard/admin';
          }
          setTimeout(() => {
            router.push(targetRoute);
          }, 500);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
      setIsSubmitting(false);
    }
  };

  const roles: { value: UserRole; label: string; description: string }[] = [
    { value: 'farmer', label: 'Farmer', description: 'Log IoT & trade offers' },
    { value: 'trader', label: 'Trader', description: 'Aggregate crops & trade' },
    { value: 'carrier', label: 'Carrier', description: 'Vehicle & fleet logistics' },
    { value: 'buyer', label: 'Buyer', description: 'Order verified harvests' },
    { value: 'admin', label: 'Admin', description: 'Governance & BI Analytics' },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="gradient-mesh" />

      <div className="w-full max-w-md animate-scale-in">
        {/* Logo */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-agri-primary to-agri-primary-light shadow-lg shadow-agri-primary/20">
            <Sprout size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isSignUp ? 'Create Account' : 'Welcome to YieldFlow'}
          </h1>
          <p className="mt-1 text-xs text-foreground-muted">
            {isSignUp
              ? 'Join the Agri-Data Hub / YieldFlow ecosystem'
              : 'Sign in to your Agro-Data Hub account'}
          </p>
        </div>

        {/* Form Card */}
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error / Success Messages */}
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-lg border border-agri-primary/20 bg-agri-primary/10 px-4 py-3 text-sm text-agri-primary-light">
                {success}
              </div>
            )}

            {/* Sign Up Fields */}
            {isSignUp && (
              <>
                <div>
                  <label htmlFor="fullName" className="label">
                    Full Name
                  </label>
                  <div className="relative">
                    <User
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-dim"
                    />
                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Eniola Mabinuori"
                      className="input pl-10"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="phoneNumber" className="label">
                    Phone Number (E.164 or Local)
                  </label>
                  <div className="relative">
                    <Phone
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-dim"
                    />
                    <input
                      id="phoneNumber"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="e.g. 08024757252 or +2348036386934"
                      className="input pl-10"
                      required
                    />
                  </div>
                </div>

                {/* Role Selection */}
                <div>
                  <label className="label">Select Your Role</label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {roles.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setRole(r.value)}
                        className={`
                          rounded-lg border p-2.5 text-center transition-all duration-200
                          ${
                            role === r.value
                              ? 'border-agri-primary bg-agri-primary/10 text-agri-primary-light'
                              : 'border-border bg-background-secondary text-foreground-muted hover:border-border-hover'
                          }
                        `}
                      >
                        <div className="text-xs font-semibold">{r.label}</div>
                        <div className="mt-0.5 text-[10px] opacity-70 truncate">
                          {r.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="label">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-dim"
                />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input pl-10"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-dim"
                />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-10"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary w-full"
            >
              {isSubmitting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {isSignUp ? 'Create YieldFlow Account' : 'Sign In'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Toggle Auth Mode */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setSuccess(null);
              }}
              className="text-xs text-foreground-muted transition-colors hover:text-agri-primary-light"
            >
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
