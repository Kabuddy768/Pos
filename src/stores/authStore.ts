import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/lib/types';

interface AuthState {
  user: any | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string, role: 'admin' | 'seller') => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  loading: true,
  error: null,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        set({ user: session.user });

        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (error) throw error;
        if (profileData) {
          set({ profile: profileData });
        }
      }
    } catch (err) {
      console.error('Auth initialization error:', err);
      set({ error: 'Failed to initialize authentication' });
    } finally {
      set({ loading: false });
    }
  },

  login: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        set({ user: data.user });

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profileData) {
          set({ profile: profileData });
        }
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed';
      set({ error: errorMessage });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  signup: async (email: string, password: string, fullName: string, role: 'admin' | 'seller') => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([{
            id: data.user.id,
            full_name: fullName,
            email,
            role,
            is_active: true,
          }]);

        if (profileError) throw profileError;

        set({ user: data.user, profile: {
          id: data.user.id,
          full_name: fullName,
          email,
          role,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }});
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Signup failed';
      set({ error: errorMessage });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      set({ user: null, profile: null });
    } catch (err: any) {
      const errorMessage = err.message || 'Logout failed';
      set({ error: errorMessage });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
