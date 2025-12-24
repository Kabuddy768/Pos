import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useInvitationStore } from '@/stores/invitationStore';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/lib/types';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import { InvitationForm } from '@/components/invitations/InvitationForm';
import { InvitationList } from '@/components/invitations/InvitationList';
import { UserPlus, Edit2, Trash2, CheckCircle, XCircle, Users as UsersIcon, Mail } from 'lucide-react';

export const Users = () => {
  const { profile } = useAuthStore();
  const { invitations, fetchInvitations, loading: invitationsLoading } = useInvitationStore();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'invitations'>('users');
  const [formData, setFormData] = useState({
    full_name: '',
    role: 'seller' as 'admin' | 'seller',
    phone: '',
  });

  useEffect(() => {
    loadUsers();
    fetchInvitations();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      alert('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (user: Profile) => {
    setEditingUser(user);
    setFormData({
      full_name: user.full_name,
      role: user.role,
      phone: user.phone || '',
    });
    setShowEditModal(true);
  };

  const handleCloseEdit = () => {
    setEditingUser(null);
    setFormData({ full_name: '', role: 'seller', phone: '' });
    setShowEditModal(false);
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          role: formData.role,
          phone: formData.phone || null,
        })
        .eq('id', editingUser.id);

      if (error) throw error;
      
      alert('User updated successfully');
      handleCloseEdit();
      loadUsers();
    } catch (error: any) {
      console.error('Update error:', error);
      alert(error.message || 'Failed to update user');
    }
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;
      loadUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
      alert('Failed to update user status');
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete ${userName}? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;
      
      alert('User deleted successfully');
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin">
          <div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <Button 
            onClick={() => setShowInviteForm(true)} 
            variant="primary"
          >
            <Mail size={20} className="mr-2" />
            Send Invitation
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <UsersIcon size={18} />
              Active Users ({users.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'invitations'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Mail size={18} />
              Invitations ({invitations.length})
            </div>
          </button>
        </div>

        {/* Content */}
        {activeTab === 'users' ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Phone</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Role</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm text-gray-900 font-medium">{user.full_name}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{user.email}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{user.phone || '-'}</td>
                      <td className="px-6 py-3 text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.role === 'admin' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm">
                        <button
                          onClick={() => handleToggleActive(user.id, user.is_active)}
                          className="flex items-center gap-1"
                        >
                          {user.is_active ? (
                            <>
                              <CheckCircle size={16} className="text-green-600" />
                              <span className="text-green-600">Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle size={16} className="text-red-600" />
                              <span className="text-red-600">Inactive</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-3 text-sm flex gap-2">
                        <Button
                          onClick={() => handleOpenEdit(user)}
                          variant="secondary"
                          size="sm"
                        >
                          <Edit2 size={16} />
                        </Button>
                        {user.id !== profile?.id && (
                          <Button
                            onClick={() => handleDelete(user.id, user.full_name)}
                            variant="danger"
                            size="sm"
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {users.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No users found</p>
              </div>
            )}
          </div>
        ) : (
          <InvitationList invitations={invitations} />
        )}

        {/* Invitation Form Modal */}
        <InvitationForm 
          isOpen={showInviteForm} 
          onClose={() => setShowInviteForm(false)} 
        />

        {/* Edit User Modal */}
        <Modal
          isOpen={showEditModal}
          title="Edit User"
          onClose={handleCloseEdit}
          size="md"
        >
          <form onSubmit={handleSubmitEdit} className="space-y-4">
            <Input
              label="Full Name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />

            <Input
              label="Phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+254 712 345 678"
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
                <option value="seller">Seller</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="primary" className="flex-1">
                Update User
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleCloseEdit}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
};