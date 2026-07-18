import { create } from 'zustand';
import { createClient } from '../lib/supabase/client';
import { Database } from '../lib/database.types';

type Profile = Database['public']['Tables']['users']['Row'];

interface AuthState {
  user: { id: string; email?: string } | null;
  profile: Profile | null;
  isLoading: boolean;
  isInitialized: boolean;
  fetchProfileCounter: number;
  
  setUser: (user: { id: string; email?: string } | null) => void;
  fetchProfile: (authUid: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  isInitialized: false,
  fetchProfileCounter: 0,

  setUser: (user) => set({ user }),

  fetchProfile: async (authUid) => {
    // Monotonically increasing counter to prevent race conditions on stale profile reads
    const currentCounter = get().fetchProfileCounter + 1;
    set({ fetchProfileCounter: currentCounter, isLoading: true });

    const supabase = createClient();
    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_uid', authUid)
      .single();

    // If a newer fetch has started since this one began, discard these results silently
    if (get().fetchProfileCounter !== currentCounter) {
      return;
    }

    if (error) {
      console.error('Failed to fetch profile:', error);
      set({ profile: null, isLoading: false });
      return;
    }

    set({ profile, isLoading: false });
  },

  signOut: async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    set({ user: null, profile: null });
  },

  initialize: async () => {
    if (get().isInitialized) return;
    
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      set({ user: { id: session.user.id, email: session.user.email } });
      await get().fetchProfile(session.user.id);
    } else {
      set({ isLoading: false });
    }
    
    set({ isInitialized: true });
    
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        set({ user: { id: session.user.id, email: session.user.email } });
        await get().fetchProfile(session.user.id);
      } else {
        set({ user: null, profile: null, isLoading: false });
      }
    });
  }
}));
