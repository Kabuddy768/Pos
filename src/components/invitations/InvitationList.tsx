import { useState } from 'react';
import { useInvitationStore, Invitation } from '@/stores/invitationStore';
import { Button } from '@/components/common/Button';
import { Send, Trash2, XCircle, CheckCircle, Clock, Ban } from 'lucide-react';
import { formatDate, formatDistanceToNowFormat } from '@/utils/formatters';

interface InvitationListProps {
  invitations: Invitation[];
}

export const InvitationList = ({ invitations }: InvitationListProps) => {
  const { resendInvitation, revokeInvitation, deleteInvitation, loading } = useInvitationStore();
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'expired' | 'revoked'>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filteredInvitations = invitations.filter((inv) => {
    if (filter === 'all') return true;
    return inv.status === filter;
  });

  const handleResend = async (invitationId: string) => {
    if (loading || processingId) return;
    
    setProcessingId(invitationId);
    try {
      await resendInvitation(invitationId);
      alert('Invitation resent successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to resend invitation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevoke = async (invitationId: string, email: string) => {
    if (loading || processingId) return;
    
    if (!confirm(`Are you sure you want to revoke the invitation for ${email}?`)) {
      return;
    }

    setProcessingId(invitationId);
    try {
      await revokeInvitation(invitationId);
      alert('Invitation revoked successfully');
    } catch (err: any) {
      alert(err.message || 'Failed to revoke invitation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (invitationId: string, email: string) => {
    if (loading || processingId) return;
    
    if (!confirm(`Are you sure you want to delete the invitation for ${email}?`)) {
      return;
    }

    setProcessingId(invitationId);
    try {
      await deleteInvitation(invitationId);
      alert('Invitation deleted successfully');
    } catch (err: any) {
      alert(err.message || 'Failed to delete invitation');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock size={16} className="text-yellow-600" />;
      case 'accepted':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'expired':
        return <XCircle size={16} className="text-red-600" />;
      case 'revoked':
        return <Ban size={16} className="text-gray-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      expired: 'bg-red-100 text-red-800',
      revoked: 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${badges[status as keyof typeof badges]}`}>
        {getStatusIcon(status)}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const statusCounts = {
    all: invitations.length,
    pending: invitations.filter(i => i.status === 'pending').length,
    accepted: invitations.filter(i => i.status === 'accepted').length,
    expired: invitations.filter(i => i.status === 'expired').length,
    revoked: invitations.filter(i => i.status === 'revoked').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['all', 'pending', 'accepted', 'expired', 'revoked'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)} ({statusCounts[status]})
          </button>
        ))}
      </div>

      {filteredInvitations.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-500">
            {filter === 'all' 
              ? 'No invitations sent yet' 
              : `No ${filter} invitations`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Role</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Sent</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Expires</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvitations.map((invitation) => (
                  <tr key={invitation.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm">
                      <div>
                        <p className="text-gray-900 font-medium">{invitation.email}</p>
                        {invitation.inviter_name && (
                          <p className="text-xs text-gray-500">
                            Invited by {invitation.inviter_name}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        invitation.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {invitation.role}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {getStatusBadge(invitation.status)}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      <div>
                        <p>{formatDate(invitation.created_at)}</p>
                        <p className="text-xs text-gray-500">
                          {formatDistanceToNowFormat(invitation.created_at)}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {invitation.status === 'pending' ? (
                        <div>
                          <p>{formatDate(invitation.expires_at)}</p>
                          <p className="text-xs text-gray-500">
                            {formatDistanceToNowFormat(invitation.expires_at)}
                          </p>
                        </div>
                      ) : invitation.status === 'accepted' && invitation.accepted_at ? (
                        <div>
                          <p className="text-green-600">Accepted</p>
                          <p className="text-xs text-gray-500">
                            {formatDistanceToNowFormat(invitation.accepted_at)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <div className="flex gap-2">
                        {invitation.status === 'pending' && (
                          <>
                            <Button
                              onClick={() => handleResend(invitation.id)}
                              variant="secondary"
                              size="sm"
                              disabled={processingId === invitation.id}
                              title="Resend invitation"
                            >
                              <Send size={16} />
                            </Button>
                            <Button
                              onClick={() => handleRevoke(invitation.id, invitation.email)}
                              variant="danger"
                              size="sm"
                              disabled={processingId === invitation.id}
                              title="Revoke invitation"
                            >
                              <Ban size={16} />
                            </Button>
                          </>
                        )}
                        {(invitation.status === 'expired' || invitation.status === 'revoked') && (
                          <Button
                            onClick={() => handleDelete(invitation.id, invitation.email)}
                            variant="danger"
                            size="sm"
                            disabled={processingId === invitation.id}
                            title="Delete invitation"
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};