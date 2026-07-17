'use client';

import { useState } from 'react';
import Link from 'next/link';
import ThemeToggle from '@/components/ui/ThemeToggle';
import {
  Sprout,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Truck,
  ShoppingCart,
  ShieldCheck,
  MapPin,
  Radio,
  Zap,
  Package,
  Activity,
} from 'lucide-react';

export default function HomePage() {
  const [activeStoryTab, setActiveStoryTab] = useState<'iot' | 'market' | 'logistics' | 'enterprise'>('iot');

  return (
    <div className="relative min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* Top Commercial Navbar */}
      <header className="sticky top-0 z-50 border-b border-border bg-background-card/90 backdrop-blur-xl px-4 py-3 sm:px-6 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-md shadow-emerald-500/25 group-hover:scale-105 transition-transform">
              <Sprout size={22} className="text-white" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-foreground flex items-center gap-1">
                YieldFlow <span className="text-agri-primary">Web</span>
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-widest text-foreground-muted">
                Commercial Supply Chain
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="hidden sm:flex items-center gap-1.5 rounded-xl border border-border bg-background-elevated px-4 py-2 text-xs font-bold text-foreground hover:border-border-hover transition-all"
            >
              <span>Sign In</span>
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4.5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-400 active:scale-95 transition-all"
            >
              <span>Register / Portal</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 border-b border-border">
        {/* Decorative Background Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[800px] rounded-full bg-gradient-to-tr from-emerald-500/10 via-teal-500/10 to-amber-500/10 blur-[130px] pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-5xl px-4 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-agri-primary backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span>High-Fidelity Supply Chain & Logistics Network</span>
          </div>

          <h1 className="mb-6 text-4xl sm:text-6xl font-black tracking-tight text-foreground leading-tight">
            Seamless Agricultural Trade, <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-500 bg-clip-text text-transparent">
              IoT Telemetry & 3PL Logistics
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-3xl text-base sm:text-lg text-foreground-muted leading-relaxed font-normal">
            YieldFlow connects independent farmers, multi-vehicle logistics carriers, and commercial off-taker buyers across Nigeria. Experience verified PWA harvest inspections, turn-by-turn route oversight, and transparent financial settlement.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-4.5 text-base font-bold text-white shadow-xl shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-400 hover:shadow-emerald-500/40 active:scale-95 transition-all"
            >
              <span>Enter Portal Workspace</span>
              <ArrowRight size={18} />
            </Link>

            <Link
              href="/dashboard/map"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl border border-border bg-background-card px-8 py-4.5 text-base font-bold text-foreground shadow-sm hover:bg-background-elevated active:scale-95 transition-all"
            >
              <MapPin size={18} className="text-agri-primary" />
              <span>Explore Live Geospatial Map</span>
            </Link>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { label: 'IoT Sensor Telemetry', value: 'Live Readouts', icon: <Cpu size={18} className="text-emerald-500" /> },
              { label: 'Carrier Fleet Assets', value: 'Multi-Vehicle', icon: <Truck size={18} className="text-blue-500" /> },
              { label: 'Off-Taker Marketplace', value: 'Verified Crops', icon: <ShoppingCart size={18} className="text-teal-500" /> },
              { label: 'Route Settlement', value: 'Buyer Pays 3PL', icon: <ShieldCheck size={18} className="text-amber-500" /> },
            ].map((metric, i) => (
              <div key={i} className="rounded-2xl border border-border bg-background-card/80 p-4 text-left shadow-sm backdrop-blur-md">
                <div className="flex items-center gap-2 mb-1">
                  {metric.icon}
                  <span className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted">{metric.label}</span>
                </div>
                <p className="text-base sm:text-lg font-black text-foreground">{metric.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Storytelling Scroll Section */}
      <section className="py-20 sm:py-28 px-4 max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-agri-primary">System Architecture & Capabilities</span>
          <h2 className="text-3xl sm:text-4xl font-black text-foreground mt-2">
            Interactive Multi-Role Workflow
          </h2>
          <p className="text-sm sm:text-base text-foreground-muted max-w-2xl mx-auto mt-2">
            Click through the interactive sequential layers below to explore how farmers, enterprise buyers, and logistics fleets interact inside YieldFlow.
          </p>

          {/* Story Switcher Tabs */}
          <div className="mt-8 inline-flex flex-wrap justify-center gap-2 rounded-2xl border border-border bg-background-card p-1.5 shadow-md">
            {[
              { id: 'iot', label: '1. IoT Telemetry & Farmers', icon: <Cpu size={16} /> },
              { id: 'market', label: '2. Off-Taker Marketplace', icon: <ShoppingCart size={16} /> },
              { id: 'logistics', label: '3. Carrier Fleet & 3PL Haulage', icon: <Truck size={16} /> },
              { id: 'enterprise', label: '4. Enterprise Multi-Role Oversight', icon: <ShieldCheck size={16} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveStoryTab(tab.id as any)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${
                  activeStoryTab === tab.id
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
                    : 'text-foreground-muted hover:text-foreground hover:bg-background-elevated'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Story Tab Content Card */}
        <div className="rounded-3xl border border-border bg-background-card overflow-hidden shadow-2xl transition-all duration-300">
          {activeStoryTab === 'iot' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[480px]">
              {/* Text / Interactive Readouts */}
              <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between space-y-6">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-extrabold text-agri-primary uppercase mb-3">
                    <Activity size={14} /> Layer 1: Producer & IoT Telemetry
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-foreground">
                    Precision Soil Telemetry & Harvest Verification
                  </h3>
                  <p className="text-sm sm:text-base text-foreground-muted mt-3 leading-relaxed">
                    Smallholder farmers and commercial farm operators log soil moisture, temperature, and NPK nutrient balance via remote IoT nodes. When soil moisture drops below threshold, instant readiness alerts prompt irrigation or harvest scheduling.
                  </p>
                </div>

                {/* Simulated Telemetry Card */}
                <div className="rounded-2xl border border-border bg-background-secondary p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <span className="text-xs font-bold text-foreground flex items-center gap-2">
                      <Radio size={15} className="text-emerald-500 animate-pulse" /> Ibadan Node #4 (Cassava Block B)
                    </span>
                    <span className="rounded-full bg-emerald-500/15 text-agri-primary px-2 py-0.5 text-[10px] font-bold">
                      Online & Syncing
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-border bg-background-card p-3">
                      <span className="text-[10px] uppercase font-bold text-foreground-muted">Soil Moisture</span>
                      <p className="text-lg font-black text-amber-500 mt-0.5">28.4%</p>
                      <span className="text-[10px] text-amber-500/80 font-semibold">⚠ Irrigation Alert</span>
                    </div>
                    <div className="rounded-xl border border-border bg-background-card p-3">
                      <span className="text-[10px] uppercase font-bold text-foreground-muted">Ambient Temp</span>
                      <p className="text-lg font-black text-foreground mt-0.5">29.1°C</p>
                      <span className="text-[10px] text-emerald-500 font-semibold">✔ Optimal Range</span>
                    </div>
                    <div className="rounded-xl border border-border bg-background-card p-3">
                      <span className="text-[10px] uppercase font-bold text-foreground-muted">NPK Balance</span>
                      <p className="text-lg font-black text-foreground mt-0.5">14-18-12</p>
                      <span className="text-[10px] text-emerald-500 font-semibold">✔ High Yield</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-foreground-muted font-medium">Ready to broadcast a verified crop listing?</span>
                  <Link
                    href="/login"
                    className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-600 transition-all"
                  >
                    <span>Register / Enter Farmer Portal</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>

              {/* Visual Side */}
              <div className="lg:col-span-5 relative min-h-[300px] lg:min-h-full bg-slate-900 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1592982537447-6f2a6a0c8b8b?auto=format&fit=crop&w=1200&q=80"
                  alt="Farmer checking precision crop readiness"
                  className="absolute inset-0 h-full w-full object-cover scale-105 transition-transform duration-700 hover:scale-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/20 bg-slate-900/80 p-4 backdrop-blur-md text-white">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">PWA Camera Verification</p>
                  <p className="text-sm font-semibold mt-1">Sellers snap live harvest photos using mobile device cameras before broadcasting trade offers.</p>
                </div>
              </div>
            </div>
          )}

          {activeStoryTab === 'market' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[480px]">
              <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between space-y-6">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-teal-500/10 border border-teal-500/30 px-3 py-1 text-xs font-extrabold text-teal-600 uppercase mb-3">
                    <ShoppingCart size={14} /> Layer 2: Off-Taker Procurement
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-foreground">
                    Direct Crop Trading without Middlemen
                  </h3>
                  <p className="text-sm sm:text-base text-foreground-muted mt-3 leading-relaxed">
                    Commercial processing enterprises inspect producer harvest quality through high-resolution photo logs. Buyers review volume, location, and grading, then lock in contracts instantly while handling logistics carrier payments directly (`Buyer Pays Logistics`).
                  </p>
                </div>

                {/* Simulated Trade Card */}
                <div className="rounded-2xl border border-border bg-background-secondary p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-foreground">Verified Premium White Cassava (14.2 Tons)</span>
                      <p className="text-[11px] text-foreground-muted">Seller: Alhaji Musa Farm Enterprise • Oyo State</p>
                    </div>
                    <span className="text-lg font-black text-emerald-600">₦180,000 / ton</span>
                  </div>
                  <div className="rounded-xl border border-border bg-background-card p-3 flex items-center justify-between text-xs font-semibold">
                    <span className="flex items-center gap-2 text-foreground">
                      <CheckCircle2 size={16} className="text-emerald-500" /> Rear Camera Photo Audited & Verified
                    </span>
                    <span className="text-teal-600 font-bold">Ready for Pickup</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-foreground-muted font-medium">Looking to source guaranteed commercial tonnage?</span>
                  <Link
                    href="/login"
                    className="flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-teal-700 transition-all"
                  >
                    <span>Launch Buyer Marketplace</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-5 relative min-h-[300px] lg:min-h-full bg-slate-900 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80"
                  alt="Agricultural marketplace goods"
                  className="absolute inset-0 h-full w-full object-cover scale-105 transition-transform duration-700 hover:scale-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/20 bg-slate-900/80 p-4 backdrop-blur-md text-white">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-teal-400">Total Audit Transparency</p>
                  <p className="text-sm font-semibold mt-1">Every harvest batch includes geotagged coordinates and unedited photo evidence.</p>
                </div>
              </div>
            </div>
          )}

          {activeStoryTab === 'logistics' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[480px]">
              <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between space-y-6">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 border border-blue-500/30 px-3 py-1 text-xs font-extrabold text-blue-600 uppercase mb-3">
                    <Truck size={14} /> Layer 3: 3PL Haulage Fleet
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-foreground">
                    Multi-Vehicle Fleet Registration & GPS Corridor Tracking
                  </h3>
                  <p className="text-sm sm:text-base text-foreground-muted mt-3 leading-relaxed">
                    Independent carrier fleet operators can register unlimited transport assets (`Trucks`, `Refrigerated Vans`, `Flatbeds`) with vehicle registration photo verification. Fleet operators monitor available load boards, accept bookings, and dispatch vehicles with turn-by-turn waypoint checks.
                  </p>
                </div>

                {/* Simulated Fleet Card */}
                <div className="rounded-2xl border border-border bg-background-secondary p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-2">
                      <Truck size={16} className="text-blue-500" /> Fleet Registry: 3 Active Assets Online
                    </span>
                    <span className="rounded-full bg-blue-500/15 text-blue-600 px-2 py-0.5 text-[10px] font-bold">
                      Route Active
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl border border-border bg-background-card p-3">
                      <span className="font-bold text-foreground block">MACK Heavy Hauler (LAG-842-XY)</span>
                      <span className="text-[11px] text-foreground-muted">En route: Ibadan to Sagamu Toll</span>
                    </div>
                    <div className="rounded-xl border border-border bg-background-card p-3">
                      <span className="font-bold text-foreground block">ISUZU Reefer Van (OYO-119-AB)</span>
                      <span className="text-[11px] text-emerald-600 font-semibold">Available for Booking</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-foreground-muted font-medium">Manage transport fleet or accept haulage contracts?</span>
                  <Link
                    href="/login"
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-all"
                  >
                    <span>Launch Carrier Fleet Portal</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-5 relative min-h-[300px] lg:min-h-full bg-slate-900 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80"
                  alt="Logistics fleet transport on highway"
                  className="absolute inset-0 h-full w-full object-cover scale-105 transition-transform duration-700 hover:scale-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/20 bg-slate-900/80 p-4 backdrop-blur-md text-white">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-blue-400">Buyer Pays Logistics Flow</p>
                  <p className="text-sm font-semibold mt-1">Carriers receive guaranteed haulage settlement directly from commercial buyers.</p>
                </div>
              </div>
            </div>
          )}

          {activeStoryTab === 'enterprise' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[480px]">
              <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between space-y-6">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/10 border border-purple-500/30 px-3 py-1 text-xs font-extrabold text-purple-600 uppercase mb-3">
                    <ShieldCheck size={14} /> Layer 4: Enterprise Multi-Role
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-foreground">
                    Full Operations & Multi-Capability Governance
                  </h3>
                  <p className="text-sm sm:text-base text-foreground-muted mt-3 leading-relaxed">
                    Large-scale agribusiness corporations and cooperative administrators can switch seamlessly across Farmer, Buyer, Carrier, and Governance portals. Monitor fleet movements while simultaneously purchasing crops across the national corridor.
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-background-secondary p-5 space-y-3">
                  <span className="text-xs font-bold text-foreground block">Unified Enterprise Capabilities</span>
                  <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                    <div className="rounded-lg bg-background-card p-2.5 border border-border flex items-center gap-2">
                      <Zap size={14} className="text-emerald-500" /> Multi-Role Portal Switcher
                    </div>
                    <div className="rounded-lg bg-background-card p-2.5 border border-border flex items-center gap-2">
                      <Package size={14} className="text-purple-500" /> Audit Logs & Data Minimization
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-foreground-muted font-medium">Want full multi-role access across every portal?</span>
                  <Link
                    href="/login"
                    className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-purple-700 transition-all"
                  >
                    <span>Access All-Access Demo Mode</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-5 relative min-h-[300px] lg:min-h-full bg-slate-900 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80"
                  alt="Enterprise analytics dashboard"
                  className="absolute inset-0 h-full w-full object-cover scale-105 transition-transform duration-700 hover:scale-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/20 bg-slate-900/80 p-4 backdrop-blur-md text-white">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-purple-400">Governance & Analytics Engine</p>
                  <p className="text-sm font-semibold mt-1">High-throughput data ingestion ready for Postman or Grafana evaluation streams.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Commercial Footer */}
      <footer className="border-t border-border bg-background-secondary py-12 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white font-black text-sm">
              Y
            </div>
            <span className="text-sm font-bold text-foreground">YieldFlow Commercial Web v2.0</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-foreground-muted">
            <Link href="/dashboard/farmer" className="hover:text-foreground transition-colors">Farmer Portal</Link>
            <Link href="/dashboard/buyer" className="hover:text-foreground transition-colors">Enterprise Buyer</Link>
            <Link href="/dashboard/carrier" className="hover:text-foreground transition-colors">Carrier Fleet</Link>
            <Link href="/dashboard/map" className="hover:text-foreground transition-colors">Live Geospatial Map</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link>
          </div>

          <p className="text-xs text-foreground-muted">
            © {new Date().getFullYear()} YieldFlow Agricultural & Logistics Network.
          </p>
        </div>
      </footer>
    </div>
  );
}
