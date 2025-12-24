import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/lib/types';

interface AuthState {
  user: any | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
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

        if (error) {
          console.error('Profile fetch error:', error);
          throw error;
        }
        
        if (profileData) {
          set({ profile: profileData });
        } else {
          console.warn('No profile found for user:', session.user.id);
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
      console.log('Attempting login for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error);
        
        // Provide user-friendly error messages
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        } else if (error.message.includes('Email not confirmed')) {
          throw new Error('Please confirm your email address before logging in.');
        } else {
          throw new Error(error.message);
        }
      }

      if (data.user) {
        console.log('Login successful for user:', data.user.id);
        set({ user: data.user });

        // Fetch profile with better error handling
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profileError) {
          console.error('Profile fetch error:', profileError);
          throw new Error('Failed to load user profile. Please contact support.');
        }

        if (!profileData) {
          throw new Error('User profile not found. Please contact support to complete your account setup.');
        }

        console.log('Profile loaded:', profileData);
        set({ profile: profileData });
      }
    } catch (err: any) {
      console.error('Login process error:', err);
      const errorMessage = err.message || 'Login failed. Please try again.';
      set({ error: errorMessage });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    set({ loading: true, error: null });
    try {
      console.log('Logging out...');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
        throw error;
      }
      set({ user: null, profile: null });
      console.log('Logout successful');
    } catch (err: any) {
      console.error('Logout process error:', err);
      const errorMessage = err.message || 'Logout failed';
      set({ error: errorMessage });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));