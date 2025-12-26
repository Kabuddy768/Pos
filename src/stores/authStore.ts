import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/lib/types';
import {
  createAppError,
  logError,
  getUserFriendlyMessage,
  isErrorCategory,
  ErrorCategory,
} from '@/utils/errorHandling';

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

export const useAuthStore = create<AuthState>((set, _get) => ({
  user: null,
  profile: null,
  loading: true,
  error: null,

  initialize: async () => {
    try {
      set({ loading: true, error: null });

      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        set({ user: session.user });

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileError) {
          const appError = createAppError(profileError, {
            action: 'initialize',
            userId: session.user.id,
          });
          logError(appError);
          throw profileError;
        }
        
        if (profileData) {
          set({ profile: profileData });
        } else {
          console.warn('No profile found for user:', session.user.id);
          set({ 
            error: 'User profile not found. Please contact support.',
            user: null 
          });
        }
      }
    } catch (err: any) {
      const appError = createAppError(err, {
        action: 'initialize',
        component: 'authStore',
      });
      logError(appError);
      set({ error: getUserFriendlyMessage(err) });
    } finally {
      set({ loading: false });
    }
  },

  login: async (email: string, password: string) => {
    set({ loading: true, error: null });
    
    try {
      console.log('Attempting login for:', email);
      
      // Validate inputs
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        const appError = createAppError(authError, {
          action: 'login',
          email,
        });
        logError(appError);

        // Provide user-friendly error messages
        if (isErrorCategory(authError, ErrorCategory.AUTHENTICATION)) {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        } else if (authError.message?.includes('Email not confirmed')) {
          throw new Error('Please confirm your email address before logging in.');
        } else {
          throw new Error(getUserFriendlyMessage(authError));
        }
      }

      if (!data.user) {
        throw new Error('Login failed. Please try again.');
      }

      console.log('Login successful for user:', data.user.id);
      set({ user: data.user });

      // Fetch profile with retry logic
      let retries = 3;
      let profileData = null;
      let profileError = null;

      while (retries > 0 && !profileData) {
        const result = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        profileData = result.data;
        profileError = result.error;

        if (profileError) {
          const appError = createAppError(profileError, {
            action: 'login',
            step: 'fetchProfile',
            userId: data.user.id,
            retriesLeft: retries,
          });
          logError(appError);

          retries--;
          if (retries > 0) {
            console.warn(`Profile fetch failed, retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } else if (profileData) {
          break;
        } else {
          retries--;
          if (retries > 0) {
            console.warn(`Profile not ready, retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      }

      if (profileError && !profileData) {
        const appError = createAppError(profileError, {
          action: 'login',
          step: 'fetchProfile',
          userId: data.user.id,
          allRetriesFailed: true,
        });
        logError(appError);
        throw new Error('Failed to load user profile. Please try logging in again.');
      }

      if (!profileData) {
        const error = new Error('User profile not found');
        const appError = createAppError(error, {
          action: 'login',
          userId: data.user.id,
          profileMissing: true,
        });
        logError(appError);
        throw new Error('User profile not found. Please contact support to complete your account setup.');
      }

      console.log('Profile loaded:', profileData);
      set({ profile: profileData, error: null });

    } catch (err: any) {
      const appError = createAppError(err, {
        action: 'login',
        component: 'authStore',
      });
      logError(appError);

      const errorMessage = err.message || getUserFriendlyMessage(err);
      set({ error: errorMessage, user: null, profile: null });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    set({ loading: true, error: null });
    
    try {
      console.log('Logging out...');
      
      const { error: signOutError } = await supabase.auth.signOut();
      
      if (signOutError) {
        const appError = createAppError(signOutError, {
          action: 'logout',
          component: 'authStore',
        });
        logError(appError);
        throw signOutError;
      }
      
      set({ user: null, profile: null, error: null });
      console.log('Logout successful');
      
    } catch (err: any) {
      const appError = createAppError(err, {
        action: 'logout',
        component: 'authStore',
      });
      logError(appError);

      const errorMessage = getUserFriendlyMessage(err);
      set({ error: errorMessage });
      
      // Even if logout fails, clear the local state
      set({ user: null, profile: null });
      
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));