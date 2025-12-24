import { useState } from 'react';
import { useInvitationStore } from '@/stores/invitationStore';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Mail, Copy, Check } from 'lucide-react';

interface InvitationFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InvitationForm = ({ isOpen, onClose }: InvitationFormProps) => {
  const { sendInvitation, loading, error, clearError } = useInvitationStore();
  const [formData, setFormData] = useState({
    email: '',
    role: 'seller' as 'admin' | 'seller',
    message: '',
  });
  const [formError, setFormError] = useState('');
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    clearError();

    // Validation
    if (!formData.email.trim()) {
      setFormError('Email is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setFormError('Please enter a valid email address');
      return;
    }

    try {
      const token = await sendInvitation(
        formData.email,
        formData.role,
        formData.message || undefined
      );
      
      setInviteToken(token);
      
      // Reset form but keep modal open to show the invite link
      setFormData({
        email: '',
        role: 'seller',
        message: '',
      });
    } catch (err: any) {
      setFormError(err.message || 'Failed to send invitation');
    }
  };

  const handleClose = () => {
    setFormData({ email: '', role: 'seller', message: '' });
    setFormError('');
    setInviteToken(null);
    setCopied(false);
    clearError();
    onClose();
  };

  const copyInviteLink = () => {
    if (inviteToken) {
      const inviteUrl = `${window.location.origin}/accept-invite/${inviteToken}`;
      navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title={inviteToken ? 'Invitation Sent!' : 'Send Invitation'}
      onClose={handleClose}
      size="lg"
    >
      {inviteToken ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Mail size={32} className="text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Invitation Created Successfully!
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              The invitation has been created. Share this link with the recipient:
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invitation Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={`${window.location.origin}/accept-invite/${inviteToken}`}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm font-mono"
              />
              <Button
                onClick={copyInviteLink}
                variant={copied ? 'success' : 'secondary'}
                size="md"
              >
                {copied ? (
                  <>
                    <Check size={16} className="mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={16} className="mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              <strong>Note:</strong> This invitation link will expire in 7 days. 
              The recipient will receive an email with this link (email integration pending).
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleClose}
              variant="primary"
              size="lg"
              className="flex-1"
            >
              Done
            </Button>
            <Button
              onClick={() => {
                setInviteToken(null);
                setCopied(false);
              }}
              variant="secondary"
              size="lg"
              className="flex-1"
            >
              Send Another
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="user@example.com"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'seller' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="seller">Seller - Can make sales and view inventory</option>
              <option value="admin">Administrator - Full system access</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Personal Message (Optional)
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Add a personal message for the recipient..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {(formError || error) && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {formError || error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={loading}
              className="flex-1"
            >
              <Mail size={20} className="mr-2" />
              Send Invitation
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              size="lg"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};