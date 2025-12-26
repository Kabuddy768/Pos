import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import {
  createAppError,
  logError,
  getUserFriendlyMessage,
  isErrorCategory,
  ErrorCategory,
} from '@/utils/errorHandling';

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
      const { data, error: fetchError } = await supabase
        .from('user_invitations')
        .select(`
          *,
          inviter:profiles!invited_by(full_name)
        `)
        .order('created_at', { ascending: false });

      if (fetchError) {
        const appError = createAppError(fetchError, {
          action: 'fetchInvitations',
          component: 'invitationStore',
        });
        logError(appError);
        throw new Error(getUserFriendlyMessage(fetchError));
      }

      const invitations = (data || []).map((inv: any) => ({
        ...inv,
        inviter_name: inv.inviter?.full_name,
      }));

      set({ invitations, error: null });
      
    } catch (err: any) {
      const appError = createAppError(err, {
        action: 'fetchInvitations',
        component: 'invitationStore',
      });
      logError(appError);
      
      const errorMessage = err.message || getUserFriendlyMessage(err);
      set({ error: errorMessage });
      throw err;
      
    } finally {
      set({ loading: false });
    }
  },

  sendInvitation: async (email: string, role: 'admin' | 'seller', message?: string) => {
    set({ loading: true, error: null });
    
    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address');
      }

      // Check if user already exists
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      if (profileCheckError) {
        const appError = createAppError(profileCheckError, {
          action: 'sendInvitation',
          step: 'checkExistingProfile',
          email,
        });
        logError(appError);
        
        // Don't throw on profile check error, continue with invitation
        console.warn('Could not check for existing profile:', profileCheckError);
      }

      if (existingProfile) {
        throw new Error('A user with this email already exists');
      }

      // Check if there's already a pending invitation
      const { data: existingInvite, error: inviteCheckError } = await supabase
        .from('user_invitations')
        .select('id, status')
        .eq('email', email)
        .eq('status', 'pending')
        .maybeSingle();

      if (inviteCheckError) {
        const appError = createAppError(inviteCheckError, {
          action: 'sendInvitation',
          step: 'checkExistingInvite',
          email,
        });
        logError(appError);
      }

      if (existingInvite) {
        throw new Error('There is already a pending invitation for this email');
      }

      // Generate token
      const { data: tokenData, error: tokenError } = await supabase
        .rpc('generate_invite_token');

      if (tokenError) {
        const appError = createAppError(tokenError, {
          action: 'sendInvitation',
          step: 'generateToken',
          email,
        });
        logError(appError);
        throw new Error('Failed to generate invitation token. Please try again.');
      }

      const token = tokenData as string;

      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated. Please log in and try again.');
      }

      // Set expiration to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Create invitation
      const { data: _invitation, error: inviteError } = await supabase
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

      if (inviteError) {
        const appError = createAppError(inviteError, {
          action: 'sendInvitation',
          step: 'createInvitation',
          email,
          role,
        });
        logError(appError);

        if (isErrorCategory(inviteError, ErrorCategory.CONFLICT)) {
          throw new Error('An invitation for this email already exists');
        }
        
        throw new Error(getUserFriendlyMessage(inviteError));
      }

      // Refresh invitations list
await get().fetchInvitations();

// Send email via Edge Function
try {
  console.log('Sending invitation email via Edge Function...');
  
  const { data: { user } } = await supabase.auth.getUser();
  const inviterName = user?.user_metadata?.full_name || 'Admin';

  const {data, error} = await supabase.functions.invoke('send-invitation-email', {
    body: {
      to: email,
      inviterName,
      role,
      inviteToken: token,
      message: message || undefined,
      expiresAt: expiresAt.toISOString(),
    },
  });

  if (error) {
    console.error('Failed to send email:', error);
    // Don't throw - invitation is created, just email failed
    console.warn('Invitation created but email sending failed. Please share the link manually.');
  } else if (data && !data.success) {
    // Check if the function returned an error in the response body
    console.error('Email sending failed:', data.error);
    console.warn('Invitation created but email sending failed. Please share the link manually.');
  } else {
    console.log('Email sent successfully:', data);
  }
} catch (emailError: any) {
  console.error('Error sending invitation email:', emailError);
  // Don't throw - invitation is already created
  console.warn('Invitation created but email sending failed. Please share the link manually.');
}

set({ error: null });
return token;
      
    } catch (err: any) {
      const appError = createAppError(err, {
        action: 'sendInvitation',
        component: 'invitationStore',
        email,
        role,
      });
      logError(appError);
      
      const errorMessage = err.message || getUserFriendlyMessage(err);
      set({ error: errorMessage });
      throw new Error(errorMessage);
      
    } finally {
      set({ loading: false });
    }
  },

  validateToken: async (token: string) => {
    try {
      if (!token || token.trim() === '') {
        throw new Error('Invalid invitation token');
      }

      const { data, error: validateError } = await supabase
        .rpc('validate_invite_token', { token });

      if (validateError) {
        const appError = createAppError(validateError, {
          action: 'validateToken',
          component: 'invitationStore',
        });
        logError(appError);
        return { is_valid: false };
      }

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
      const appError = createAppError(err, {
        action: 'validateToken',
        component: 'invitationStore',
      });
      logError(appError);
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
      // Validate inputs
      if (!userData.fullName || userData.fullName.trim() === '') {
        throw new Error('Full name is required');
      }

      if (!userData.password || userData.password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

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

      if (authError) {
        const appError = createAppError(authError, {
          action: 'acceptInvitation',
          step: 'createAuthUser',
          email: validation.email,
        });
        logError(appError);
        throw new Error(getUserFriendlyMessage(authError));
      }

      if (!authData.user) {
        throw new Error('Failed to create user account');
      }

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

      if (profileError) {
        const appError = createAppError(profileError, {
          action: 'acceptInvitation',
          step: 'createProfile',
          userId: authData.user.id,
        });
        logError(appError);
        throw new Error('Failed to create user profile. Please contact support.');
      }

      // Mark invitation as accepted
      const { error: markError } = await supabase
        .rpc('mark_invitation_accepted', {
          token,
          user_id: authData.user.id,
        });

      if (markError) {
        const appError = createAppError(markError, {
          action: 'acceptInvitation',
          step: 'markAccepted',
          userId: authData.user.id,
        });
        logError(appError);
        // Don't throw error here as user is already created
        console.warn('Failed to mark invitation as accepted:', markError);
      }

      set({ loading: false, error: null });
      
    } catch (err: any) {
      const appError = createAppError(err, {
        action: 'acceptInvitation',
        component: 'invitationStore',
      });
      logError(appError);
      
      const errorMessage = err.message || getUserFriendlyMessage(err);
      set({ error: errorMessage, loading: false });
      throw new Error(errorMessage);
    }
  },

  resendInvitation: async (invitationId: string) => {
    set({ loading: true, error: null });
    
    try {
      // Get the invitation
      const invitation = get().invitations.find(inv => inv.id === invitationId);
      if (!invitation) {
        throw new Error('Invitation not found');
      }

      // Generate new token
      const { data: tokenData, error: tokenError } = await supabase
        .rpc('generate_invite_token');

      if (tokenError) {
        const appError = createAppError(tokenError, {
          action: 'resendInvitation',
          step: 'generateToken',
          invitationId,
        });
        logError(appError);
        throw new Error('Failed to generate new token');
      }

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

      if (updateError) {
        const appError = createAppError(updateError, {
          action: 'resendInvitation',
          step: 'updateInvitation',
          invitationId,
        });
        logError(appError);
        throw new Error(getUserFriendlyMessage(updateError));
      }

    // Refresh list
await get().fetchInvitations();

// Send email via Edge Function
try {
  console.log('Sending invitation email via Edge Function...');
  
  const { data: { user } } = await supabase.auth.getUser();
  const inviterName = user?.user_metadata?.full_name || 'Admin';

  const {data,error} = await supabase.functions.invoke('send-invitation-email', {
    body: {
      to: invitation.email,
      inviterName,
      role: invitation.role,
      inviteToken: newToken,
      message: invitation.message || undefined,
      expiresAt: newExpiresAt.toISOString(),
    },
  });

  if (error) {
    console.error('Failed to send email:', error);
    console.warn('Invitation resent but email sending failed. Please share the link manually.');
  } else if (data && !data.success) {
    console.error('Email resending failed:', data.error);
    console.warn('Invitation resent but email sending failed. Please share the link manually.');
  } else {
    console.log('Email resent successfully:', data);
  }
} catch (emailError: any) {
  console.error('Error sending invitation email:', emailError);
  console.warn('Invitation resent but email sending failed. Please share the link manually.');
}

set({ error: null });
      
    } catch (err: any) {
      const appError = createAppError(err, {
        action: 'resendInvitation',
        component: 'invitationStore',
        invitationId,
      });
      logError(appError);
      
      const errorMessage = err.message || getUserFriendlyMessage(err);
      set({ error: errorMessage });
      throw new Error(errorMessage);
      
    } finally {
      set({ loading: false });
    }
  },

  revokeInvitation: async (invitationId: string) => {
    set({ loading: true, error: null });
    
    try {
      const { error: revokeError } = await supabase
        .from('user_invitations')
        .update({
          status: 'revoked',
          updated_at: new Date().toISOString(),
        })
        .eq('id', invitationId);

      if (revokeError) {
        const appError = createAppError(revokeError, {
          action: 'revokeInvitation',
          invitationId,
        });
        logError(appError);
        throw new Error(getUserFriendlyMessage(revokeError));
      }

      // Refresh list
      await get().fetchInvitations();
      set({ error: null });
      
    } catch (err: any) {
      const appError = createAppError(err, {
        action: 'revokeInvitation',
        component: 'invitationStore',
        invitationId,
      });
      logError(appError);
      
      const errorMessage = err.message || getUserFriendlyMessage(err);
      set({ error: errorMessage });
      throw new Error(errorMessage);
      
    } finally {
      set({ loading: false });
    }
  },

  deleteInvitation: async (invitationId: string) => {
    set({ loading: true, error: null });
    
    try {
      const { error: deleteError } = await supabase
        .from('user_invitations')
        .delete()
        .eq('id', invitationId);

      if (deleteError) {
        const appError = createAppError(deleteError, {
          action: 'deleteInvitation',
          invitationId,
        });
        logError(appError);
        throw new Error(getUserFriendlyMessage(deleteError));
      }

      // Refresh list
      await get().fetchInvitations();
      set({ error: null });
      
    } catch (err: any) {
      const appError = createAppError(err, {
        action: 'deleteInvitation',
        component: 'invitationStore',
        invitationId,
      });
      logError(appError);
      
      const errorMessage = err.message || getUserFriendlyMessage(err);
      set({ error: errorMessage });
      throw new Error(errorMessage);
      
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));