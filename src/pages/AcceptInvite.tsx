import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInvitationStore } from '@/stores/invitationStore';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { CheckCircle, XCircle, UserPlus } from 'lucide-react';

export const AcceptInvite = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { validateToken, acceptInvitation, loading, error, clearError } = useInvitationStore();

  const [validating, setValidating] = useState(true);
  const [validation, setValidation] = useState<any>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const validate = async () => {
      setValidating(true);
      try {
        const result = await validateToken(token);
        setValidation(result);
      } catch (err) {
        console.error('Validation error:', err);
      } finally {
        setValidating(false);
      }
    };

    validate();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    clearError();

    // Validation
    if (!formData.fullName.trim()) {
      setFormError('Full name is required');
      return;
    }

    if (formData.password.length < 6) {
      setFormError('Password must be at least 6 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    try {
      await acceptInvitation(token!, {
        fullName: formData.fullName,
        password: formData.password,
        phone: formData.phone || undefined,
      });

      // Navigate to dashboard after successful acceptance
      navigate('/dashboard');
    } catch (err: any) {
      setFormError(err.message || 'Failed to accept invitation');
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="flex flex-col items-center">
            <div className="animate-spin">
              <div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
            <p className="mt-4 text-gray-600">Validating invitation...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!validation || !validation.is_valid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="flex flex-col items-center text-center">
            <div className="bg-red-100 rounded-full p-4 mb-4">
              <XCircle size={48} className="text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invitation</h1>
            <p className="text-gray-600 mb-6">
              This invitation link is invalid or has expired. Please contact your administrator for a new invitation.
            </p>
            <Button
              onClick={() => navigate('/login')}
              variant="primary"
              size="lg"
            >
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="bg-blue-100 rounded-full p-4 mb-4">
            <UserPlus size={48} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">You're Invited!</h1>
          <p className="text-gray-600">
            <span className="font-semibold">{validation.invited_by_name}</span> has invited you to join the POS system
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Email:</span>
            <span className="font-semibold text-gray-900">{validation.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Role:</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
              validation.role === 'admin' 
                ? 'bg-purple-100 text-purple-800' 
                : 'bg-blue-100 text-blue-800'
            }`}>
              {validation.role}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            type="text"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            placeholder="John Doe"
            required
          />

          <Input
            label="Phone Number (Optional)"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+254 712 345 678"
          />

          <Input
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="••••••••"
            helperText="Minimum 6 characters"
            required
          />

          <Input
            label="Confirm Password"
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            placeholder="••••••••"
            required
          />

          {(formError || error) && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {formError || error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={loading}
            className="w-full"
          >
            <CheckCircle size={20} className="mr-2" />
            Create Account & Join
          </Button>

          <p className="text-xs text-gray-500 text-center mt-4">
            By creating an account, you agree to our terms of service and privacy policy.
          </p>
        </form>
      </div>
    </div>
  );
};