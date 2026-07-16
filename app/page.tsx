import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 py-16">
      {/* Dynamic Agricultural Hero Background with Glassmorphic Overlay */}
      <div className="absolute inset-0 z-0 opacity-30">
        <img
          src="https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?auto=format&fit=crop&w=2000&q=80"
          alt="Lush Agricultural Field"
          className="h-full w-full object-cover scale-105 animate-pulse duration-[10000ms]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/40 via-transparent to-amber-950/40" />
      </div>

      {/* Decorative Floating Green Glows */}
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-emerald-500/15 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-amber-500/15 blur-[120px] pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-4xl text-center animate-fade-in">
        {/* Clickable Sprout Logo */}
        <Link
          href="/"
          className="group mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 p-0.5 shadow-2xl shadow-emerald-500/30 hover:scale-105 transition-all duration-300"
        >
          <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950/40 backdrop-blur-md group-hover:bg-transparent transition-colors">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-md group-hover:rotate-12 transition-transform duration-300"
            >
              <path d="M7 20h10" />
              <path d="M10 20c5.5-2.5.8-6.4 3-10" />
              <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
              <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
            </svg>
          </div>
        </Link>

        {/* Badge / Pill */}
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">
            Unified Agricultural Intelligence v2.0
          </span>
        </div>

        {/* Title */}
        <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-white sm:text-6xl drop-shadow-sm">
          YieldFlow <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 bg-clip-text text-transparent">Web</span>
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-base sm:text-lg text-slate-300 leading-relaxed font-light drop-shadow">
          Connect local farms, commercial off-takers, and 3PL carriers with real-time IoT soil telemetry, GPS logistics route optimization, and direct verified crop trading.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-4 text-base font-bold text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-400 hover:shadow-emerald-500/40 active:scale-95 transition-all"
          >
            <span>Get Started</span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/dashboard/map"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-8 py-4 text-base font-semibold text-white backdrop-blur-md hover:bg-white/10 hover:border-white/30 active:scale-95 transition-all"
          >
            <span>Explore Live Map</span>
          </Link>
        </div>

        {/* Feature Badges (Removed Multi-Role Access & Offline-First PWA as requested) */}
        <div className="mt-16 flex flex-wrap justify-center gap-3 animate-fade-in" style={{ animationDelay: '200ms' }}>
          {[
            'Real-time IoT Monitoring',
            'Supply Chain Analytics',
            'Direct Off-Taker Marketplace',
            'Carrier Route Optimization',
          ].map((feature) => (
            <span
              key={feature}
              className="rounded-full border border-white/10 bg-slate-900/60 backdrop-blur-md px-4 py-2 text-xs font-semibold text-slate-300 shadow-sm hover:border-emerald-500/40 transition-colors"
            >
              {feature}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
