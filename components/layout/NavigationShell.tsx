'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/authStore';
import { ROLES, ROLE_ROUTES } from '../../lib/constants';

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/unauthorized'];

export default function NavigationShell({ children }: { children: React.ReactNode }) {
  const { profile, isLoading, isInitialized, initialize, signOut } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (!isInitialized || isLoading) return;

    if (!isPublicRoute && !profile) {
      router.push('/login');
    } else if (profile && pathname.startsWith('/dashboard/')) {
      const correctDashboard = ROLE_ROUTES[profile.declared_profession];
      if (!pathname.startsWith(correctDashboard)) {
        router.push('/unauthorized');
      }
    }
  }, [isInitialized, isLoading, isPublicRoute, profile, pathname, router]);

  // 1. If auth is still loading and it's not a public route, show loading skeleton
  if (!isPublicRoute && (!isInitialized || isLoading || !profile)) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  // 3. Prevent cross-role self-switching: if user is on a dashboard route, check if they own it
  if (profile && pathname.startsWith('/dashboard/')) {
    const correctDashboard = ROLE_ROUTES[profile.declared_profession];
    if (!pathname.startsWith(correctDashboard)) {
      return null;
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="bg-green-700 text-white shadow-md p-4">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/" className="text-xl font-bold">Agro-Data Hub</Link>
          <nav className="flex space-x-6 items-center">
            {profile ? (
              <>
                <span className="text-sm font-medium">
                  {profile.full_name} ({profile.declared_profession})
                </span>
                
                {profile.declared_profession === ROLES.FARMER || profile.declared_profession === ROLES.TRADER ? (
                  <>
                    <Link href="/dashboard/seller">Dashboard</Link>
                    <Link href="/dashboard/seller/sell">Sell</Link>
                    <Link href="/dashboard/seller/requests">My Requests</Link>
                    <Link href="/dashboard/seller/buyers-map">Buyers Map</Link>
                    <Link href="/dashboard/seller/device-readings">Device Readings</Link>
                  </>
                ) : null}

                {profile.declared_profession === ROLES.BUYER ? (
                  <>
                    <Link href="/dashboard/buyer">Dashboard</Link>
                    <Link href="/dashboard/buyer/buy">Buy</Link>
                    <Link href="/dashboard/buyer/orders">My Orders</Link>
                    <Link href="/dashboard/buyer/sellers-map">Sellers Map</Link>
                  </>
                ) : null}

                {profile.declared_profession === ROLES.CARRIER ? (
                  <>
                    <Link href="/dashboard/carrier">Dashboard</Link>
                    <Link href="/dashboard/carrier/jobs">Jobs</Link>
                    <Link href="/dashboard/carrier/fleet">Fleet</Link>
                    <Link href="/dashboard/carrier/tracking">Live Tracking</Link>
                  </>
                ) : null}

                <button 
                  onClick={signOut}
                  className="bg-green-800 px-4 py-2 rounded text-sm font-semibold hover:bg-green-900 transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/login">Log In</Link>
                <Link href="/signup">Sign Up</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
