import React from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Mail, Eye } from 'lucide-react';

interface EmailPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  inviterName: string;
  email: string;
  role: 'admin' | 'seller';
  message?: string;
  inviteUrl: string;
  expiryDate: string;
}

export const EmailPreview: React.FC<EmailPreviewProps> = ({
  isOpen,
  onClose,
  inviterName,
  email,
  role,
  message,
  inviteUrl,
  expiryDate,
}) => {
  const [viewMode, setViewMode] = React.useState<'html' | 'text'>('html');

  const roleDisplay = role === 'admin' ? 'Administrator' : 'Seller';
  const roleClass = role === 'admin' ? 'role-admin' : 'role-seller';

  // HTML Email Preview
  const htmlPreview = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          margin: 0;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background-color: #f3f4f6;
          line-height: 1.6;
        }
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .email-header {
          background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
          padding: 40px 30px;
          text-align: center;
        }
        .email-logo {
          font-size: 32px;
          font-weight: bold;
          color: #ffffff;
          margin: 0;
        }
        .email-body {
          padding: 40px 30px;
          color: #1f2937;
        }
        .greeting {
          font-size: 24px;
          font-weight: 600;
          margin: 0 0 20px 0;
          color: #111827;
        }
        .invitation-text {
          font-size: 16px;
          margin: 0 0 30px 0;
          color: #4b5563;
        }
        .role-badge {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 9999px;
          font-size: 14px;
          font-weight: 600;
          margin: 10px 0 20px 0;
        }
        .role-admin {
          background-color: #fef3c7;
          color: #92400e;
        }
        .role-seller {
          background-color: #dbeafe;
          color: #1e40af;
        }
        .cta-button {
          display: inline-block;
          padding: 16px 32px;
          background-color: #2563eb;
          color: #ffffff !important;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          margin: 20px 0;
        }
        .info-box {
          background-color: #eff6ff;
          border-left: 4px solid #2563eb;
          padding: 16px;
          margin: 30px 0;
          border-radius: 4px;
        }
        .info-box-title {
          font-weight: 600;
          color: #1e40af;
          margin: 0 0 8px 0;
        }
        .info-box-text {
          margin: 0;
          color: #1e3a8a;
          font-size: 14px;
        }
        .personal-message {
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          font-style: italic;
          color: #4b5563;
        }
        .expiry-notice {
          background-color: #fef3c7;
          border: 1px solid #fbbf24;
          padding: 12px 16px;
          border-radius: 8px;
          margin: 20px 0;
          font-size: 14px;
          color: #92400e;
        }
        .alt-link {
          margin-top: 20px;
          padding: 16px;
          background-color: #f9fafb;
          border-radius: 8px;
          font-size: 12px;
          color: #6b7280;
          word-break: break-all;
        }
        .alt-link-label {
          font-weight: 600;
          color: #374151;
          display: block;
          margin-bottom: 8px;
        }
        .email-footer {
          background-color: #f9fafb;
          padding: 30px;
          text-align: center;
          border-top: 1px solid #e5e7eb;
          font-size: 14px;
          color: #6b7280;
        }
        .footer-links {
          margin: 15px 0;
        }
        .footer-link {
          color: #2563eb;
          text-decoration: none;
          margin: 0 10px;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="email-header">
          <h1 class="email-logo">🏪 POS System</h1>
        </div>
        <div class="email-body">
          <h2 class="greeting">You're Invited! 🎉</h2>
          <p class="invitation-text">
            <strong>${inviterName}</strong> has invited you to join the POS & Inventory Management System.
          </p>
          <p class="invitation-text">
            You've been assigned the role of:
          </p>
          <span class="role-badge ${roleClass}">
            ${roleDisplay}
          </span>
          ${message ? `
          <div class="personal-message">
            "${message}"
          </div>
          ` : ''}
          <div style="text-align: center; margin: 40px 0;">
            <a href="${inviteUrl}" class="cta-button">
              Accept Invitation & Create Account
            </a>
          </div>
          <div class="info-box">
            <p class="info-box-title">What happens next?</p>
            <p class="info-box-text">
              Click the button above to create your account. You'll be able to set your password and start using the system immediately.
            </p>
          </div>
          <div class="expiry-notice">
            ⏰ <strong>Important:</strong> This invitation expires on ${expiryDate}. Please accept it before then.
          </div>
          <div class="alt-link">
            <span class="alt-link-label">If the button doesn't work, copy and paste this link:</span>
            ${inviteUrl}
          </div>
        </div>
        <div class="email-footer">
          <p style="margin: 0 0 10px 0;">
            This invitation was sent to <strong>${email}</strong>
          </p>
          <div class="footer-links">
            <a href="mailto:support@yourcompany.com" class="footer-link">Contact Support</a>
            <span style="color: #d1d5db;">|</span>
            <a href="https://yourcompany.com/help" class="footer-link">Help Center</a>
          </div>
          <p style="margin: 15px 0 0 0; font-size: 12px; color: #9ca3af;">
            © 2024 POS System. All rights reserved.
          </p>
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #9ca3af;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Plain Text Email Preview
  const textPreview = `
================================================================================
🏪 POS SYSTEM - YOU'RE INVITED!
================================================================================

Hello!

${inviterName} has invited you to join the POS & Inventory Management System.

INVITATION DETAILS
--------------------------------------------------------------------------------
Email:          ${email}
Role:           ${roleDisplay}
Invited by:     ${inviterName}
Expires:        ${expiryDate}

${message ? `
PERSONAL MESSAGE
--------------------------------------------------------------------------------
"${message}"

` : ''}
ACCEPT YOUR INVITATION
--------------------------------------------------------------------------------
To accept this invitation and create your account, please visit:

${inviteUrl}

You'll be able to set your password and start using the system immediately.

WHAT YOU CAN DO AS ${roleDisplay.toUpperCase()}
--------------------------------------------------------------------------------
${role === 'admin' ? `
As an Administrator, you'll have full access to:
- Manage inventory and products
- View all sales and transactions
- Generate reports and analytics
- Manage users and permissions
- Configure system settings
` : `
As a Seller, you'll be able to:
- Process sales transactions
- View product inventory
- Search for products
- Complete customer checkouts
- View your own sales history
`}

IMPORTANT INFORMATION
--------------------------------------------------------------------------------
⏰ This invitation expires on ${expiryDate}
🔒 This link is unique to you and should not be shared
❓ If you have questions, contact our support team

NEED HELP?
--------------------------------------------------------------------------------
Support Email:   support@yourcompany.com
Help Center:     https://yourcompany.com/help
Phone:           +1 (555) 123-4567

================================================================================

This invitation was sent to ${email}

If you didn't expect this invitation, you can safely ignore this email.
The invitation will expire automatically on ${expiryDate}.

© 2024 POS System. All rights reserved.

================================================================================
  `;

  return (
    <Modal
      isOpen={isOpen}
      title="Email Preview"
      onClose={onClose}
      size="xl"
    >
      <div className="space-y-4">
        {/* View Mode Toggle */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div className="flex items-center gap-2">
            <Eye size={20} className="text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              Preview Mode:
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('html')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                viewMode === 'html'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              HTML Version
            </button>
            <button
              onClick={() => setViewMode('text')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                viewMode === 'text'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Plain Text
            </button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Mail size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">This is how the email will look</p>
              <p>
                Recipients will receive both HTML and plain text versions. Their email client will
                automatically choose which one to display.
              </p>
            </div>
          </div>
        </div>

        {/* Email Preview */}
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          {viewMode === 'html' ? (
            <iframe
              srcDoc={htmlPreview}
              title="Email Preview"
              className="w-full h-[600px] bg-gray-50"
              sandbox="allow-same-origin"
            />
          ) : (
            <pre className="p-6 bg-gray-900 text-gray-100 text-xs overflow-auto h-[600px] font-mono whitespace-pre-wrap">
              {textPreview}
            </pre>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <Button
            onClick={onClose}
            variant="primary"
            size="lg"
            className="flex-1"
          >
            Looks Good!
          </Button>
          <Button
            onClick={onClose}
            variant="secondary"
            size="lg"
            className="flex-1"
          >
            Close Preview
          </Button>
        </div>
      </div>
    </Modal>
  );
};