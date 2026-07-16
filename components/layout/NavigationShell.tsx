'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/lib/types';
import {
  LayoutDashboard,
  Wheat,
  Truck,
  ShieldCheck,
  BarChart3,
  Menu,
  X,
  Sprout,
  LogOut,
  ChevronRight,
  ShoppingCart,
  MapPin,
  UserCheck,
  Phone,
  Store,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[]; // Only users with these roles can see this item
}

const allNavItems: NavItem[] = [
  {
    label: 'Farmer & Trader Portal',
    href: '/dashboard/farmer',
    icon: <Wheat size={20} />,
    roles: ['farmer', 'trader', 'admin'],
  },
  {
    label: 'Farm Inputs Shop',
    href: '/dashboard/inputs',
    icon: <Store size={20} />,
    roles: ['farmer', 'trader', 'admin'],
  },
  {
    label: 'Carrier Fleet Management',
    href: '/dashboard/carrier',
    icon: <Truck size={20} />,
    roles: ['carrier', 'admin'],
  },
  {
    label: 'Buyer Marketplace',
    href: '/dashboard/buyer',
    icon: <ShoppingCart size={20} />,
    roles: ['buyer', 'farmer', 'trader', 'admin'],
  },
  {
    label: 'Live Geospatial Map',
    href: '/dashboard/map',
    icon: <MapPin size={20} />,
    roles: ['farmer', 'trader', 'carrier', 'buyer', 'admin'],
  },
  {
    label: 'Admin Governance',
    href: '/dashboard/admin',
    icon: <ShieldCheck size={20} />,
    roles: ['admin'],
  },
  {
    label: 'BI Analytics Engine',
    href: '/dashboard/admin/analytics',
    icon: <BarChart3 size={20} />,
    roles: ['admin'],
  },
];

export default function NavigationShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { profile, user, signOut } = useAuthStore();

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const isAuthPage = pathname === '/login' || pathname === '/';
  if (isAuthPage) return <>{children}</>;

  // Role-based navigation filtering
  const userRole: UserRole = profile?.declared_profession || profile?.role || 'farmer';
  const navItems = useMemo(() => {
    return allNavItems.filter((item) => item.roles.includes(userRole));
  }, [userRole]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col
          border-r border-border bg-background-secondary
          transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo — Clickable, navigates to home */}
        <Link href="/" className="flex h-16 items-center gap-3 border-b border-border px-5 hover:bg-background-elevated transition-colors">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-agri-primary to-agri-primary-light">
            <Sprout size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-foreground">
              YieldFlow Web
            </h1>
            <p className="text-[11px] text-foreground-dim">
              Agri-Data Hub v2
            </p>
          </div>
          <button
            onClick={(e) => { e.preventDefault(); setSidebarOpen(false); }}
            className="ml-auto rounded-md p-1.5 text-foreground-muted hover:bg-background-elevated hover:text-foreground lg:hidden"
          >
            <X size={18} />
          </button>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-foreground-dim">
            Platform Portals
          </p>
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`
                      group flex items-center gap-3 rounded-lg px-3 py-2.5
                      text-sm font-medium transition-all duration-200
                      ${
                        isActive
                          ? 'bg-agri-primary/10 text-agri-primary-light'
                          : 'text-foreground-muted hover:bg-background-elevated hover:text-foreground'
                      }
                    `}
                  >
                    <span
                      className={`
                        transition-colors duration-200
                        ${isActive ? 'text-agri-primary-light' : 'text-foreground-dim group-hover:text-foreground-muted'}
                      `}
                    >
                      {item.icon}
                    </span>
                    {item.label}
                    {isActive && (
                      <ChevronRight
                        size={14}
                        className="ml-auto text-agri-primary-light"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Identity & Sign Out Footer */}
        <div className="border-t border-border p-3 space-y-2 bg-background/30">
          {profile ? (
            <div className="rounded-lg bg-background-card p-2.5 border border-border/60">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-agri-primary/20 text-agri-primary-light font-bold text-xs">
                  {profile.full_name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {profile.full_name}
                  </p>
                  <p className="text-[10px] text-agri-primary-light uppercase tracking-wider font-bold">
                    {profile.declared_profession || 'Farmer'}
                  </p>
                </div>
              </div>
              {profile.phone_number && (
                <div className="mt-1.5 flex items-center gap-1 text-[10px] text-foreground-dim border-t border-border/40 pt-1">
                  <Phone size={10} className="text-foreground-dim" />
                  <span className="truncate">{profile.phone_number}</span>
                </div>
              )}
            </div>
          ) : user ? (
            <div className="rounded-lg bg-red-500/10 p-2 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
              <UserCheck size={14} />
              <span>Unlinked Identity</span>
            </div>
          ) : null}

          <button
            onClick={() => signOut()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground-muted transition-colors hover:bg-background-elevated hover:text-red-400"
          >
            <LogOut size={18} className="text-foreground-dim" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-background-secondary/50 px-4 backdrop-blur-md lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-2 text-foreground-muted hover:bg-background-elevated hover:text-foreground lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <LayoutDashboard size={18} className="text-foreground-dim" />
              <h2 className="text-sm font-medium text-foreground-muted">
                {allNavItems.find(
                  (item) =>
                    pathname === item.href ||
                    pathname.startsWith(item.href + '/')
                )?.label || 'Dashboard'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-agri-primary/10 px-2.5 py-1 text-xs font-semibold text-agri-primary-light border border-agri-primary/20">
              <span className="h-1.5 w-1.5 rounded-full bg-agri-primary-light animate-pulse" />
              Realtime Sync Active
            </span>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 relative">
          <div className="gradient-mesh pointer-events-none" />
          {children}
        </div>
      </main>
    </div>
  );
}
