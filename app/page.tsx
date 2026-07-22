import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-[80vh] items-center py-12 px-4 animate-fade-in">
      <div className="text-center max-w-3xl mb-16">
        <h1 className="text-5xl md:text-6xl font-extrabold mb-6 tracking-tight" style={{ color: 'var(--agri-primary-light)' }}>
          Agro-Data Hub
        </h1>
        <p className="text-xl md:text-2xl mb-8" style={{ color: 'var(--foreground-muted)' }}>
          A unified agricultural information infrastructure connecting farmers, logistics carriers, and market administrators with real-time data analytics.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/signup">
            <Button size="lg" className="w-full sm:w-auto">Create an Account</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto">Sign In</Button>
          </Link>
        </div>
      </div>
      
      <div className="w-full max-w-5xl">
        <h2 className="text-3xl font-bold text-center mb-10" style={{ color: 'var(--foreground)' }}>
          Join the Hub Ecosystem
        </h2>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
          <Card className="flex flex-col h-full text-center hover:-translate-y-1 transition-transform">
            <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--agri-primary-light)' }}>Smallholder Farmer</h3>
            <p className="text-sm flex-grow mb-6" style={{ color: 'var(--foreground-dim)' }}>
              Log harvests, monitor field data via IoT devices, and connect directly with enterprise buyers.
            </p>
          </Card>
          
          <Card className="flex flex-col h-full text-center hover:-translate-y-1 transition-transform">
            <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--agri-accent-light)' }}>Commodity Trader</h3>
            <p className="text-sm flex-grow mb-6" style={{ color: 'var(--foreground-dim)' }}>
              Aggregate harvests, negotiate bulk deals, and track market pricing trends in real-time.
            </p>
          </Card>
          
          <Card className="flex flex-col h-full text-center hover:-translate-y-1 transition-transform">
            <h3 className="text-xl font-bold mb-3" style={{ color: '#3b82f6' }}>Enterprise Buyer</h3>
            <p className="text-sm flex-grow mb-6" style={{ color: 'var(--foreground-dim)' }}>
              Source verified agricultural commodities directly from producers with full traceability.
            </p>
          </Card>
          
          <Card className="flex flex-col h-full text-center hover:-translate-y-1 transition-transform">
            <h3 className="text-xl font-bold mb-3" style={{ color: '#8b5cf6' }}>Logistics Carrier</h3>
            <p className="text-sm flex-grow mb-6" style={{ color: 'var(--foreground-dim)' }}>
              Manage fleet operations, discover transport jobs, and provide real-time tracking.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
