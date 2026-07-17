'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/lib/types';
import {
  Wheat,
  Truck,
  ShieldCheck,
  BarChart3,
  X,
  Sprout,
  LogOut,
  ChevronRight,
  ShoppingCart,
  MapPin,
  Store,
  CheckCircle2,
} from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[]; // If empty or includes 'all', visible to everyone
  badge?: string;
}

const allNavItems: NavItem[] = [
  {
    label: 'Farmer & Trader Portal',
    href: '/dashboard/farmer',
    icon: <Wheat size={20} className="text-amber-400" />,
    roles: ['all'],
    badge: 'Harvest',
  },
  {
    label: 'Farm Inputs Shop',
    href: '/dashboard/inputs',
    icon: <Store size={20} className="text-emerald-400" />,
    roles: ['all'],
    badge: '0% Fee',
  },
  {
    label: 'Carrier Fleet Management',
    href: '/dashboard/carrier',
    icon: <Truck size={20} className="text-blue-400" />,
    roles: ['all'],
    badge: '3PL GPS',
  },
  {
    label: 'Buyer Marketplace',
    href: '/dashboard/buyer',
    icon: <ShoppingCart size={20} className="text-teal-400" />,
    roles: ['all'],
    badge: 'Off-Taker',
  },
  {
    label: 'Live Geospatial Map',
    href: '/dashboard/map',
    icon: <MapPin size={20} className="text-rose-400" />,
    roles: ['all'],
    badge: 'Live IoT',
  },
  {
    label: 'Admin Governance',
    href: '/dashboard/admin',
    icon: <ShieldCheck size={20} className="text-purple-400" />,
    roles: ['admin', 'enterprise'],
  },
  {
    label: 'BI Analytics Engine',
    href: '/dashboard/admin/analytics',
    icon: <BarChart3 size={20} className="text-indigo-400" />,
    roles: ['admin', 'enterprise'],
  },
];

export default function NavigationShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { profile, user, updateProfile, signOut } = useAuthStore();

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const rawProf = profile?.declared_profession || profile?.role || 'farmer';
  const lowerProf = rawProf.toLowerCase();
  let userRole: UserRole = 'farmer';
  if (lowerProf.includes('carrier') || lowerProf.includes('logistics')) userRole = 'carrier';
  else if (lowerProf.includes('buyer') || lowerProf.includes('enterprise buyer')) userRole = 'buyer';
  else if (lowerProf.includes('trader')) userRole = 'trader';
  else if (lowerProf === 'admin') userRole = 'admin';
  else if (lowerProf === 'enterprise') userRole = 'enterprise';

  // Filter items: show all core portals to every user; only restrict Admin/BI if user is not admin/enterprise
  const navItems = useMemo(() => {
    return allNavItems.filter((item) => {
      if (item.roles.includes('all')) return true;
      return item.roles.includes(userRole) || userRole === 'admin' || userRole === 'enterprise';
    });
  }, [userRole]);

  const isAuthPage = pathname === '/login' || pathname === '/';
  if (isAuthPage) return <>{children}</>;


  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-md lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Vibrant Glassmorphic Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col
          border-r border-white/10 bg-slate-900/90 backdrop-blur-2xl
          transition-transform duration-300 ease-in-out shadow-2xl
          lg:relative lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo — Clickable, navigates to home */}
        <Link
          href="/"
          className="flex h-20 items-center gap-3.5 border-b border-white/10 px-6 hover:bg-white/5 transition-colors group"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform">
            <Sprout size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1">
              YieldFlow <span className="text-emerald-400">Web</span>
            </h1>
            <p className="text-[11px] font-medium tracking-widest text-slate-400 uppercase">
              Agri-Data Hub v2
            </p>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              setSidebarOpen(false);
            }}
            className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={18} />
          </button>
        </Link>

        {/* Multi-Role Account Badge / Switcher Banner */}
        <div className="mx-4 mt-4 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/60 to-slate-900/80 p-3.5 backdrop-blur-md">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-400" /> Active Capability
            </span>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-300 border border-emerald-500/30">
              {userRole}
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-snug font-light">
            Multi-role active. You can browse and trade across all portals directly below.
          </p>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5">
          <div className="mb-2 px-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            Unified Core Portals
          </div>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  group flex items-center justify-between rounded-xl px-3.5 py-3 text-sm font-semibold transition-all duration-200
                  ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-white border border-emerald-500/40 shadow-lg shadow-emerald-950/50'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white border border-transparent'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <span className="transition-transform group-hover:scale-110">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.badge && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isActive ? 'bg-emerald-500/30 border-emerald-400/50 text-emerald-200' : 'bg-slate-800 border-white/10 text-slate-400'}`}>
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight
                    size={16}
                    className={`transition-transform duration-200 ${
                      isActive ? 'text-emerald-400 translate-x-0.5' : 'text-slate-600 group-hover:translate-x-1 group-hover:text-slate-400'
                    }`}
                  />
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Profile / Footer */}
        <div className="border-t border-white/10 bg-slate-950/60 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-black text-white shadow-md">
              {profile?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">
                {profile?.full_name || 'Agri User'}
              </p>
              <p className="truncate text-xs font-light text-slate-400">
                {user?.email || profile?.phone_number || 'Connected'}
              </p>
            </div>
            <button
              onClick={async () => {
                await signOut();
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('yieldflow_active_role');
                  window.location.href = '/login';
                }
              }}
              title="Sign Out"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30 transition-all"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden bg-slate-950">
        {/* Top Header Bar for Mobile + Global Title */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-slate-900/60 px-6 backdrop-blur-xl lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" x2="20" y1="12" y2="12" />
              <line x1="4" x2="20" y1="6" y2="6" />
              <line x1="4" x2="20" y1="18" y2="18" />
            </svg>
          </button>
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-400">
              <Sprout size={18} className="text-white" />
            </div>
            <span className="text-base font-black text-white">YieldFlow</span>
          </Link>
          <div className="w-8" /> {/* Placeholder for balance */}
        </header>

        {/* Dynamic Page Container with Global Utility Bar */}
        <main className="flex-1 overflow-y-auto bg-background transition-colors duration-300">
          {/* Universal Utility Bar across all pages */}
          <div className="sticky top-0 z-30 border-b border-border bg-background-secondary/80 backdrop-blur-xl px-4 py-3 sm:px-6 shadow-sm">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground-muted hidden sm:inline">
                  Real-time Agricultural Telemetry & Haulage Network
                </span>
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-agri-primary">
                  Capability: {userRole.toUpperCase()}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <ThemeToggle />
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
