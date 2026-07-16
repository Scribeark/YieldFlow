import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="gradient-mesh" />

      <div className="animate-fade-in text-center">
        {/* Clickable Logo */}
        <Link href="/" className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-agri-primary to-agri-primary-light shadow-lg shadow-agri-primary/20 hover:scale-105 transition-transform">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 20h10" />
            <path d="M10 20c5.5-2.5.8-6.4 3-10" />
            <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
            <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
          </svg>
        </Link>

        <h1 className="mb-2 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          YieldFlow <span className="text-agri-primary-light">Web</span>
        </h1>
        <p className="mb-4 text-xs font-bold uppercase tracking-widest text-foreground-dim">
          Agri-Data Hub v2
        </p>
        <p className="mx-auto mb-10 max-w-md text-base text-foreground-muted">
          Unified Agricultural Intelligence Platform — connecting farmers,
          carriers, buyers, and administrators with real-time IoT and logistics verification.
        </p>


        <Link
          href="/login"
          className="btn btn-primary btn-lg inline-flex text-base"
        >
          Get Started
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Feature badges */}
      <div className="mt-16 flex flex-wrap justify-center gap-3 animate-fade-in" style={{ animationDelay: '200ms' }}>
        {['Real-time IoT Monitoring', 'Supply Chain Analytics', 'Multi-Role Access', 'Offline-First PWA'].map(
          (feature) => (
            <span
              key={feature}
              className="rounded-full border border-border bg-background-card px-4 py-2 text-xs font-medium text-foreground-muted"
            >
              {feature}
            </span>
          )
        )}
      </div>
    </div>
  );
}
