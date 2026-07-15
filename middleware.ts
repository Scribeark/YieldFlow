import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files, API routes, and auth callbacks
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname === '/'
  ) {
    return NextResponse.next();
  }

  // Get the Supabase session from cookies
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // If no session and trying to access protected routes, redirect to login
  if (!session && pathname.startsWith('/dashboard')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If logged in and on login page, redirect to their dashboard
  if (session && pathname === '/login') {
    // Fetch user role from profile
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    const role = profile?.role || 'farmer';
    return NextResponse.redirect(
      new URL(`/dashboard/${role}`, request.url)
    );
  }

  // Role-based route protection for dashboard routes
  if (session && pathname.startsWith('/dashboard')) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    const role = profile?.role;

    // Protect admin routes
    if (pathname.startsWith('/dashboard/admin') && role !== 'admin') {
      return NextResponse.redirect(
        new URL(`/dashboard/${role || 'farmer'}`, request.url)
      );
    }

    // Protect carrier routes
    if (pathname.startsWith('/dashboard/carrier') && role !== 'carrier' && role !== 'admin') {
      return NextResponse.redirect(
        new URL(`/dashboard/${role || 'farmer'}`, request.url)
      );
    }

    // Protect farmer routes
    if (pathname.startsWith('/dashboard/farmer') && role !== 'farmer' && role !== 'admin') {
      return NextResponse.redirect(
        new URL(`/dashboard/${role || 'farmer'}`, request.url)
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};
