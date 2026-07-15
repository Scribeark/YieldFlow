'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { UserProfile, UserRole } from '@/lib/types';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { Users, Search, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const roleBadge: Record<UserRole, string> = {
  farmer: 'badge badge-completed',
  carrier: 'badge badge-in-transit',
  admin: 'badge badge-matched',
};

export default function UserGrid() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filtered, setFiltered] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });

        if (fetchError) throw new Error(fetchError.message);
        setUsers((data as UserProfile[]) || []);
        setFiltered((data as UserProfile[]) || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to fetch users');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(users);
    } else {
      const q = search.toLowerCase();
      setFiltered(users.filter((u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.phone_number?.toLowerCase().includes(q) ||
        (u.declared_profession || u.role || '').toLowerCase().includes(q)
      ));
    }
  }, [search, users]);

  if (loading) return <TableSkeleton rows={5} />;

  if (error) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle size={18} />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-status-matched/10">
            <Users size={18} className="text-status-matched" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Platform Users</h3>
            <p className="text-xs text-foreground-dim">{filtered.length} of {users.length} users</p>
          </div>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="input w-48 pl-9 text-sm"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => {
              const userRole = user.declared_profession || user.role || 'farmer';
              return (
                <tr key={user.id}>
                  <td className="font-medium text-foreground">{user.full_name || 'Anonymous User'}</td>
                  <td className="text-foreground-muted">{user.phone_number || '—'}</td>
                  <td><span className={roleBadge[userRole] || 'badge bg-background-elevated text-foreground-dim border border-border'}>{userRole}</span></td>
                  <td className="text-sm text-foreground-dim">
                    {user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
