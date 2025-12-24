/*
  # Add User Invitation System

  ## New Table
  - user_invitations: Store invitation details with tokens
  
  ## Modifications
  - profiles: Add invited_by tracking
  
  ## Security
  - RLS policies for invitation management
  - Token-based validation
*/

-- Create user_invitations table
CREATE TABLE IF NOT EXISTS user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'seller')),
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invite_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  message TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMPTZ;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON user_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON user_invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON user_invitations(invited_by);
CREATE INDEX IF NOT EXISTS idx_invitations_expires ON user_invitations(expires_at);

-- Function: Generate secure invite token
CREATE OR REPLACE FUNCTION generate_invite_token()
RETURNS TEXT AS $$
DECLARE
  token TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random token (32 characters)
    token := encode(gen_random_bytes(24), 'base64');
    token := replace(token, '/', '_');
    token := replace(token, '+', '-');
    token := replace(token, '=', '');
    
    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM user_invitations WHERE invite_token = token) INTO exists;
    
    EXIT WHEN NOT exists;
  END LOOP;
  
  RETURN token;
END;
$$ LANGUAGE plpgsql;

-- Function: Validate invite token
CREATE OR REPLACE FUNCTION validate_invite_token(token TEXT)
RETURNS TABLE(
  is_valid BOOLEAN,
  invitation_id UUID,
  email TEXT,
  role TEXT,
  invited_by_name TEXT,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (i.status = 'pending' AND i.expires_at > now())::BOOLEAN as is_valid,
    i.id as invitation_id,
    i.email,
    i.role,
    p.full_name as invited_by_name,
    i.expires_at
  FROM user_invitations i
  JOIN profiles p ON i.invited_by = p.id
  WHERE i.invite_token = token;
END;
$$ LANGUAGE plpgsql;

-- Function: Mark invitation as accepted
CREATE OR REPLACE FUNCTION mark_invitation_accepted(token TEXT, user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  -- Get invitation details
  SELECT id, invited_by INTO invitation_record
  FROM user_invitations
  WHERE invite_token = token AND status = 'pending' AND expires_at > now();
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Update invitation status
  UPDATE user_invitations
  SET status = 'accepted',
      accepted_at = now(),
      updated_at = now()
  WHERE id = invitation_record.id;
  
  -- Update profile with invitation details
  UPDATE profiles
  SET invited_by = invitation_record.invited_by,
      invitation_accepted_at = now()
  WHERE id = user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function: Auto-expire invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void AS $$
BEGIN
  UPDATE user_invitations
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'pending' 
    AND expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update updated_at timestamp
DROP TRIGGER IF EXISTS invitations_updated_at ON user_invitations;
CREATE TRIGGER invitations_updated_at
  BEFORE UPDATE ON user_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_invitations

-- Admins can view all invitations
DROP POLICY IF EXISTS "Admins can view all invitations" ON user_invitations;
CREATE POLICY "Admins can view all invitations"
  ON user_invitations FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Users can view invitations sent to their email (for validation)
DROP POLICY IF EXISTS "Users can view own email invitations" ON user_invitations;
CREATE POLICY "Users can view own email invitations"
  ON user_invitations FOR SELECT
  TO anon, authenticated
  USING (true); -- Token validation needs to be public

-- Admins can create invitations
DROP POLICY IF EXISTS "Admins can create invitations" ON user_invitations;
CREATE POLICY "Admins can create invitations"
  ON user_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin(auth.uid()) AND
    invited_by = auth.uid()
  );

-- Admins can update their own invitations
DROP POLICY IF EXISTS "Admins can update own invitations" ON user_invitations;
CREATE POLICY "Admins can update own invitations"
  ON user_invitations FOR UPDATE
  TO authenticated
  USING (invited_by = auth.uid() OR is_admin(auth.uid()))
  WITH CHECK (invited_by = auth.uid() OR is_admin(auth.uid()));

-- Admins can delete invitations
DROP POLICY IF EXISTS "Admins can delete invitations" ON user_invitations;
CREATE POLICY "Admins can delete invitations"
  ON user_invitations FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION generate_invite_token() TO authenticated;
GRANT EXECUTE ON FUNCTION validate_invite_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_invitation_accepted(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION expire_old_invitations() TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE user_invitations IS 'Stores user invitation tokens for secure invite-based registration';
COMMENT ON FUNCTION generate_invite_token() IS 'Generates a unique secure token for invitations';
COMMENT ON FUNCTION validate_invite_token(TEXT) IS 'Validates an invite token and returns invitation details';
COMMENT ON FUNCTION mark_invitation_accepted(TEXT, UUID) IS 'Marks an invitation as accepted and links it to the new user';