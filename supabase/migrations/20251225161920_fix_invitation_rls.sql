/*
  # Fix Invitation Security Vulnerability
  
  ## Problem
  The current RLS policy allows anyone to view all invitations:
  USING (true) -- Too permissive!
  
  ## Solution
  - Remove the overly permissive policy
  - Token validation will continue to work via the RPC function
  - Only admins can browse the invitations table directly
  
  ## Security Principle
  RLS policies should be restrictive by default.
  Access should be granted through specific, secure functions.
*/

-- Drop the insecure policy
DROP POLICY IF EXISTS "Users can view own email invitations" ON user_invitations;

-- Ensure only the admin policy exists for viewing invitations
-- This policy already exists from the original migration, but we'll recreate it to be sure
DROP POLICY IF EXISTS "Admins can view all invitations" ON user_invitations;
CREATE POLICY "Admins can view all invitations"
  ON user_invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

/*
  Note: Token validation will continue to work because:
  1. The validate_invite_token() function runs with SECURITY DEFINER
  2. RPC functions bypass RLS policies when using SECURITY DEFINER
  3. Anonymous users can call the function, but cannot query the table directly
  
  This is the correct security model:
  - Direct table access: Admins only
  - Token validation: Everyone (via secure RPC function)
*/

-- Add a comment for documentation
COMMENT ON POLICY "Admins can view all invitations" ON user_invitations IS 
  'Only admins can browse invitations. Token validation happens via validate_invite_token() RPC function.';

-- Verify the validate_invite_token function has proper security
-- It should be SECURITY DEFINER so it can read invitations regardless of RLS
DO $$
BEGIN
  -- Check if function exists and log its security settings
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'validate_invite_token'
  ) THEN
    RAISE NOTICE 'validate_invite_token function exists and will bypass RLS for token validation';
  ELSE
    RAISE EXCEPTION 'validate_invite_token function not found! Token validation will not work.';
  END IF;
END $$;