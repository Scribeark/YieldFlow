'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';
import { Database } from '../../lib/database.types';
import { useAuthStore } from '../../store/authStore';
import { ROLES, ROLE_ROUTES, UserRole } from '../../lib/constants';

export default function SignupPage() {
  const router = useRouter();
  const { fetchProfile } = useAuthStore();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone_number: '',
    declared_profession: ROLES.FARMER as UserRole,
    age: '',
    gender: 'Male',
    macro_region: 'North'
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    
    // 1. Authenticate through Supabase
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
      setError('Signup failed to return a user session.');
      setIsLoading(false);
      return;
    }

    // 2. Insert into users table linking to auth.uid
    const insertPayload: Database['public']['Tables']['users']['Insert'] = {
      auth_uid: authData.user.id,
      full_name: formData.full_name,
      phone_number: formData.phone_number,
      declared_profession: formData.declared_profession,
      age: parseInt(formData.age, 10),
      gender: formData.gender,
      macro_region: formData.macro_region,
      verification_status: 'pending'
    };

    const { error: dbError } = await supabase.from('users').insert(insertPayload);

    if (dbError) {
      setError(`Database profile creation failed: ${dbError.message}. Your auth account was created but profile is missing.`);
      setIsLoading(false);
      return;
    }

    // 3. Fetch the confirmed profile directly into the store
    await fetchProfile(authData.user.id);
    
    // 4. Derive correct destination from the specific chosen role
    const destination = ROLE_ROUTES[formData.declared_profession];
    router.push(destination);
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create an Account</h1>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input required type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input required type="password" name="password" value={formData.password} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input required type="text" name="full_name" value={formData.full_name} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input required type="tel" name="phone_number" value={formData.phone_number} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select required name="declared_profession" value={formData.declared_profession} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900">
              <option value={ROLES.FARMER}>Smallholder Farmer</option>
              <option value={ROLES.TRADER}>Commodity Trader</option>
              <option value={ROLES.CARRIER}>Logistics Carrier</option>
              <option value={ROLES.BUYER}>Enterprise Buyer</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">Note: Your role is permanent and cannot be changed later.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
              <input required type="number" min="18" max="120" name="age" value={formData.age} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select required name="gender" value={formData.gender} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900">
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
            <select required name="macro_region" value={formData.macro_region} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900">
              <option value="North">North</option>
              <option value="South">South</option>
              <option value="East">East</option>
              <option value="West">West</option>
              <option value="Central">Central</option>
            </select>
          </div>
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-green-700 text-white font-bold py-2 px-4 rounded hover:bg-green-800 transition disabled:opacity-50"
          >
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>
      </div>
    </div>
  );
}
