'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { useAuthStore } from '@/store/authStore';
import { updateProfile, deleteUserAccount } from '@/lib/actions/account';
import { Loader2, User, Mail, Shield, AlertTriangle, Trash2, LogOut, CheckCircle, Lock } from 'lucide-react';

const GENDER_OPTIONS = ['Male', 'Female', 'Prefer not to say'];
const MACRO_REGIONS = ['North', 'South', 'East', 'West', 'Central'];

export default function ProfileSettingsPage() {
  const { user, profile, fetchProfile, signOut } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Form State
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState('');
  const [macroRegion, setMacroRegion] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  // Delete Account Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmedCheckbox, setConfirmedCheckbox] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhoneNumber(profile.phone_number || '');
      setAge(profile.age ? String(profile.age) : '');
      setGender(profile.gender || '');
      setMacroRegion(profile.macro_region || '');
    }
  }, [profile]);

  // Open delete modal if ?action=delete in query string
  useEffect(() => {
    if (searchParams.get('action') === 'delete') {
      setShowDeleteModal(true);
    }
  }, [searchParams]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    setSaveSuccess('');

    const res = await updateProfile({
      fullName,
      phoneNumber,
      age: age ? parseInt(age, 10) : undefined,
      gender,
      macroRegion,
    });

    setSaving(false);

    if (res.error) {
      setSaveError(res.error);
    } else {
      setSaveSuccess('Profile updated successfully.');
      if (user?.id) {
        await fetchProfile(user.id);
      }
      setTimeout(() => setSaveSuccess(''), 4000);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleting(true);
    setDeleteError('');

    const res = await deleteUserAccount({
      confirmationText,
      confirmedCheckbox,
      currentPassword,
    });

    setDeleting(false);

    if (res.error) {
      setDeleteError(res.error);
    } else {
      // Account deleted successfully on server
      await signOut();
      router.push('/');
    }
  };

  if (!profile) {
    return (
      <PageContainer>
        <div className="flex justify-center p-12">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Profile & Account Settings</h1>
          <p className="opacity-70 mt-1">Manage your account information and preferences.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="text-gray-300 border border-white/10">
          <LogOut size={14} className="mr-1" /> Sign Out
        </Button>
      </div>

      {saveError && <Alert variant="error" className="mb-4">{saveError}</Alert>}
      {saveSuccess && <Alert variant="success" className="mb-4">{saveSuccess}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="col-span-1 lg:col-span-2">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <User size={20} className="text-primary" /> Personal Information
          </h2>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            {/* Read-Only Non-Editable Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-black/20 rounded-xl border border-white/10 mb-4">
              <div>
                <label className="text-xs font-semibold opacity-60 block mb-1 flex items-center gap-1">
                  <Mail size={12} /> Registered Email Address
                </label>
                <div className="font-mono text-sm opacity-90">{user?.email || 'N/A'}</div>
              </div>
              <div>
                <label className="text-xs font-semibold opacity-60 block mb-1 flex items-center gap-1">
                  <Shield size={12} /> Declared Role (Permanent)
                </label>
                <div className="font-bold text-sm text-primary flex items-center gap-1">
                  {profile.declared_profession} <Lock size={12} className="opacity-50" />
                </div>
              </div>
            </div>

            {/* Editable Profile Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Full Name</label>
                <Input
                  value={fullName}
                  onChange={(e: any) => setFullName(e.target.value)}
                  required
                  placeholder="e.g. John Doe"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Phone Number</label>
                <Input
                  value={phoneNumber}
                  onChange={(e: any) => setPhoneNumber(e.target.value)}
                  required
                  placeholder="e.g. 08012345678"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Age (Optional)</label>
                <Input
                  type="number"
                  min="18"
                  max="120"
                  value={age}
                  onChange={(e: any) => setAge(e.target.value)}
                  placeholder="e.g. 35"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Gender (Optional)</label>
                <Select value={gender} onChange={(e: any) => setGender(e.target.value)}>
                  <option value="">-- Select --</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </Select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-1 block">Macro Region (Optional)</label>
                <Select value={macroRegion} onChange={(e: any) => setMacroRegion(e.target.value)}>
                  <option value="">-- Select Region --</option>
                  {MACRO_REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-white/10">
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <CheckCircle size={16} className="mr-2" />}
                Save Changes
              </Button>
            </div>
          </form>
        </Card>

        {/* Account Security & Danger Zone Card */}
        <Card className="col-span-1 border-red-500/20 bg-red-950/10 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold mb-3 text-red-400 flex items-center gap-2">
              <AlertTriangle size={20} /> Account Danger Zone
            </h2>
            <p className="text-xs opacity-75 leading-relaxed mb-6">
              Account deletion is permanent. Once completed, your registered profile, farms, crops, predictions, bids, devices, and activity logs will be permanently removed.
            </p>
          </div>

          <div className="pt-4 border-t border-red-500/20">
            <Button
              variant="ghost"
              className="w-full text-red-400 hover:bg-red-500/20 border border-red-500/30 justify-center"
              onClick={() => setShowDeleteModal(true)}
            >
              <Trash2 size={16} className="mr-2" /> Delete Account
            </Button>
          </div>
        </Card>
      </div>

      {/* ── Permanent Delete Account Modal ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4 sm:p-6 overflow-y-auto">
          <Card className="w-full max-w-lg border-red-500/30 bg-slate-950 text-white my-8">
            <div className="flex items-center gap-3 mb-4 text-red-400">
              <AlertTriangle size={24} className="flex-shrink-0" />
              <h2 className="text-xl font-bold text-red-400">Permanently Delete Account</h2>
            </div>

            <div className="text-xs opacity-80 space-y-2 mb-6 p-4 bg-red-950/20 rounded-xl border border-red-500/20">
              <p className="font-semibold text-red-300">Warning: This action cannot be reversed.</p>
              <p>Deleting your account will permanently purge:</p>
              <ul className="list-disc list-inside space-y-1 opacity-90 pl-1">
                <li>Your personal profile and registered user records</li>
                <li>All registered farms and crop allocations</li>
                <li>Farm activity logs, predictions, and digital journal records</li>
                <li>Owned IoT devices and telemetry data</li>
                <li>Bids placed or received and negotiation history</li>
                <li>Disposable trade requests and logistics history</li>
                <li>Supabase Authentication access and credentials</li>
              </ul>
            </div>

            {deleteError && <Alert variant="error" className="mb-4">{deleteError}</Alert>}

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Current Password (Re-authentication)</label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e: any) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">
                  To confirm, type <span className="font-mono font-bold text-red-400 select-all">DELETE MY ACCOUNT</span> below:
                </label>
                <Input
                  value={confirmationText}
                  onChange={(e: any) => setConfirmationText(e.target.value)}
                  placeholder="DELETE MY ACCOUNT"
                  required
                />
              </div>

              <div className="flex items-start gap-2 pt-2">
                <input
                  type="checkbox"
                  id="confirmCheck"
                  checked={confirmedCheckbox}
                  onChange={(e) => setConfirmedCheckbox(e.target.checked)}
                  className="mt-1 rounded bg-white/10 border-white/20 text-red-500 focus:ring-red-500"
                  required
                />
                <label htmlFor="confirmCheck" className="text-xs opacity-90 cursor-pointer select-none">
                  I understand that deleting my account is permanent and all my data will be permanently purged.
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="bg-red-600 hover:bg-red-700 border-red-600 font-bold"
                  disabled={deleting || !confirmedCheckbox || confirmationText.trim() !== 'DELETE MY ACCOUNT'}
                >
                  {deleting ? <Loader2 size={16} className="animate-spin mr-2" /> : <Trash2 size={16} className="mr-2" />}
                  Delete Permanently
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
