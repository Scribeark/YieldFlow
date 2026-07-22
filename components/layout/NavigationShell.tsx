'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/authStore';
import { ROLES, ROLE_ROUTES } from '../../lib/constants';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Button } from '../ui/Button';
import { Menu, X } from 'lucide-react';

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/unauthorized'];

export default function NavigationShell({ children }: { children: React.ReactNode }) {
  const { profile, isLoading, isInitialized, initialize, signOut } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Close mobile menu on route change
  useEffect(() => {
    // eslint-disable-next-line
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (!isInitialized || isLoading) return;

    if (!isPublicRoute && !profile) {
      router.push('/login');
    } else if (profile) {
      const correctDashboard = ROLE_ROUTES[profile.declared_profession];
      
      if (pathname.startsWith('/dashboard/') && !pathname.startsWith(correctDashboard)) {
        router.push('/unauthorized');
      } else if (pathname === '/' || pathname === '/login' || pathname === '/signup') {
        router.push(correctDashboard);
      }
    }
  }, [isInitialized, isLoading, isPublicRoute, profile, pathname, router]);

  if (!isPublicRoute && (!isInitialized || isLoading || !profile)) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (profile && pathname.startsWith('/dashboard/')) {
    const correctDashboard = ROLE_ROUTES[profile.declared_profession];
    if (!pathname.startsWith(correctDashboard)) {
      return null;
    }
  }

  const renderNavLinks = () => {
    if (!profile) {
      return (
        <>
          <Link href="/login" className="hover:opacity-80 transition block py-2 md:py-0">Log In</Link>
          <Link href="/signup" className="hover:opacity-80 transition block py-2 md:py-0">Sign Up</Link>
        </>
      );
    }

    return (
      <>
        {profile.declared_profession === ROLES.FARMER || profile.declared_profession === ROLES.TRADER ? (
          <>
            <Link href="/dashboard/seller" className="hover:opacity-80 transition block py-2 md:py-0">Dashboard</Link>
            <Link href="/dashboard/seller/sell" className="hover:opacity-80 transition block py-2 md:py-0">Sell</Link>
            <Link href="/dashboard/seller/requests" className="hover:opacity-80 transition block py-2 md:py-0">My Requests</Link>
            <Link href="/dashboard/seller/buyer-demands" className="hover:opacity-80 transition block py-2 md:py-0">Buyer Demands</Link>
            <Link href="/dashboard/seller/buyers-map" className="hover:opacity-80 transition block py-2 md:py-0">Buyers Map</Link>
            <Link href="/dashboard/seller/device-readings" className="hover:opacity-80 transition block py-2 md:py-0">Device Readings</Link>
          </>
        ) : null}

        {profile.declared_profession === ROLES.BUYER ? (
          <>
            <Link href="/dashboard/buyer" className="hover:opacity-80 transition block py-2 md:py-0">Dashboard</Link>
            <Link href="/dashboard/buyer/buy" className="hover:opacity-80 transition block py-2 md:py-0">Buy</Link>
            <Link href="/dashboard/buyer/demands" className="hover:opacity-80 transition block py-2 md:py-0">My Demands</Link>
            <Link href="/dashboard/buyer/orders" className="hover:opacity-80 transition block py-2 md:py-0">My Orders</Link>
            <Link href="/dashboard/buyer/sellers-map" className="hover:opacity-80 transition block py-2 md:py-0">Sellers Map</Link>
          </>
        ) : null}

        {profile.declared_profession === ROLES.CARRIER ? (
          <>
            <Link href="/dashboard/carrier" className="hover:opacity-80 transition block py-2 md:py-0">Dashboard</Link>
            <Link href="/dashboard/carrier/fleet" className="hover:opacity-80 transition block py-2 md:py-0">Fleet / Vehicles</Link>
            <Link href="/dashboard/carrier/jobs" className="hover:opacity-80 transition block py-2 md:py-0">Available Jobs</Link>
            <Link href="/dashboard/carrier/active-bookings" className="hover:opacity-80 transition block py-2 md:py-0">Active Bookings</Link>
          </>
        ) : null}
      </>
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="shadow-md relative z-50" style={{ backgroundColor: 'var(--agri-primary-dark)', color: '#ffffff' }}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link href={profile ? ROLE_ROUTES[profile.declared_profession] : '/'} className="text-xl font-bold whitespace-nowrap">
              Agro-Data Hub
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              <nav className="flex space-x-6 items-center text-sm font-medium">
                {renderNavLinks()}
              </nav>
              
              <div className="flex items-center space-x-4 border-l border-white/20 pl-4">
                <ThemeToggle />
                {profile && (
                  <div className="flex items-center space-x-4">
                    <div className="text-xs text-right">
                      <div className="font-bold">{profile.full_name}</div>
                      <div className="opacity-80">{profile.declared_profession}</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={signOut} className="bg-white/10 hover:bg-white/20 text-white">
                      Sign Out
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Menu Toggle */}
            <div className="md:hidden flex items-center space-x-4">
              <ThemeToggle />
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 bg-white/10 rounded hover:bg-white/20 transition"
              >
                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full shadow-lg border-t border-white/10" style={{ backgroundColor: 'var(--agri-primary-dark)' }}>
            <div className="px-4 py-4 space-y-4">
              {profile && (
                <div className="pb-4 border-b border-white/10 mb-4">
                  <div className="font-bold">{profile.full_name}</div>
                  <div className="text-sm opacity-80">{profile.declared_profession}</div>
                </div>
              )}
              
              <nav className="flex flex-col space-y-2 text-sm font-medium">
                {renderNavLinks()}
              </nav>
              
              {profile && (
                <div className="pt-4 mt-4 border-t border-white/10">
                  <Button variant="ghost" className="w-full justify-start px-0 bg-white/10 hover:bg-white/20 text-white" onClick={signOut}>
                    Sign Out
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
