import { create } from 'zustand';
import { supabase } from '@/lib/supabaseClient';
import { normalizeNigerianPhone, type UserProfile, type UserRole } from '@/lib/types';
import type { Session, User } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  needsPhoneLinking: boolean;
  loading: boolean;
  initialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phoneNumber: string,
    role: UserRole
  ) => Promise<{ error: string | null }>;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null }>;
  linkAuthUidToPhone: (phoneNumber: string) => Promise<{ error: string | null }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  needsPhoneLinking: false,
  loading: true,
  initialized: false,

  initialize: async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        set({ session, user: session.user });
        await get().fetchProfile(session.user.id);
      }

      // Listen for auth state changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        set({ session, user: session?.user ?? null });

        if (event === 'SIGNED_IN' && session?.user) {
          await get().fetchProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          set({ profile: null, needsPhoneLinking: false });
        }
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
    } finally {
      set({ loading: false, initialized: true });
    }
  },

  signUp: async (email, password, fullName, phoneNumber, role) => {
    set({ loading: true });
    try {
      const normalizedPhone = normalizeNigerianPhone(phoneNumber);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone_number: normalizedPhone,
            role,
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        // Insert directly into public.users with auth_uid matching auth.uid()
        const { error: insertErr } = await supabase.from('users').insert({
          auth_uid: data.user.id,
          full_name: fullName,
          phone_number: normalizedPhone,
          declared_profession: role || 'farmer',
          has_registered_device: false,
          verification_status: 'verified',
        });

        if (insertErr) {
          console.warn('Profile insert note:', insertErr.message);
        }

        await get().fetchProfile(data.user.id);
      }

      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'An unexpected error occurred during sign up.' };
    } finally {
      set({ loading: false });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, needsPhoneLinking: false });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        set({ loading: false });
        return { error: error.message };
      }

      if (data.user) {
        await get().fetchProfile(data.user.id);
      }

      set({ loading: false });
      return { error: null };
    } catch (err: unknown) {
      set({ loading: false });
      return { error: err instanceof Error ? err.message : 'An unexpected error occurred during sign in.' };
    } finally {
      set({ loading: false });
    }
  },

  // ProfileGatePage equivalent: self-healing auth_uid link when matched by canonical OR local phone number
  linkAuthUidToPhone: async (phoneNumber: string) => {
    const { user } = get();
    if (!user) return { error: 'No active authentication session found.' };

    set({ loading: true });
    try {
      const canonical = normalizeNigerianPhone(phoneNumber);
      const rawTrimmed = phoneNumber.trim().replace(/\s+/g, '');
      const localFormat = canonical.startsWith('+234') ? '0' + canonical.substring(4) : rawTrimmed;

      const { data: matchedRows, error: searchError } = await supabase
        .from('users')
        .select('*')
        .or(`phone_number.eq.${canonical},phone_number.eq.${localFormat},phone_number.eq.${rawTrimmed}`)
        .limit(1);

      if (searchError || !matchedRows || matchedRows.length === 0) {
        return { error: `No profile found matching phone number ${phoneNumber}. Please verify and try again.` };
      }

      const targetRow = matchedRows[0];

      const { error: updateError } = await supabase
        .from('users')
        .update({ auth_uid: user.id })
        .eq('id', targetRow.id);

      if (updateError) {
        return { error: `Failed to link account: ${updateError.message}` };
      }

      set({ profile: { ...targetRow, auth_uid: user.id }, needsPhoneLinking: false });
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'An error occurred linking your phone.' };
    } finally {
      set({ loading: false });
    }
  },

  updateProfile: async (updates) => {
    const { profile } = get();
    if (!profile) return { error: 'No profile loaded.' };

    try {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', profile.id);

      if (error) return { error: error.message };

      set({ profile: { ...profile, ...updates } });
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Failed to update profile' };
    }
  },

  signOut: async () => {
    set({ loading: true });
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('yieldflow_active_role');
      }
      await supabase.auth.signOut();
    } finally {
      set({
        session: null,
        user: null,
        profile: null,
        needsPhoneLinking: false,
        loading: false,
      });
    }
  },

  fetchProfile: async (userId: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      // 1. Query by auth_uid first
      let { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_uid', userId)
        .abortSignal(controller.signal)
        .maybeSingle();

      clearTimeout(timeoutId);

      // 2. If not found by auth_uid, fallback to checking id directly (in case id == auth_uid)
      if (!data && !error) {
        const fallback = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        data = fallback.data;
        error = fallback.error;
      }

      if (!data) {
        set({ profile: null, needsPhoneLinking: true });
        return;
      }

      set({ profile: data as UserProfile, needsPhoneLinking: false });
    } catch (err) {
      console.error('Error fetching profile:', err);
      set({ profile: null, needsPhoneLinking: true });
    }
  },
}));
