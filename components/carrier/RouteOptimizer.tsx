'use client';

import { useState, useEffect } from 'react';
import { Truck, MapPin, Navigation, Compass, AlertCircle, CheckCircle2, Play, Pause, RotateCcw, ShieldCheck, Zap } from 'lucide-react';

interface RouteCheckpoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: 'passed' | 'active' | 'pending';
  eta: string;
  notes: string;
}

export default function RouteOptimizer() {
  const [origin, setOrigin] = useState('Ibadan Central Harvest Depot (Lat: 7.3775, Lng: 3.9470)');
  const [destination, setDestination] = useState('Lagos Port Terminal & Off-Taker Hub (Lat: 6.5244, Lng: 3.3792)');
  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(35); // 0 to 100%
  const [currentSpeed, setCurrentSpeed] = useState(68);
  const [currentLat, setCurrentLat] = useState(7.0789);
  const [currentLng, setCurrentLng] = useState(3.7431);

  const checkpoints: RouteCheckpoint[] = [
    { id: '1', name: 'Ibadan North-East Toll Gate (Origin Checkpoint)', lat: 7.3775, lng: 3.9470, status: progress > 15 ? 'passed' : 'active', eta: 'Departed 08:30 AM', notes: 'Vehicle weigh-in verified (14.2 Tons Cassava)' },
    { id: '2', name: 'Sagamu Agricultural Interchange (Route Optimized)', lat: 6.8432, lng: 3.6489, status: progress > 50 ? 'passed' : progress > 15 ? 'active' : 'pending', eta: 'Estimated 10:15 AM', notes: 'Bypassed road congestion on E1 Expressway (-45 mins saving)' },
    { id: '3', name: 'Berger Logistics Checkpoint', lat: 6.6492, lng: 3.3711, status: progress > 85 ? 'passed' : progress > 50 ? 'active' : 'pending', eta: 'Estimated 11:30 AM', notes: 'Cold-chain telemetry check (Temperature: 18.2°C nominal)' },
    { id: '4', name: 'Lagos Port Processing Hub (Final Destination)', lat: 6.5244, lng: 3.3792, status: progress === 100 ? 'passed' : progress > 85 ? 'active' : 'pending', eta: 'Estimated 12:15 PM', notes: 'Buyer verified readiness for instant unloading' },
  ];

  // GPS simulation effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSimulating && progress < 100) {
      interval = setInterval(() => {
        setProgress((prev) => {
          const next = Math.min(prev + 5, 100);
          // Interpolate GPS coordinates between Ibadan and Lagos based on progress
          const newLat = 7.3775 - ((7.3775 - 6.5244) * (next / 100));
          const newLng = 3.9470 - ((3.9470 - 3.3792) * (next / 100));
          setCurrentLat(parseFloat(newLat.toFixed(4)));
          setCurrentLng(parseFloat(newLng.toFixed(4)));
          setCurrentSpeed(next === 100 ? 0 : Math.floor(62 + Math.random() * 14));
          if (next === 100) setIsSimulating(false);
          return next;
        });
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isSimulating, progress]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Banner / Header */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-950/80 via-slate-900 to-emerald-950/80 p-6 shadow-2xl backdrop-blur-xl text-white">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-300">
              <Zap size={14} className="text-blue-400 animate-pulse" /> AI Route Optimization & Live Telemetry
            </span>
            <h2 className="text-2xl font-black tracking-tight text-white mt-2">
              Active Carrier Dispatch & Route Optimizer
            </h2>
            <p className="text-sm text-slate-300 font-light mt-1">
              Real-time GPS dispatch tracking visible to both farmers and commercial off-taker buyers for total supply chain transparency.
            </p>
          </div>
        </div>
      </div>

      {/* Live Route Telemetry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 backdrop-blur-xl shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Compass size={14} className="text-blue-400" /> Current GPS Coordinates
          </p>
          <p className="text-xl font-black text-white mt-2 font-mono">
            {currentLat}° N, {currentLng}° E
          </p>
          <p className="text-xs text-blue-300 mt-1 flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-400 animate-ping" /> Live satellite lock active
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 backdrop-blur-xl shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Navigation size={14} className="text-emerald-400" /> Transit Velocity
          </p>
          <p className="text-xl font-black text-white mt-2 font-mono">
            {currentSpeed} <span className="text-xs font-normal text-slate-400">km/h</span>
          </p>
          <p className="text-xs text-emerald-400 mt-1">Optimal fuel consumption rate</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 backdrop-blur-xl shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Truck size={14} className="text-amber-400" /> Route Distance Progress
          </p>
          <p className="text-xl font-black text-white mt-2">
            {progress}% <span className="text-xs font-normal text-slate-400">Completed ({Math.floor(128 * (progress/100))} / 128 km)</span>
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-5 backdrop-blur-xl shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-400" /> AI Route Efficiency
          </p>
          <p className="text-xl font-black text-white mt-2">
            ₦18,500 <span className="text-xs font-normal text-emerald-300">Fuel Saved</span>
          </p>
          <p className="text-xs text-emerald-400 mt-1">Bypassed 3 major highway jams</p>
        </div>
      </div>

      {/* Route Checkpoints Timeline */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 backdrop-blur-xl shadow-2xl text-white">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <MapPin size={18} className="text-blue-400" />
          Turn-by-Turn Route Checkpoint Verification
        </h3>

        <div className="relative border-l border-white/10 ml-3 pl-6 space-y-6">
          {checkpoints.map((cp) => (
            <div key={cp.id} className="relative group">
              {/* Timeline dot */}
              <div
                className={`absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 transition-all ${
                  cp.status === 'passed'
                    ? 'border-emerald-400 bg-emerald-500 shadow-sm shadow-emerald-500/50'
                    : cp.status === 'active'
                    ? 'border-blue-400 bg-blue-500 animate-ping'
                    : 'border-slate-600 bg-slate-800'
                }`}
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-white/5 bg-slate-800/40 p-4 hover:border-white/15 transition-all">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{cp.name}</span>
                    {cp.status === 'passed' && (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300 border border-emerald-500/30">
                        Passed
                      </span>
                    )}
                    {cp.status === 'active' && (
                      <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-300 border border-blue-500/30 animate-pulse">
                        Active Waypoint
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{cp.notes}</p>
                </div>
                <div className="mt-2 sm:mt-0 text-right">
                  <span className="text-xs font-mono font-semibold text-slate-300">{cp.eta}</span>
                  <p className="text-[10px] text-slate-500">Coordinates: {cp.lat}, {cp.lng}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
