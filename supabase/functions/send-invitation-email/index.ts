// import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno imports work at runtime
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno imports work at runtime
import { corsHeaders } from '../shared/cors.ts';

// Resend API endpoint
const RESEND_API_URL = 'https://api.resend.com/emails';

interface InvitationEmailRequest {
  to: string;
  inviterName: string;
  role: 'admin' | 'seller';
  inviteToken: string;
  message?: string;
  expiresAt: string;
}

interface InvitationEmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

serve(async (req:Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Resend API key from environment
    // @ts-ignore - Deno global exists at runtime
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    // Parse request body
    const body: InvitationEmailRequest = await req.json();
    
    // Validate required fields
    if (!body.to || !body.inviterName || !body.role || !body.inviteToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Format data for email
    const inviteUrl = `${req.headers.get('origin') || 'https://yourapp.com'}/invite/${body.inviteToken}`;
    const roleDisplay = body.role === 'admin' ? 'Administrator' : 'Seller';
    const roleClass = body.role === 'admin' ? 'role-admin' : 'role-seller';
    
    // Format expiry date
    const expiryDate = new Date(body.expiresAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Build HTML email
    const htmlContent = buildHtmlEmail({
      inviterName: body.inviterName,
      email: body.to,
      roleDisplay,
      roleClass,
      message: body.message,
      inviteUrl,
      expiryDate,
    });

    // Build plain text email
    const textContent = buildTextEmail({
      inviterName: body.inviterName,
      email: body.to,
      roleDisplay,
      message: body.message,
      inviteUrl,
      expiryDate,
      isAdmin: body.role === 'admin',
    });

    // Send email via Resend
    const resendResponse = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'POS System <onboarding@resend.dev>', // Update with your verified domain
        to: [body.to],
        subject: `You're invited to join POS System as ${roleDisplay}`,
        html: htmlContent,
        text: textContent,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendData);
      throw new Error(resendData.message || 'Failed to send email');
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        messageId: resendData.id,
      } as InvitationEmailResponse),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send invitation email';
    console.error('Error sending invitation email:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      } as InvitationEmailResponse),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// HTML Email Builder
function buildHtmlEmail(data: {
  inviterName: string;
  email: string;
  roleDisplay: string;
  roleClass: string;
  message?: string;
  inviteUrl: string;
  expiryDate: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to Join Our POS System</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; line-height: 1.6; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .email-header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 40px 30px; text-align: center; }
    .email-logo { font-size: 32px; font-weight: bold; color: #ffffff; margin: 0; }
    .email-body { padding: 40px 30px; color: #1f2937; }
    .greeting { font-size: 24px; font-weight: 600; margin: 0 0 20px 0; color: #111827; }
    .invitation-text { font-size: 16px; margin: 0 0 30px 0; color: #4b5563; }
    .role-badge { display: inline-block; padding: 8px 16px; border-radius: 9999px; font-size: 14px; font-weight: 600; margin: 10px 0 20px 0; }
    .role-admin { background-color: #fef3c7; color: #92400e; }
    .role-seller { background-color: #dbeafe; color: #1e40af; }
    .cta-button { display: inline-block; padding: 16px 32px; background-color: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; }
    .info-box { background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 16px; margin: 30px 0; border-radius: 4px; }
    .info-box-title { font-weight: 600; color: #1e40af; margin: 0 0 8px 0; }
    .info-box-text { margin: 0; color: #1e3a8a; font-size: 14px; }
    .personal-message { background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 20px 0; font-style: italic; color: #4b5563; }
    .expiry-notice { background-color: #fef3c7; border: 1px solid #fbbf24; padding: 12px 16px; border-radius: 8px; margin: 20px 0; font-size: 14px; color: #92400e; }
    .alt-link { margin-top: 20px; padding: 16px; background-color: #f9fafb; border-radius: 8px; font-size: 12px; color: #6b7280; word-break: break-all; }
    .alt-link-label { font-weight: 600; color: #374151; display: block; margin-bottom: 8px; }
    .email-footer { background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280; }
    .footer-link { color: #2563eb; text-decoration: none; margin: 0 10px; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1 class="email-logo">🏪 POS System</h1>
    </div>
    <div class="email-body">
      <h2 class="greeting">You're Invited! 🎉</h2>
      <p class="invitation-text"><strong>${data.inviterName}</strong> has invited you to join the POS & Inventory Management System.</p>
      <p class="invitation-text">You've been assigned the role of:</p>
      <span class="role-badge ${data.roleClass}">${data.roleDisplay}</span>
      ${data.message ? `<div class="personal-message">"${data.message}"</div>` : ''}
      <div style="text-align: center; margin: 40px 0;">
        <a href="${data.inviteUrl}" class="cta-button">Accept Invitation & Create Account</a>
      </div>
      <div class="info-box">
        <p class="info-box-title">What happens next?</p>
        <p class="info-box-text">Click the button above to create your account. You'll be able to set your password and start using the system immediately.</p>
      </div>
      <div class="expiry-notice">⏰ <strong>Important:</strong> This invitation expires on ${data.expiryDate}. Please accept it before then.</div>
      <div class="alt-link">
        <span class="alt-link-label">If the button doesn't work, copy and paste this link:</span>
        ${data.inviteUrl}
      </div>
    </div>
    <div class="email-footer">
      <p style="margin: 0 0 10px 0;">This invitation was sent to <strong>${data.email}</strong></p>
      <p style="margin: 15px 0 0 0; font-size: 12px; color: #9ca3af;">© 2024 POS System. All rights reserved.</p>
      <p style="margin: 10px 0 0 0; font-size: 12px; color: #9ca3af;">If you didn't expect this invitation, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>
  `;
}

// Plain Text Email Builder
function buildTextEmail(data: {
  inviterName: string;
  email: string;
  roleDisplay: string;
  message?: string;
  inviteUrl: string;
  expiryDate: string;
  isAdmin: boolean;
}): string {
  return `
================================================================================
🏪 POS SYSTEM - YOU'RE INVITED!
================================================================================

Hello!

${data.inviterName} has invited you to join the POS & Inventory Management System.

INVITATION DETAILS
--------------------------------------------------------------------------------
Email:          ${data.email}
Role:           ${data.roleDisplay}
Invited by:     ${data.inviterName}
Expires:        ${data.expiryDate}

${data.message ? `
PERSONAL MESSAGE
--------------------------------------------------------------------------------
"${data.message}"

` : ''}
ACCEPT YOUR INVITATION
--------------------------------------------------------------------------------
To accept this invitation and create your account, please visit:

${data.inviteUrl}

You'll be able to set your password and start using the system immediately.

IMPORTANT INFORMATION
--------------------------------------------------------------------------------
⏰ This invitation expires on ${data.expiryDate}
🔒 This link is unique to you and should not be shared
❓ If you have questions, contact our support team

================================================================================

This invitation was sent to ${data.email}

If you didn't expect this invitation, you can safely ignore this email.

© 2024 POS System. All rights reserved.
  `;
}