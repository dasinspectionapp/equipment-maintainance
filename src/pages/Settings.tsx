import { useState, useEffect } from 'react';
import { API_BASE } from '../utils/api';
import TOTPSetup from '../components/TOTPSetup';
import BackButton from '../components/BackButton';

export default function Settings() {
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [totpStatus, setTotpStatus] = useState<{
    adminAllowsTotp: boolean;
    totpEnabled: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnabling, setIsEnabling] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        setUser(JSON.parse(userStr));
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
    fetchTotpStatus();
  }, []);

  const fetchTotpStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      // Use the user's own TOTP status endpoint (not admin endpoint)
      const response = await fetch(`${API_BASE}/api/auth/totp/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setTotpStatus({
            adminAllowsTotp: data.data.adminAllowsTotp || false,
            totpEnabled: data.data.totpEnabled || false
          });
        } else {
          // If no data returned, assume TOTP is not enabled
          setTotpStatus({
            adminAllowsTotp: false,
            totpEnabled: false
          });
        }
      } else {
        // If API call fails, try to get error message
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to fetch TOTP status:', errorData);
        setTotpStatus({
          adminAllowsTotp: false,
          totpEnabled: false
        });
      }
    } catch (error) {
      console.error('Error fetching TOTP status:', error);
      setTotpStatus({
        adminAllowsTotp: false,
        totpEnabled: false
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableTotpForSelf = async () => {
    if (!user || user.role !== 'Admin') return;

    setIsEnabling(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/admin/totp/enable`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: user.userId })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Refresh TOTP status
        await fetchTotpStatus();
        // Show setup immediately
        setShowTotpSetup(true);
      } else {
        setError(data.error || 'Failed to enable TOTP');
      }
    } catch (error: any) {
      console.error('Error enabling TOTP:', error);
      setError(error.message || 'Failed to enable TOTP');
    } finally {
      setIsEnabling(false);
    }
  };

  const handleResetOwnTotp = async () => {
    if (!confirm('Are you sure you want to reset your TOTP? You will need to set it up again and scan a new QR code.')) {
      return;
    }

    setIsEnabling(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/auth/totp/reset-self`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Refresh TOTP status
        await fetchTotpStatus();
        alert('TOTP reset successfully. You can set it up again now.');
        // Optionally show setup screen
        setShowTotpSetup(true);
      } else {
        setError(data.error || 'Failed to reset TOTP');
      }
    } catch (error: any) {
      console.error('Error resetting TOTP:', error);
      setError(error.message || 'Failed to reset TOTP');
    } finally {
      setIsEnabling(false);
    }
  };

  const isAdmin = user?.role === 'Admin';

  if (showTotpSetup) {
    return (
      <div className="p-8">
        <BackButton />
        <TOTPSetup
          onComplete={() => {
            setShowTotpSetup(false);
            fetchTotpStatus();
          }}
          onCancel={() => {
            setShowTotpSetup(false);
            fetchTotpStatus();
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-8 min-h-screen">
      <BackButton />
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Settings</h2>
        <p className="text-gray-600">Configure system settings and security</p>
      </div>

      {/* Security Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Security Settings</h3>
        
        {/* TOTP Section */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-1">Two-Factor Authentication (TOTP)</h4>
              <p className="text-sm text-gray-600">
                Add an extra layer of security to your account using Google Authenticator
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <p className="text-sm text-gray-600 mt-2">Loading...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
              {!totpStatus?.adminAllowsTotp ? (
                <div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-yellow-800 mb-3">
                      <strong>Note:</strong> TOTP is not enabled for your account.
                      {!isAdmin && ' Please contact your administrator to enable Two-Factor Authentication.'}
                      {isAdmin && ' As an administrator, you can enable it for yourself.'}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={handleEnableTotpForSelf}
                      disabled={isEnabling}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isEnabling ? 'Enabling...' : 'Enable TOTP for My Account'}
                    </button>
                  )}
                </div>
              ) : !totpStatus?.totpEnabled ? (
                <div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-blue-800 mb-3">
                      <strong>Ready to set up:</strong> Your administrator has enabled TOTP for your account. You can now set up Two-Factor Authentication.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowTotpSetup(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Set Up Two-Factor Authentication
                  </button>
                </div>
              ) : (
                <div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm font-semibold text-green-800">
                        Two-Factor Authentication is Enabled
                      </p>
                    </div>
                    <p className="text-sm text-green-700">
                      Your account is protected with Two-Factor Authentication. You'll need to enter a code from your authenticator app when logging in.
                    </p>
                  </div>
                  <div className="mt-4">
                    {isAdmin ? (
                      <button
                        onClick={handleResetOwnTotp}
                        disabled={isEnabling}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        {isEnabling ? 'Resetting...' : 'Reset My TOTP'}
                      </button>
                    ) : (
                      <p className="text-xs text-gray-500 mt-2">
                        To reset TOTP, please contact your administrator.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

