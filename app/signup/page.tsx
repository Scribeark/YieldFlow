'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';
import { Database } from '../../lib/database.types';
import { useAuthStore } from '../../store/authStore';
import { ROLES, ROLE_ROUTES, UserRole } from '../../lib/constants';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Select } from '@/components/ui/Select';
import { adminSignup } from '@/lib/actions/admin';

export default function SignupPage() {
  const router = useRouter();
  const { fetchProfile } = useAuthStore();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone_number: '',
    declared_profession: ROLES.FARMER as UserRole | 'Admin',
    age: '',
    gender: 'Male',
    macro_region: 'North',
    admin_setup_code: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isAdminMode = formData.declared_profession === 'Admin';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = createClient();

      if (isAdminMode) {
        // Admin Signup Flow
        const res = await adminSignup({
          email: formData.email,
          password: formData.password,
          fullName: formData.full_name,
          setupCode: formData.admin_setup_code
        });

        if (res.error) {
          setError(res.error);
          setIsLoading(false);
          return;
        }

        // After successful creation by server, log them in client-side
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (signInErr) {
          setSuccess("Admin account created! Please log in manually.");
          setIsLoading(false);
          setTimeout(() => router.push('/login'), 2000);
          return;
        }
        
        // Logged in successfully, route to admin dashboard
        router.push('/dashboard/admin');
        return;
      }
      
      // 1. Normal Authenticate through Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) {
        setError(authError.message);
        setIsLoading(false);
        return;
      }

      if (!authData.user) {
        setError('Signup failed to return a user session. Please check if email confirmation is required.');
        setIsLoading(false);
        return;
      }

      // 2. Insert into users table linking to auth.uid
      const insertPayload: Database['public']['Tables']['users']['Insert'] = {
        auth_uid: authData.user.id,
        full_name: formData.full_name,
        phone_number: formData.phone_number,
        declared_profession: formData.declared_profession as any,
        age: parseInt(formData.age, 10),
        gender: formData.gender,
        macro_region: formData.macro_region,
        verification_status: 'pending'
      };

      const { error: dbError } = await supabase.from('users').insert(insertPayload);

      if (dbError) {
        setError(`Database profile creation failed: ${dbError.message}. Auth account created but profile is missing.`);
        setIsLoading(false);
        return;
      }

      // 3. Fetch the confirmed profile directly into the store
      try {
        await fetchProfile(authData.user.id);
      } catch (fetchErr: unknown) {
        console.error("fetchProfile failed:", fetchErr);
        const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        setError(`Profile created but fetch failed: ${errMsg}. Try logging in manually.`);
        setIsLoading(false);
        return;
      }
      
      // 4. Derive correct destination from the specific chosen role
      const destination = ROLE_ROUTES[formData.declared_profession as UserRole];
      if (!destination) {
        setError(`Invalid role selected. Could not determine dashboard destination.`);
        setIsLoading(false);
        return;
      }

      router.push(destination);
    } catch (err: unknown) {
      console.error("Unexpected signup error:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(`Unexpected error during signup: ${errMsg}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4 animate-scale-in">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--foreground)' }}>Create an Account</h1>
        
        {error && <Alert variant="error" className="mb-4">{error}</Alert>}
        {success && <Alert variant="success" className="mb-4">{success}</Alert>}

        <form onSubmit={handleSignup} className="space-y-5">
          <div>
            <Label>Role</Label>
            <Select required name="declared_profession" value={formData.declared_profession} onChange={handleInputChange}>
              <option value={ROLES.FARMER}>Smallholder Farmer</option>
              <option value={ROLES.TRADER}>Commodity Trader</option>
              <option value={ROLES.CARRIER}>Logistics Carrier</option>
              <option value={ROLES.BUYER}>Enterprise Buyer</option>
              <option value="Admin">Platform Admin</option>
            </Select>
            <p className="mt-1 text-xs" style={{ color: 'var(--foreground-dim)' }}>Note: Your role is permanent and cannot be changed later.</p>
          </div>

          <div>
            <Label>Full Name</Label>
            <Input required type="text" name="full_name" value={formData.full_name} onChange={handleInputChange} placeholder="Enter your full name" />
          </div>
          <div>
            <Label>Email</Label>
            <Input required type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="Enter your email" />
          </div>
          <div>
            <Label>Password</Label>
            <Input required type="password" name="password" value={formData.password} onChange={handleInputChange} placeholder="Choose a password" />
          </div>

          {!isAdminMode && (
            <>
              <div>
                <Label>Phone Number</Label>
                <Input required type="tel" name="phone_number" value={formData.phone_number} onChange={handleInputChange} placeholder="Enter your phone number" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Age</Label>
                  <Input required type="number" min="18" max="120" name="age" value={formData.age} onChange={handleInputChange} placeholder="e.g. 35" />
                </div>
                <div>
                  <Label>Gender</Label>
                  <Select required name="gender" value={formData.gender} onChange={handleInputChange}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Region</Label>
                <Select required name="macro_region" value={formData.macro_region} onChange={handleInputChange}>
                  <option value="North">North</option>
                  <option value="South">South</option>
                  <option value="East">East</option>
                  <option value="West">West</option>
                  <option value="Central">Central</option>
                </Select>
              </div>
            </>
          )}

          {isAdminMode && (
            <div className="pt-4 border-t border-white/10">
              <Label className="text-[var(--agri-primary)] flex items-center">
                Admin Setup Key
              </Label>
              <Input required type="password" name="admin_setup_code" value={formData.admin_setup_code} onChange={handleInputChange} placeholder="Enter secret admin key" />
              <p className="text-xs mt-1 text-red-400">Restricted access. Incorrect keys will be rejected.</p>
            </div>
          )}
          
          <Button 
            type="submit" 
            isLoading={isLoading}
            className="w-full mt-4"
          >
            {isAdminMode ? 'Register as Admin' : 'Sign Up'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

