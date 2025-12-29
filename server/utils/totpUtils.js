import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';

/**
 * Generate a new TOTP secret for a user
 * @param {String} userId - User ID
 * @param {String} issuer - Application name (e.g., "BESCOM DAS")
 * @returns {Object} Secret object with base32 secret
 */
export const generateTotpSecret = (userId, issuer = 'BESCOM DAS') => {
  const secret = speakeasy.generateSecret({
    name: `${issuer} (${userId})`,
    issuer: issuer,
    length: 32
  });

  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url
  };
};

/**
 * Verify TOTP token
 * @param {String} token - 6-digit OTP from user
 * @param {String} secret - Base32 secret
 * @param {Number} window - Time window tolerance (default: 1, allows ±30 seconds)
 * @returns {Boolean} True if token is valid
 */
export const verifyTotpToken = (token, secret, window = 1) => {
  try {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: window, // Allow ±1 time step (30 seconds each)
      step: 30 // 30-second intervals
    });
  } catch (error) {
    console.error('TOTP verification error:', error);
    return false;
  }
};

/**
 * Generate QR code as data URL
 * @param {String} otpauthUrl - OTP Auth URL
 * @returns {Promise<String>} Data URL of QR code image
 */
export const generateQRCode = async (otpauthUrl) => {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 1
    });
    return qrCodeDataUrl;
  } catch (error) {
    console.error('QR code generation error:', error);
    throw new Error('Failed to generate QR code');
  }
};

/**
 * Generate recovery codes
 * @param {Number} count - Number of codes to generate (default: 8)
 * @returns {Object} Object with plain codes and hashed codes
 */
export const generateRecoveryCodes = async (count = 8) => {
  const codes = [];
  const hashedCodes = [];

  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
    
    // Hash the code
    const salt = await bcrypt.genSalt(10);
    const hashedCode = await bcrypt.hash(code, salt);
    hashedCodes.push({
      codeHash: hashedCode,
      used: false,
      usedAt: null
    });
  }

  return {
    plainCodes: codes, // Show only once to user
    hashedCodes: hashedCodes // Store in database
  };
};

/**
 * Verify recovery code
 * @param {String} code - Plain recovery code from user
 * @param {Array} recoveryCodes - Array of recovery code objects from database
 * @returns {Object|null} Recovery code object if valid, null otherwise
 */
export const verifyRecoveryCode = async (code, recoveryCodes) => {
  if (!recoveryCodes || recoveryCodes.length === 0) {
    return null;
  }

  for (const recoveryCode of recoveryCodes) {
    // Skip if already used
    if (recoveryCode.used) {
      continue;
    }

    // Verify the code
    const isValid = await bcrypt.compare(code, recoveryCode.codeHash);
    if (isValid) {
      return recoveryCode;
    }
  }

  return null;
};

/**
 * Generate device ID from request
 * @param {Object} req - Express request object
 * @returns {String} Device ID
 */
export const generateDeviceId = (req) => {
  // Use combination of user agent and IP for device identification
  const userAgent = req.headers['user-agent'] || 'unknown';
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  
  // Create a simple hash-like identifier
  const deviceString = `${userAgent}-${ip}`;
  return Buffer.from(deviceString).toString('base64').substring(0, 32);
};

