'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';
import { useAuthStore } from '../../store/authStore';
import { ROLE_ROUTES } from '../../lib/constants';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export default function LoginPage() {
  const router = useRouter();
  const { fetchProfile } = useAuthStore();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    
    // 1. Authenticate through Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    });

    if (authError) {
      setError(authError.message);
      setIsLoading(false);
      return;
    }

    if (!authData.user) {
      setError('Login failed to return a user session.');
      setIsLoading(false);
      return;
    }

    // 2. Fetch the profile to confirm a profile row actually exists
    await fetchProfile(authData.user.id);
    
    // We must read the freshest profile from the store directly, or from the supabase query locally
    // to avoid React state lag. Let's do a direct fetch just to route cleanly, or use the store's state.
    // Zustand's getState() allows us to read outside of React reactivity:
    const currentProfile = useAuthStore.getState().profile;
    
    if (!currentProfile) {
      setError('Authentication succeeded, but no user profile row exists. Please contact support or sign up.');
      await supabase.auth.signOut();
      setIsLoading(false);
      return;
    }

    // 3. Derive destination from confirmed declared_profession
    const destination = ROLE_ROUTES[currentProfile.declared_profession];
    router.push(destination);
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4 animate-scale-in">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--foreground)' }}>Log In</h1>
        
        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <Label>Email</Label>
            <Input required type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="Enter your email" />
          </div>
          <div>
            <Label>Password</Label>
            <Input required type="password" name="password" value={formData.password} onChange={handleInputChange} placeholder="Enter your password" />
          </div>
          
          <Button 
            type="submit" 
            isLoading={isLoading}
            className="w-full mt-4"
          >
            Log In
          </Button>
        </form>
      </Card>
    </div>
  );
}
