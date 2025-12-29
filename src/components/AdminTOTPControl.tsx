import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { API_BASE } from '../utils/api';

interface User {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  adminAllowsTotp: boolean;
  totpEnabled: boolean;
}

interface AdminTOTPControlProps {
  userId?: string; // If provided, show controls for specific user
}

export default function AdminTOTPControl({ userId }: AdminTOTPControlProps) {
  const { theme } = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (userId) {
      fetchUserStatus(userId);
    } else {
      fetchAllUsers();
    }
  }, [userId]);

  const fetchAllUsers = async () => {
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE}/api/admin/totp/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch users');
      }

      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserStatus = async (targetUserId: string) => {
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE}/api/admin/totp/status/${targetUserId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch user status');
      }

      setUsers([data.data]);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch user status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableTotp = async (targetUserId: string) => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE}/api/admin/totp/enable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: targetUserId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enable TOTP');
      }

      setSuccess(data.message || 'TOTP enabled successfully');
      if (userId) {
        fetchUserStatus(userId);
      } else {
        fetchAllUsers();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to enable TOTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableTotp = async (targetUserId: string) => {
    if (!window.confirm('Are you sure you want to disable TOTP for this user? This will clear their TOTP secret and recovery codes.')) {
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE}/api/admin/totp/disable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: targetUserId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to disable TOTP');
      }

      setSuccess(data.message || 'TOTP disabled successfully');
      if (userId) {
        fetchUserStatus(userId);
      } else {
        fetchAllUsers();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to disable TOTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetTotp = async (targetUserId: string) => {
    if (!window.confirm('Are you sure you want to reset TOTP for this user? They will need to re-scan the QR code on next login.')) {
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE}/api/admin/totp/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: targetUserId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset TOTP');
      }

      setSuccess(data.message || 'TOTP reset successfully');
      if (userId) {
        fetchUserStatus(userId);
      } else {
        fetchAllUsers();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset TOTP');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full" style={{ color: theme.text }}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2" style={{ color: theme.primary }}>
          TOTP Management
        </h2>
        <p className="text-sm" style={{ color: theme.textSecondary }}>
          Enable, disable, or reset Two-Factor Authentication for users
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm border" style={{ backgroundColor: theme.error + '20', borderColor: theme.error, color: theme.error }}>
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 rounded-lg text-sm border" style={{ backgroundColor: '#10b981' + '20', borderColor: '#10b981', color: '#10b981' }}>
          {success}
        </div>
      )}

      {!userId && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by User ID, Name, or Email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
            style={{
              backgroundColor: theme.inputBackground,
              borderColor: theme.inputBorder,
              color: theme.text,
            }}
          />
        </div>
      )}

      {isLoading && !users.length ? (
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: theme.primary }}></div>
          <p>Loading...</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ backgroundColor: theme.inputBackground }}>
                <th className="px-4 py-3 text-left border" style={{ borderColor: theme.inputBorder }}>User ID</th>
                <th className="px-4 py-3 text-left border" style={{ borderColor: theme.inputBorder }}>Name</th>
                <th className="px-4 py-3 text-left border" style={{ borderColor: theme.inputBorder }}>Email</th>
                <th className="px-4 py-3 text-left border" style={{ borderColor: theme.inputBorder }}>Role</th>
                <th className="px-4 py-3 text-center border" style={{ borderColor: theme.inputBorder }}>Admin Allows</th>
                <th className="px-4 py-3 text-center border" style={{ borderColor: theme.inputBorder }}>TOTP Enabled</th>
                <th className="px-4 py-3 text-center border" style={{ borderColor: theme.inputBorder }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.userId} style={{ borderBottom: `1px solid ${theme.inputBorder}` }}>
                  <td className="px-4 py-3 border" style={{ borderColor: theme.inputBorder }}>{user.userId}</td>
                  <td className="px-4 py-3 border" style={{ borderColor: theme.inputBorder }}>{user.fullName}</td>
                  <td className="px-4 py-3 border" style={{ borderColor: theme.inputBorder }}>{user.email}</td>
                  <td className="px-4 py-3 border" style={{ borderColor: theme.inputBorder }}>{user.role}</td>
                  <td className="px-4 py-3 text-center border" style={{ borderColor: theme.inputBorder }}>
                    {user.adminAllowsTotp ? (
                      <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: '#10b98120', color: '#10b981' }}>Yes</span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: theme.error + '20', color: theme.error }}>No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center border" style={{ borderColor: theme.inputBorder }}>
                    {user.totpEnabled ? (
                      <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: '#10b98120', color: '#10b981' }}>Enabled</span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: theme.textMuted + '20', color: theme.textMuted }}>Disabled</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center border" style={{ borderColor: theme.inputBorder }}>
                    <div className="flex gap-2 justify-center">
                      {!user.adminAllowsTotp ? (
                        <button
                          onClick={() => handleEnableTotp(user.userId)}
                          disabled={isLoading}
                          className="px-3 py-1 text-xs rounded transition-all disabled:opacity-50"
                          style={{ backgroundColor: theme.primary, color: '#ffffff' }}
                        >
                          Enable
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleDisableTotp(user.userId)}
                            disabled={isLoading}
                            className="px-3 py-1 text-xs rounded transition-all disabled:opacity-50"
                            style={{ backgroundColor: theme.error, color: '#ffffff' }}
                          >
                            Disable
                          </button>
                          {user.totpEnabled && (
                            <button
                              onClick={() => handleResetTotp(user.userId)}
                              disabled={isLoading}
                              className="px-3 py-1 text-xs rounded transition-all disabled:opacity-50"
                              style={{ backgroundColor: '#f59e0b', color: '#ffffff' }}
                            >
                              Reset
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

