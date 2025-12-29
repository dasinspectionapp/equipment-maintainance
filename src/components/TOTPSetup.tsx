import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { API_BASE } from '../utils/api';

interface TOTPSetupProps {
  onComplete: () => void;
  onCancel?: () => void;
}

export default function TOTPSetup({ onComplete, onCancel }: TOTPSetupProps) {
  const { theme } = useTheme();
  const [step, setStep] = useState<'qr' | 'confirm'>('qr');
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  useEffect(() => {
    initializeSetup();
  }, []);

  const initializeSetup = async () => {
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE}/api/auth/totp/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize TOTP setup');
      }

      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep('confirm');
    } catch (err: any) {
      setError(err.message || 'Failed to initialize TOTP setup');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE}/api/auth/totp/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ otp })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to confirm TOTP');
      }

      setRecoveryCodes(data.recoveryCodes);
      setStep('recovery');
    } catch (err: any) {
      setError(err.message || 'Failed to confirm TOTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPComplete = (otpValue: string) => {
    setOtp(otpValue);
  };

  const handleSaveRecoveryCodes = () => {
    // User should save recovery codes - we'll just proceed
    onComplete();
  };

  if (step === 'recovery') {
    return (
      <div className="w-full max-w-md mx-auto p-6 rounded-2xl shadow-2xl" style={{ backgroundColor: theme.surface }}>
        <h3 className="text-2xl font-bold mb-4 text-center" style={{ color: theme.primary }}>
          Save Your Recovery Codes
        </h3>
        <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: theme.error + '20', borderColor: theme.error, borderWidth: '1px' }}>
          <p className="text-sm font-semibold mb-2" style={{ color: theme.error }}>
            ⚠️ Important: Save these codes now!
          </p>
          <p className="text-sm" style={{ color: theme.text }}>
            These codes can be used to access your account if you lose access to your authenticator app. They will not be shown again.
          </p>
        </div>
        <div className="mb-6 p-4 rounded-lg border-2" style={{ backgroundColor: theme.inputBackground, borderColor: theme.primary }}>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm">
            {recoveryCodes.map((code, index) => (
              <div key={index} className="p-2 text-center" style={{ color: theme.text }}>
                {code}
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={handleSaveRecoveryCodes}
          className="w-full py-3 px-4 rounded-lg font-bold transition-all"
          style={{ backgroundColor: theme.primary, color: '#ffffff' }}
        >
          I've Saved My Codes
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 rounded-2xl shadow-2xl" style={{ backgroundColor: theme.surface }}>
      <h3 className="text-2xl font-bold mb-4 text-center" style={{ color: theme.primary }}>
        Set Up Two-Factor Authentication
      </h3>

      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: theme.error + '20', color: theme.error }}>
          {error}
        </div>
      )}

      {isLoading && !qrCode && (
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: theme.primary }}></div>
          <p style={{ color: theme.text }}>Generating QR code...</p>
        </div>
      )}

      {qrCode && (
        <div className="mb-6">
          <p className="text-sm mb-4 text-center" style={{ color: theme.text }}>
            1. Scan this QR code with Google Authenticator or any TOTP app
          </p>
          <div className="flex justify-center mb-4">
            <img src={qrCode} alt="TOTP QR Code" className="border-2 rounded-lg" style={{ borderColor: theme.inputBorder }} />
          </div>
          <p className="text-xs text-center mb-4" style={{ color: theme.textMuted }}>
            Or enter this secret manually: <code className="p-1 rounded" style={{ backgroundColor: theme.inputBackground }}>{secret}</code>
          </p>
          <p className="text-sm text-center mb-4" style={{ color: theme.text }}>
            2. Enter the 6-digit code from your app below
          </p>
        </div>
      )}

      {step === 'confirm' && (
        <div className="mb-6">
          {!qrCode && (
            <p className="text-sm mb-4 text-center" style={{ color: theme.text }}>
              Enter the 6-digit code from your authenticator app:
            </p>
          )}
          <div className="flex justify-center mb-4">
            <div className="flex gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <input
                  key={i}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={otp[i] || ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 1) {
                      const newOtp = otp.split('');
                      newOtp[i] = value;
                      setOtp(newOtp.join(''));
                      if (value && i < 5) {
                        (e.target.nextElementSibling as HTMLInputElement)?.focus();
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !otp[i] && i > 0) {
                      (e.target.previousElementSibling as HTMLInputElement)?.focus();
                    }
                  }}
                  className="w-12 h-14 text-center text-2xl font-bold border-2 rounded-lg focus:ring-2 focus:border-transparent transition-all"
                  style={{
                    backgroundColor: theme.inputBackground,
                    borderColor: otp[i] ? theme.primary : theme.inputBorder,
                    color: theme.text,
                    outlineColor: theme.primary,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-3 px-4 rounded-lg font-bold border-2 transition-all"
            style={{ borderColor: theme.primary, color: theme.primary, backgroundColor: 'transparent' }}
          >
            Cancel
          </button>
        )}
        {step === 'confirm' && (
          <button
            onClick={handleConfirm}
            disabled={isLoading || otp.length !== 6}
            className="flex-1 py-3 px-4 rounded-lg font-bold transition-all disabled:opacity-50"
            style={{ backgroundColor: theme.primary, color: '#ffffff' }}
          >
            {isLoading ? 'Verifying...' : 'Confirm & Enable'}
          </button>
        )}
      </div>
    </div>
  );
}

