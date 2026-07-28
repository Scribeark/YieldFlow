'use client';

import React, { useState, useEffect } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Users, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import { getAdminUsersList, promoteUserToAdmin, demoteUserFromAdmin } from '@/lib/actions/admin';
import { useAuthStore } from '@/store/authStore';

export default function AdminUsersPage() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionMessage, setActionMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await getAdminUsersList(searchQuery);
    if (data) {
      setUsers(data);
    } else if (error) {
      setActionMessage({ type: 'error', text: error });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const handlePromote = async (userId: string) => {
    setActionMessage(null);
    const res = await promoteUserToAdmin(userId);
    if (res.error) {
      setActionMessage({ type: 'error', text: res.error });
    } else {
      setActionMessage({ type: 'success', text: 'User successfully promoted to Platform Admin.' });
      fetchUsers();
    }
  };

  const handleDemote = async (userId: string) => {
    setActionMessage(null);
    const res = await demoteUserFromAdmin(userId);
    if (res.error) {
      setActionMessage({ type: 'error', text: res.error });
    } else {
      setActionMessage({ type: 'success', text: 'Admin successfully demoted to standard user.' });
      fetchUsers();
    }
  };

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center">
          <Users className="mr-3 text-[var(--agri-primary)]" size={32} /> 
          User Management
        </h1>
        <p className="opacity-70 mt-2">Search platform users and manage administrative access privileges.</p>
      </div>

      {actionMessage && (
        <Alert variant={actionMessage.type} title={actionMessage.type === 'success' ? 'Success' : 'Error'} className="mb-6">
          {actionMessage.text}
        </Alert>
      )}

      <Card className="mb-6">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1">
            <Input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or phone number..." 
              className="w-full"
            />
          </div>
          <Button type="submit" variant="primary" className="flex items-center">
            <Search size={16} className="mr-2" /> Search
          </Button>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-white/10 text-xs uppercase">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Marketplace Role</th>
                <th className="px-6 py-4">System Role</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center opacity-60">
                    <div className="animate-pulse">Loading users...</div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center opacity-60">
                    No users found matching your search.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-6 py-4">
                      <div className="font-bold">{u.full_name}</div>
                      <div className="text-xs opacity-60">{u.phone_number}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-white/10 px-2 py-1 rounded text-xs">
                        {u.declared_profession}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {u.app_role === 'admin' ? (
                        <span className="flex items-center text-green-400 font-bold text-xs">
                          <ShieldCheck size={14} className="mr-1" /> Admin
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs uppercase tracking-wider">
                          Standard User
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {u.app_role === 'admin' ? (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDemote(u.id)}
                          disabled={u.id === user?.id}
                          className={u.id === user?.id ? 'opacity-50' : 'text-red-400 hover:text-red-300 hover:bg-red-500/10'}
                        >
                          <ShieldAlert size={14} className="mr-2" /> Revoke Admin
                        </Button>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handlePromote(u.id)}
                          className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                        >
                          <ShieldCheck size={14} className="mr-2" /> Make Admin
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </PageContainer>
  );
}
