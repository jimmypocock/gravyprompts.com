'use client';

import { useState, useEffect } from 'react';
import { getUsersWithPermissions, grantPermission, revokePermission, UserPermission } from '@/lib/api/admin';
import { Plus, Trash2 } from 'lucide-react';

const AVAILABLE_PERMISSIONS = [
  { value: 'admin', label: 'Admin', description: 'Full administrative access, can manage permissions' },
  { value: 'approval', label: 'Approval Process', description: 'Can approve/reject templates' },
];

export default function PermissionsManager() {
  const [users, setUsers] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newPermission, setNewPermission] = useState('approval');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await getUsersWithPermissions();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleGrantPermission() {
    if (!newUserId.trim()) {
      alert('Please enter a user ID');
      return;
    }

    try {
      setProcessing('grant');
      await grantPermission(newUserId, newPermission);
      await loadUsers();
      setNewUserId('');
      setShowAddForm(false);
    } catch (error) {
      console.error('Error granting permission:', error);
      alert('Failed to grant permission');
    } finally {
      setProcessing(null);
    }
  }

  async function handleRevokePermission(userId: string, permission: string) {
    if (!confirm(`Are you sure you want to revoke ${permission} permission from this user?`)) {
      return;
    }

    try {
      setProcessing(`${userId}-${permission}`);
      await revokePermission(userId, permission);
      await loadUsers();
    } catch (error) {
      console.error('Error revoking permission:', error);
      alert('Failed to revoke permission');
    } finally {
      setProcessing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div role="status" className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Permission Form */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Manage Permissions</h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded hover:bg-red-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Grant Permission
          </button>
        </div>

        {showAddForm && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User ID (Cognito Sub)
                </label>
                <input
                  type="text"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  placeholder="e.g., 123e4567-e89b-12d3..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Permission
                </label>
                <select
                  value={newPermission}
                  onChange={(e) => setNewPermission(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                >
                  {AVAILABLE_PERMISSIONS.map((perm) => (
                    <option key={perm.value} value={perm.value}>
                      {perm.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={handleGrantPermission}
                  disabled={processing === 'grant'}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  Grant Permission
                </button>
              </div>
            </div>
            
            <p className="mt-2 text-sm text-gray-600">
              To find a user&apos;s ID, they can check their profile or you can look it up in AWS Cognito console.
            </p>
          </div>
        )}
      </div>

      {/* Users List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Permission
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Granted
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Granted By
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  No users with permissions yet
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={`${user.userId}-${user.permission}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {user.userId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {AVAILABLE_PERMISSIONS.find(p => p.value === user.permission)?.label || user.permission}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.grantedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.grantedBy || 'System'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleRevokePermission(user.userId, user.permission)}
                      disabled={processing === `${user.userId}-${user.permission}`}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Permission Descriptions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Available Permissions:</h4>
        <ul className="space-y-2 text-sm text-blue-800">
          {AVAILABLE_PERMISSIONS.map((perm) => (
            <li key={perm.value}>
              <strong>{perm.label}:</strong> {perm.description}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}