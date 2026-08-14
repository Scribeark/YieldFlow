'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/authStore';
import { ROLES, ROLE_ROUTES } from '../../lib/constants';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Button } from '../ui/Button';
import { Menu, X, ChevronDown, User, Settings, LogOut, Trash2, Bell } from 'lucide-react';
import { NotificationDrawer } from '../shared/NotificationDrawer';
import { getNotifications } from '@/lib/api/notifications';
import { createClient } from '@/lib/supabase/client';

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/unauthorized'];

function UserProfileDropdown({
  profile,
  onSignOut,
}: {
  profile: any;
  onSignOut: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="flex items-center space-x-2 text-xs text-right bg-white/10 hover:bg-white/20 p-2 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
      >
        <div>
          <div className="font-bold text-white">{profile.full_name}</div>
          <div className="opacity-80 text-white/80">{profile.declared_profession}</div>
        </div>
        <ChevronDown size={14} className={`text-white transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          role="menu"
          tabIndex={-1}
          className="absolute right-0 mt-2 w-56 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-50 p-2 text-sm text-white animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="px-3 py-2 border-b border-white/10 mb-1">
            <div className="font-bold text-white truncate">{profile.full_name}</div>
            <div className="text-xs opacity-70 text-white/70">{profile.declared_profession}</div>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              router.push('/dashboard/settings');
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 flex items-center gap-2 transition cursor-pointer"
          >
            <User size={15} /> Profile
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              router.push('/dashboard/settings');
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 flex items-center gap-2 transition cursor-pointer"
          >
            <Settings size={15} /> Settings
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onSignOut();
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 flex items-center gap-2 text-gray-300 transition cursor-pointer"
          >
            <LogOut size={15} /> Sign Out
          </button>

          <div className="my-1 border-t border-white/10"></div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              router.push('/dashboard/settings?action=delete');
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-500/20 text-red-400 flex items-center gap-2 transition cursor-pointer"
          >
            <Trash2 size={15} /> Delete Account
          </button>
        </div>
      )}
    </div>
  );
}

export default function NavigationShell({ children }: { children: React.ReactNode }) {
  const { profile, isLoading, isInitialized, initialize, signOut } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    if (!profile) return;
    const { data } = await getNotifications(supabase);
    if (data) {
      setUnreadCount(data.filter((n) => !n.is_read).length);
    }
  };

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (profile) {
      fetchUnreadCount();
    }
  }, [profile, pathname]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (!isInitialized || isLoading) return;

    if (!isPublicRoute && !profile) {
      router.push('/login');
    } else if (profile) {
      const correctDashboard = ROLE_ROUTES[profile.declared_profession as string] || '/unauthorized';

      // Allow /dashboard/settings for any authenticated user
      if (
        pathname &&
        pathname.startsWith('/dashboard/') &&
        !pathname.startsWith('/dashboard/settings') &&
        !pathname.startsWith(correctDashboard)
      ) {
        router.push('/unauthorized');
      } else if (pathname === '/' || pathname === '/login' || pathname === '/signup') {
        router.push(correctDashboard);
      }
    }
  }, [isInitialized, isLoading, isPublicRoute, profile, pathname, router]);

  if (!isPublicRoute && (!isInitialized || isLoading || !profile)) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (profile && pathname && pathname.startsWith('/dashboard/')) {
    const correctDashboard = ROLE_ROUTES[profile.declared_profession as string] || '/unauthorized';
    if (!pathname.startsWith('/dashboard/settings') && !pathname.startsWith(correctDashboard)) {
      return null;
    }
  }

  const renderNavLinks = () => {
    if (!profile) {
      return (
        <>
          <Link href="/login" className="hover:opacity-80 transition block py-2 md:py-0">
            Log In
          </Link>
          <Link href="/signup" className="hover:opacity-80 transition block py-2 md:py-0">
            Sign Up
          </Link>
        </>
      );
    }

    return (
      <>
        {profile.declared_profession === ROLES.FARMER || profile.declared_profession === ROLES.TRADER ? (
          <>
            <Link href="/dashboard/seller" className="hover:opacity-80 transition block py-2 md:py-0">
              Dashboard
            </Link>
            <Link href="/dashboard/seller/sell" className="hover:opacity-80 transition block py-2 md:py-0">
              Sell
            </Link>
            <Link href="/dashboard/seller/requests" className="hover:opacity-80 transition block py-2 md:py-0">
              My Requests
            </Link>
            <Link href="/dashboard/seller/bids" className="hover:opacity-80 transition block py-2 md:py-0">
              Bulk Bidding Sale
            </Link>
            <Link href="/dashboard/seller/buyer-demands" className="hover:opacity-80 transition block py-2 md:py-0">
              Buyer Demands
            </Link>
            <Link href="/dashboard/seller/buyers-map" className="hover:opacity-80 transition block py-2 md:py-0">
              Buyers Map
            </Link>
          </>
        ) : null}

        {profile.declared_profession === ROLES.BUYER || profile.declared_profession === ROLES.LEGACY_BUYER ? (
          <>
            <Link href="/dashboard/buyer" className="hover:opacity-80 transition block py-2 md:py-0">
              Dashboard
            </Link>
            <Link href="/dashboard/buyer/buy" className="hover:opacity-80 transition block py-2 md:py-0">
              Buy
            </Link>
            <Link href="/dashboard/buyer/pre-harvest" className="hover:opacity-80 transition block py-2 md:py-0">
              Upcoming Harvests
            </Link>
            <Link href="/dashboard/buyer/my-bids" className="hover:opacity-80 transition block py-2 md:py-0">
              My Bids
            </Link>
            <Link href="/dashboard/buyer/demands" className="hover:opacity-80 transition block py-2 md:py-0">
              My Demands
            </Link>
            <Link href="/dashboard/buyer/orders" className="hover:opacity-80 transition block py-2 md:py-0">
              My Orders
            </Link>
            <Link href="/dashboard/buyer/sellers-map" className="hover:opacity-80 transition block py-2 md:py-0">
              Sellers Map
            </Link>
          </>
        ) : null}

        {profile.declared_profession === ROLES.CARRIER ? (
          <>
            <Link href="/dashboard/carrier" className="hover:opacity-80 transition block py-2 md:py-0">
              Dashboard
            </Link>
            <Link href="/dashboard/carrier/fleet" className="hover:opacity-80 transition block py-2 md:py-0">
              Fleet
            </Link>
            <Link href="/dashboard/carrier/tracking" className="hover:opacity-80 transition block py-2 md:py-0">
              Logistics Map
            </Link>
            <Link href="/dashboard/carrier/jobs" className="hover:opacity-80 transition block py-2 md:py-0">
              Available Jobs
            </Link>
            <Link href="/dashboard/carrier/active-bookings" className="hover:opacity-80 transition block py-2 md:py-0">
              Active Bookings
            </Link>
          </>
        ) : null}
      </>
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="shadow-md relative z-50"
        style={{ backgroundColor: 'var(--agri-primary-dark)', color: '#ffffff' }}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link
              href={profile ? (ROLE_ROUTES[profile.declared_profession as string] || '/') : '/'}
              className="text-xl font-bold whitespace-nowrap"
            >
              Agro-Data Hub
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              <nav className="flex space-x-6 items-center text-sm font-medium">{renderNavLinks()}</nav>

              <div className="flex items-center space-x-4 border-l border-white/20 pl-4">
                <ThemeToggle />
                {profile && (
                  <button
                    onClick={() => setIsNotificationOpen(true)}
                    className="relative p-2 bg-white/10 rounded-lg hover:bg-white/20 transition text-white"
                    title="Notifications"
                  >
                    <Bell size={18} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                )}
                {profile && <UserProfileDropdown profile={profile} onSignOut={signOut} />}
              </div>
            </div>

            {/* Mobile Menu Toggle */}
            <div className="md:hidden flex items-center space-x-4">
              <ThemeToggle />
              {profile && (
                <button
                  onClick={() => setIsNotificationOpen(true)}
                  className="relative p-2 bg-white/10 rounded hover:bg-white/20 transition text-white"
                  title="Notifications"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              )}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 bg-white/10 rounded hover:bg-white/20 transition"
              >
                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        <NotificationDrawer
          isOpen={isNotificationOpen}
          onClose={() => setIsNotificationOpen(false)}
          onRefreshCount={fetchUnreadCount}
        />

        {/* Mobile Navigation Dropdown */}
        {isMobileMenuOpen && (
          <div
            className="md:hidden absolute top-full left-0 w-full shadow-lg border-t border-white/10"
            style={{ backgroundColor: 'var(--agri-primary-dark)' }}
          >
            <div className="px-4 py-4 space-y-4">
              {profile && (
                <div className="pb-4 border-b border-white/10 mb-4 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-white">{profile.full_name}</div>
                    <div className="text-sm opacity-80 text-white/80">{profile.declared_profession}</div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href="/dashboard/settings"
                      className="p-2 bg-white/10 rounded-lg hover:bg-white/20 text-xs font-semibold flex items-center gap-1 text-white"
                    >
                      <Settings size={14} /> Settings
                    </Link>
                  </div>
                </div>
              )}

              <nav className="flex flex-col space-y-2 text-sm font-medium">{renderNavLinks()}</nav>

              {profile && (
                <div className="pt-4 mt-4 border-t border-white/10 space-y-2">
                  <Link
                    href="/dashboard/settings?action=delete"
                    className="block w-full text-left py-2 text-red-400 text-sm font-medium hover:underline flex items-center gap-2"
                  >
                    <Trash2 size={16} /> Delete Account
                  </Link>

                  <Button
                    variant="ghost"
                    className="w-full justify-start px-0 bg-white/10 hover:bg-white/20 text-white"
                    onClick={signOut}
                  >
                    <LogOut size={16} className="mr-2" /> Sign Out
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">{children}</main>
    </div>
  );
}
