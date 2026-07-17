'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { HarvestStatus } from '@/lib/types';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { Search, Filter, ChevronLeft, ChevronRight, ArrowUpDown, AlertCircle, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';

interface LogisticsRow {
  id: string;
  crop_type: string;
  quantity_kg: number;
  farm_location: string;
  status: HarvestStatus;
  created_at: string;
  users?: { full_name: string } | null;
  logistics_bookings?: { id: string; carrier_id: string; status: HarvestStatus; pickup_time: string | null; delivery_time: string | null }[];
}

const statusBadgeClass: Record<string, string> = {
  pending: 'badge badge-pending',
  matched: 'badge badge-matched',
  in_transit: 'badge badge-in-transit',
  completed: 'badge badge-completed',
};

const statusLabel: Record<string, string> = {
  pending: 'Pending',
  matched: 'Matched',
  in_transit: 'In Transit',
  completed: 'Completed',
};

const PAGE_SIZE = 10;

export default function LogisticsTable() {
  const [data, setData] = useState<LogisticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<HarvestStatus | 'all'>('all');
  const [sortField, setSortField] = useState<'created_at' | 'quantity_kg'>('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: rows, error: fetchError } = await supabase
          .from('trade_requests')
          .select('*, users(full_name), logistics_bookings(*)')
          .order('created_at', { ascending: false });

        if (fetchError) throw new Error(fetchError.message);

        // Map real schema fields to table view structure
        const mapped: LogisticsRow[] = (rows || []).map((row: Record<string, unknown>) => ({
          id: String(row.id || ''),
          crop_type: String(row.commodity_variety || row.crop_type || 'Crop Variety'),
          quantity_kg: Number(row.quantity_volume || row.quantity || row.quantity_kg || 0),
          farm_location: String(row.physical_address || row.address || row.farm_location || 'Standard Hub'),
          status: String(row.request_status || row.status || 'pending'),
          created_at: String(row.created_at || new Date().toISOString()),
          users: row.users as { full_name: string } | null,
          logistics_bookings: (row.logistics_bookings || []) as { id: string; carrier_id: string; status: HarvestStatus; pickup_time: string | null; delivery_time: string | null }[],
        }));

        setData(mapped);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to fetch active trade logistics');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    let result = [...data];

    if (statusFilter !== 'all') {
      result = result.filter((r) => r.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        r.crop_type?.toLowerCase().includes(q) ||
        r.farm_location?.toLowerCase().includes(q) ||
        r.users?.full_name?.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      const aVal = sortField === 'quantity_kg' ? Number(a.quantity_kg) : new Date(a.created_at).getTime();
      const bVal = sortField === 'quantity_kg' ? Number(b.quantity_kg) : new Date(b.created_at).getTime();
      return sortAsc ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [data, statusFilter, search, sortField, sortAsc]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (field: 'created_at' | 'quantity_kg') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  if (loading) return <TableSkeleton rows={8} />;

  if (error) {
    return (
      <div className="card p-6 border border-red-500/30 bg-red-500/10">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle size={18} />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden border border-border">
      {/* Header with filters */}
      <div className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between bg-background-secondary/40">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-agri-primary/10">
            <ClipboardList size={18} className="text-agri-primary-light" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Global Trade Logistics (`trade_requests`)</h3>
            <p className="text-xs text-foreground-dim">{filtered.length} active trade &amp; harvest records</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-dim" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search trade orders..."
              className="input w-40 pl-9 text-sm"
            />
          </div>
          <div className="relative flex items-center gap-1">
            <Filter size={14} className="text-foreground-dim" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as HarvestStatus | 'all'); setPage(0); }}
              className="input w-32 text-sm appearance-none"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="matched">Matched</option>
              <option value="in_transit">In Transit</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>User / Farmer</th>
              <th>Commodity Variety</th>
              <th>
                <button onClick={() => toggleSort('quantity_kg')} className="flex items-center gap-1 font-bold text-foreground">
                  Quantity <ArrowUpDown size={12} />
                </button>
              </th>
              <th>Address / Hub</th>
              <th>Trade Status</th>
              <th>
                <button onClick={() => toggleSort('created_at')} className="flex items-center gap-1 font-bold text-foreground">
                  Date <ArrowUpDown size={12} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {paged.map((row) => (
              <tr key={row.id}>
                <td className="font-medium text-foreground">{row.users?.full_name || 'Anonymous User'}</td>
                <td className="font-bold">{row.crop_type}</td>
                <td className="text-agri-primary-light font-semibold">{Number(row.quantity_kg).toLocaleString()} kg</td>
                <td className="text-foreground-muted text-xs truncate max-w-[150px]">{row.farm_location}</td>
                <td><span className={statusBadgeClass[row.status] || 'badge badge-pending'}>{statusLabel[row.status] || row.status}</span></td>
                <td className="text-xs text-foreground-dim">{row.created_at ? format(new Date(row.created_at), 'MMM d, yyyy') : 'Recent'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-6 py-3">
          <span className="text-xs text-foreground-dim">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="btn btn-secondary btn-sm"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="btn btn-secondary btn-sm"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
