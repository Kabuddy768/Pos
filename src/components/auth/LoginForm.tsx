import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Mail } from 'lucide-react';

export const LoginForm = () => {
  const navigate = useNavigate();
  const { login, loading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    clearError();

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setFormError(err.message || 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">POS System</h1>
            <p className="text-gray-600">Inventory & Sales Management</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              Sign In
            </Button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">New here?</span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <Mail size={24} className="mx-auto mb-2 text-blue-600" />
              <p className="text-sm text-gray-700 mb-1">
                <strong>Have an invitation?</strong>
              </p>
              <p className="text-xs text-gray-600">
                Check your email for an invitation link to create your account.
              </p>
            </div>
          </form>
        </div>

        <p className="text-white text-center text-sm mt-6 opacity-75">
          Demo: admin@pos.local / admin123
        </p>
      </div>
    </div>
  );
};