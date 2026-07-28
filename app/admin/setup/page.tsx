'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { checkHasAdmin, bootstrapFirstAdmin } from '@/lib/actions/admin';

export default function AdminSetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasAdmin, setHasAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone_number: '',
    password: '',
    setupCode: ''
  });

  useEffect(() => {
    async function verifyStatus() {
      const exists = await checkHasAdmin();
      setHasAdmin(exists);
      setChecking(false);
    }
    verifyStatus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await bootstrapFirstAdmin(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <PageContainer>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="animate-pulse text-xl">Verifying system state...</div>
        </div>
      </PageContainer>
    );
  }

  if (hasAdmin) {
    return (
      <PageContainer>
        <div className="flex justify-center items-center min-h-[60vh]">
          <Card className="max-w-md w-full text-center p-8 border-red-500/50 bg-red-500/5">
            <ShieldAlert size={48} className="mx-auto text-red-500 mb-4" />
            <h1 className="text-2xl font-bold text-red-500 mb-2">Bootstrap Disabled</h1>
            <p className="opacity-80">
              An administrator account has already been provisioned on this platform. 
              The public bootstrap flow is permanently disabled for security.
            </p>
            <Button className="mt-6" onClick={() => router.push('/login')}>Return to Login</Button>
          </Card>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex justify-center items-center min-h-[80vh]">
        <Card className="max-w-md w-full p-8 border-[var(--agri-primary)] bg-[var(--agri-primary)]/5">
          <div className="text-center mb-6">
            <ShieldCheck size={48} className="mx-auto text-[var(--agri-primary)] mb-4" />
            <h1 className="text-2xl font-bold">Platform Admin Setup</h1>
            <p className="opacity-80 text-sm mt-2">Provision the first administrator account.</p>
          </div>

          {error && <Alert variant="error" title="Setup Failed" className="mb-4">{error}</Alert>}
          
          {success ? (
            <Alert variant="success" title="Admin Provisioned" className="mb-4">
              The platform administrator has been created successfully. Redirecting to login...
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input required value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} placeholder="Admin Name" />
              </div>
              <div>
                <Label>Email</Label>
                <Input required type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="admin@platform.com" />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input required value={formData.phone_number} onChange={(e) => setFormData({...formData, phone_number: e.target.value})} placeholder="+234..." />
              </div>
              <div>
                <Label>Password</Label>
                <Input required type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} placeholder="Secure password" />
              </div>
              <div className="pt-4 border-t border-white/10">
                <Label className="text-[var(--agri-primary)]">Admin Bootstrap Secret</Label>
                <Input required type="password" value={formData.setupCode} onChange={(e) => setFormData({...formData, setupCode: e.target.value})} placeholder="Enter server setup code" />
              </div>
              
              <Button type="submit" variant="primary" className="w-full mt-6" disabled={loading}>
                {loading ? 'Provisioning...' : 'Secure Provision'}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
