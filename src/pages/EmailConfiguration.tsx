import { useState, useEffect } from 'react';
import BackButton from '../components/BackButton';

interface SMTPConfig {
  host: string;
  port: string;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  fromEmail: string;
  fromName: string;
  enabled?: boolean;
}

export default function EmailConfiguration() {
  const [smtpConfig, setSmtpConfig] = useState<SMTPConfig>({
    host: '',
    port: '587',
    secure: false,
    auth: {
      user: '',
      pass: ''
    },
    fromEmail: '',
    fromName: '',
    enabled: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [testStatus, setTestStatus] = useState<string>('');

  useEffect(() => {
    loadSMTPConfig();
  }, []);

  const loadSMTPConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/admin/smtp-config', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.config) {
          setSmtpConfig(data.config);
        }
      }
    } catch (error) {
      console.error('Error loading SMTP config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/admin/smtp-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(smtpConfig)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSaveStatus('Configuration saved successfully!');
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus(data.error || 'Failed to save configuration');
        setTimeout(() => setSaveStatus(''), 5000);
      }
    } catch (error: any) {
      console.error('Error saving SMTP config:', error);
      setSaveStatus('Failed to save configuration');
      setTimeout(() => setSaveStatus(''), 5000);
    }
  };

  const handleTest = async () => {
    try {
      const token = localStorage.getItem('token');
      setTestStatus('Sending test email...');

      const response = await fetch('http://localhost:5000/api/admin/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(smtpConfig)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setTestStatus('Test email sent successfully!');
        setTimeout(() => setTestStatus(''), 5000);
      } else {
        setTestStatus(data.error || 'Failed to send test email');
        setTimeout(() => setTestStatus(''), 5000);
      }
    } catch (error: any) {
      console.error('Error sending test email:', error);
      setTestStatus('Failed to send test email');
      setTimeout(() => setTestStatus(''), 5000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <BackButton />
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Email Configuration</h2>
        <p className="text-gray-600">Configure SMTP settings for sending emails</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-300 overflow-hidden">
        <div className="p-6">
          {/* Enable/Disable Email */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={smtpConfig.enabled || false}
                onChange={(e) => setSmtpConfig({ ...smtpConfig, enabled: e.target.checked })}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-lg font-semibold text-gray-700">
                Enable Email Sending
              </span>
            </label>
            <p className="text-sm text-gray-500 mt-2 ml-8">
              Turn on to enable SMTP email functionality
            </p>
          </div>

          {/* SMTP Host */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SMTP Host *
            </label>
            <input
              type="text"
              value={smtpConfig.host}
              onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
              placeholder="smtp.gmail.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
              disabled={!smtpConfig.enabled}
            />
          </div>

          {/* SMTP Port */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SMTP Port *
            </label>
            <input
              type="number"
              value={smtpConfig.port}
              onChange={(e) => setSmtpConfig({ ...smtpConfig, port: e.target.value })}
              placeholder="587"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
              disabled={!smtpConfig.enabled}
            />
          </div>

          {/* Secure Connection */}
          <div className="mb-6">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={smtpConfig.secure}
                onChange={(e) => setSmtpConfig({ ...smtpConfig, secure: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                disabled={!smtpConfig.enabled}
              />
              <span className="text-sm font-medium text-gray-700">
                Use secure connection (SSL/TLS)
              </span>
            </label>
          </div>

          {/* Username */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SMTP Username/Email *
            </label>
            <input
              type="email"
              value={smtpConfig.auth.user}
              onChange={(e) => setSmtpConfig({
                ...smtpConfig,
                auth: { ...smtpConfig.auth, user: e.target.value }
              })}
              placeholder="your-email@gmail.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
              disabled={!smtpConfig.enabled}
            />
          </div>

          {/* Password */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SMTP Password/App Password *
            </label>
            <input
              type="password"
              value={smtpConfig.auth.pass}
              onChange={(e) => setSmtpConfig({
                ...smtpConfig,
                auth: { ...smtpConfig.auth, pass: e.target.value }
              })}
              placeholder="Enter SMTP password or app password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
              disabled={!smtpConfig.enabled}
            />
          </div>

          {/* From Email */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From Email *
            </label>
            <input
              type="email"
              value={smtpConfig.fromEmail}
              onChange={(e) => setSmtpConfig({ ...smtpConfig, fromEmail: e.target.value })}
              placeholder="noreply@bescom.gov.in"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
              disabled={!smtpConfig.enabled}
            />
          </div>

          {/* From Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From Name *
            </label>
            <input
              type="text"
              value={smtpConfig.fromName}
              onChange={(e) => setSmtpConfig({ ...smtpConfig, fromName: e.target.value })}
              placeholder="BESCOM DAS System"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
              disabled={!smtpConfig.enabled}
            />
          </div>

          {/* Status Messages */}
          {(saveStatus || testStatus) && (
            <div className="mb-6">
              {saveStatus && (
                <div className={`p-3 rounded-lg ${saveStatus.includes('success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {saveStatus}
                </div>
              )}
              {testStatus && (
                <div className={`p-3 rounded-lg mt-2 ${testStatus.includes('success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {testStatus}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-6">
            <button
              onClick={handleTest}
              disabled={!smtpConfig.enabled}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#ffffff',
                backgroundColor: smtpConfig.enabled ? '#2563eb' : '#94a3b8',
                border: 'none',
                borderRadius: '8px',
                cursor: smtpConfig.enabled ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}
              onMouseEnter={(e) => {
                if (smtpConfig.enabled) {
                  e.currentTarget.style.backgroundColor = '#1d4ed8';
                }
              }}
              onMouseLeave={(e) => {
                if (smtpConfig.enabled) {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }
              }}
            >
              Send Test Email
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#ffffff',
                backgroundColor: '#2563eb',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#1d4ed8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }}
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">SMTP Configuration Guide</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p><strong>Common SMTP Settings:</strong></p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li><strong>Gmail:</strong> smtp.gmail.com, Port: 587 (SSL) or 465 (TLS)</li>
            <li><strong>Outlook:</strong> smtp.office365.com, Port: 587</li>
            <li><strong>Yahoo:</strong> smtp.mail.yahoo.com, Port: 587 or 465</li>
            <li><strong>Custom SMTP:</strong> Check with your email provider</li>
          </ul>
          <p className="mt-3"><strong>Note:</strong> For Gmail and most modern providers, you'll need to use an App Password instead of your regular password.</p>
        </div>
      </div>
    </div>
  );
}

