import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface Invitation {
  id: string;
  email: string;
  role: 'admin' | 'seller';
  invited_by: string;
  invite_token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  message?: string;
  expires_at: string;
  accepted_at?: string;
  created_at: string;
  updated_at: string;
  inviter_name?: string;
}

export interface InvitationValidation {
  is_valid: boolean;
  invitation_id?: string;
  email?: string;
  role?: 'admin' | 'seller';
  invited_by_name?: string;
  expires_at?: string;
}

interface InvitationState {
  invitations: Invitation[];
  loading: boolean;
  error: string | null;
  
  // Fetch all invitations (admin only)
  fetchInvitations: () => Promise<void>;
  
  // Send a new invitation
  sendInvitation: (email: string, role: 'admin' | 'seller', message?: string) => Promise<string>;
  
  // Validate an invite token
  validateToken: (token: string) => Promise<InvitationValidation>;
  
  // Accept an invitation (creates user account)
  acceptInvitation: (token: string, userData: {
    fullName: string;
    password: string;
    phone?: string;
  }) => Promise<void>;
  
  // Resend an invitation
  resendInvitation: (invitationId: string) => Promise<void>;
  
  // Revoke an invitation
  revokeInvitation: (invitationId: string) => Promise<void>;
  
  // Delete an invitation
  deleteInvitation: (invitationId: string) => Promise<void>;
  
  // Clear error
  clearError: () => void;
}

export const useInvitationStore = create<InvitationState>((set, get) => ({
  invitations: [],
  loading: false,
  error: null,

  fetchInvitations: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('user_invitations')
        .select(`
          *,
          inviter:profiles!invited_by(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const invitations = (data || []).map((inv: any) => ({
        ...inv,
        inviter_name: inv.inviter?.full_name,
      }));

      set({ invitations });
    } catch (err: any) {
      console.error('Fetch invitations error:', err);
      set({ error: err.message || 'Failed to fetch invitations' });
    } finally {
      set({ loading: false });
    }
  },

  sendInvitation: async (email: string, role: 'admin' | 'seller', message?: string) => {
    set({ loading: true, error: null });
    try {
      // Check if user already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      if (existingProfile) {
        throw new Error('A user with this email already exists');
      }

      // Check if there's already a pending invitation
      const { data: existingInvite } = await supabase
        .from('user_invitations')
        .select('id, status')
        .eq('email', email)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingInvite) {
        throw new Error('There is already a pending invitation for this email');
      }

      // Generate token
      const { data: tokenData, error: tokenError } = await supabase
        .rpc('generate_invite_token');

      if (tokenError) throw tokenError;
      const token = tokenData as string;

      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Set expiration to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Create invitation
      const { data: invitation, error: inviteError } = await supabase
        .from('user_invitations')
        .insert([{
          email,
          role,
          invited_by: user.id,
          invite_token: token,
          message,
          expires_at: expiresAt.toISOString(),
          status: 'pending',
        }])
        .select()
        .single();

      if (inviteError) throw inviteError;

      // Refresh invitations list
      await get().fetchInvitations();

      // TODO: Send email with invitation link
      // This would require email service integration
      console.log('Invitation created:', {
        email,
        token,
        inviteUrl: `${window.location.origin}/accept-invite/${token}`
      });

      return token;
    } catch (err: any) {
      console.error('Send invitation error:', err);
      const errorMessage = err.message || 'Failed to send invitation';
      set({ error: errorMessage });
      throw new Error(errorMessage);
    } finally {
      set({ loading: false });
    }
  },

  validateToken: async (token: string) => {
    try {
      const { data, error } = await supabase
        .rpc('validate_invite_token', { token });

      if (error) throw error;

      if (!data || data.length === 0) {
        return { is_valid: false };
      }

      const validation = data[0];
      return {
        is_valid: validation.is_valid,
        invitation_id: validation.invitation_id,
        email: validation.email,
        role: validation.role,
        invited_by_name: validation.invited_by_name,
        expires_at: validation.expires_at,
      };
    } catch (err: any) {
      console.error('Validate token error:', err);
      return { is_valid: false };
    }
  },

  acceptInvitation: async (token: string, userData: {
    fullName: string;
    password: string;
    phone?: string;
  }) => {
    set({ loading: true, error: null });
    try {
      // Validate token first
      const validation = await get().validateToken(token);
      
      if (!validation.is_valid || !validation.email) {
        throw new Error('Invalid or expired invitation');
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: validation.email,
        password: userData.password,
        options: {
          data: {
            full_name: userData.fullName,
            role: validation.role,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user account');

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: authData.user.id,
          full_name: userData.fullName,
          email: validation.email,
          role: validation.role,
          phone: userData.phone || null,
          is_active: true,
        }]);

      if (profileError) throw profileError;

      // Mark invitation as accepted
      const { error: markError } = await supabase
        .rpc('mark_invitation_accepted', {
          token,
          user_id: authData.user.id,
        });

      if (markError) {
        console.error('Failed to mark invitation as accepted:', markError);
        // Don't throw error here as user is already created
      }

      // User is now logged in automatically
      set({ loading: false });
    } catch (err: any) {
      console.error('Accept invitation error:', err);
      const errorMessage = err.message || 'Failed to accept invitation';
      set({ error: errorMessage, loading: false });
      throw new Error(errorMessage);
    }
  },

  resendInvitation: async (invitationId: string) => {
    set({ loading: true, error: null });
    try {
      // Get the invitation
      const invitation = get().invitations.find(inv => inv.id === invitationId);
      if (!invitation) throw new Error('Invitation not found');

      // Generate new token
      const { data: tokenData, error: tokenError } = await supabase
        .rpc('generate_invite_token');

      if (tokenError) throw tokenError;
      const newToken = tokenData as string;

      // Extend expiration
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 7);

      // Update invitation
      const { error: updateError } = await supabase
        .from('user_invitations')
        .update({
          invite_token: newToken,
          expires_at: newExpiresAt.toISOString(),
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', invitationId);

      if (updateError) throw updateError;

      // Refresh list
      await get().fetchInvitations();

      // TODO: Send new email
      console.log('Invitation resent:', {
        email: invitation.email,
        token: newToken,
        inviteUrl: `${window.location.origin}/invite/${newToken}`
      });
    } catch (err: any) {
      console.error('Resend invitation error:', err);
      const errorMessage = err.message || 'Failed to resend invitation';
      set({ error: errorMessage });
      throw new Error(errorMessage);
    } finally {
      set({ loading: false });
    }
  },

  revokeInvitation: async (invitationId: string) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('user_invitations')
        .update({
          status: 'revoked',
          updated_at: new Date().toISOString(),
        })
        .eq('id', invitationId);

      if (error) throw error;

      // Refresh list
      await get().fetchInvitations();
    } catch (err: any) {
      console.error('Revoke invitation error:', err);
      const errorMessage = err.message || 'Failed to revoke invitation';
      set({ error: errorMessage });
      throw new Error(errorMessage);
    } finally {
      set({ loading: false });
    }
  },

  deleteInvitation: async (invitationId: string) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('user_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;

      // Refresh list
      await get().fetchInvitations();
    } catch (err: any) {
      console.error('Delete invitation error:', err);
      const errorMessage = err.message || 'Failed to delete invitation';
      set({ error: errorMessage });
      throw new Error(errorMessage);
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));