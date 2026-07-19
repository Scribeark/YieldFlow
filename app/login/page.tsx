'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';
import { useAuthStore } from '../../store/authStore';
import { ROLE_ROUTES } from '../../lib/constants';

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
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Log In</h1>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input required type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input required type="password" name="password" value={formData.password} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white" />
          </div>
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-green-700 text-white font-bold py-2 px-4 rounded hover:bg-green-800 transition disabled:opacity-50"
          >
            {isLoading ? 'Logging In...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}
