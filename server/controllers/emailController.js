import EmailConfig from '../models/EmailConfig.js';
import nodemailer from 'nodemailer';

// Get SMTP configuration
export const getSMTPConfig = async (req, res) => {
  try {
    const config = await EmailConfig.findOne();
    
    if (!config) {
      // Return empty config if none exists
      return res.status(200).json({
        success: true,
        config: {
          enabled: false,
          host: '',
          port: '587',
          secure: false,
          auth: {
            user: '',
            pass: ''
          },
          fromEmail: '',
          fromName: ''
        }
      });
    }
    
    // Don't send password in response
    const configToSend = {
      ...config.toObject(),
      auth: {
        user: config.auth.user,
        pass: config.auth.pass ? '***' : ''
      }
    };

    res.status(200).json({
      success: true,
      config: configToSend
    });
  } catch (error) {
    console.error('Error fetching SMTP config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SMTP configuration'
    });
  }
};

// Update SMTP configuration
export const updateSMTPConfig = async (req, res) => {
  try {
    const { enabled, host, port, secure, auth, fromEmail, fromName } = req.body;

    // Validation - only require password if not already set
    if (!host || !port || !auth?.user || !fromEmail || !fromName) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    // Get existing config
    let config = await EmailConfig.findOne();
    
    if (config) {
      // Update existing config
      config.enabled = enabled !== undefined ? enabled : config.enabled;
      config.host = host;
      config.port = port;
      config.secure = secure || false;
      config.auth.user = auth.user;
      // Only update password if a new one is provided (not '***')
      if (auth.pass && auth.pass !== '***') {
        config.auth.pass = auth.pass;
      }
      config.fromEmail = fromEmail;
      config.fromName = fromName;
      await config.save();
    } else {
      // Create new config - password is required for new config
      if (!auth?.pass) {
        return res.status(400).json({
          success: false,
          error: 'Password is required for initial configuration'
        });
      }
      config = await EmailConfig.create({
        enabled: enabled !== undefined ? enabled : false,
        host,
        port,
        secure: secure || false,
        auth,
        fromEmail,
        fromName
      });
    }

    // Don't send password in response
    const configToSend = {
      ...config.toObject(),
      auth: {
        user: config.auth.user,
        pass: '***'
      }
    };

    res.status(200).json({
      success: true,
      message: 'SMTP configuration updated successfully',
      config: configToSend
    });
  } catch (error) {
    console.error('Error updating SMTP config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update SMTP configuration'
    });
  }
};

// Test email configuration
export const testEmail = async (req, res) => {
  try {
    const { host, port, secure, auth, fromEmail, fromName } = req.body;

    // Validation
    if (!host || !port || !auth?.user || !auth?.pass || !fromEmail || !fromName) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    // Get saved config if password is '***'
    let authToUse = auth;
    if (auth.pass === '***') {
      const config = await EmailConfig.findOne();
      if (!config || !config.auth.pass) {
        return res.status(400).json({
          success: false,
          error: 'Password is required for testing. Please save configuration with a valid password first.'
        });
      }
      authToUse = {
        user: auth.user,
        pass: config.auth.pass
      };
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: secure || false,
      auth: authToUse,
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates
      }
    });

    // Get user email from token
    const user = req.user;
    const toEmail = user.email || 'test@example.com';

    // Send test email
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: toEmail,
      subject: 'SMTP Configuration Test Email',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #4f46e5;">SMTP Configuration Test</h2>
          <p>This is a test email from BESCOM DAS System.</p>
          <p>Your SMTP configuration is working correctly!</p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px;">Sent on ${new Date().toLocaleString()}</p>
          </div>
        </div>
      `
    });

    res.status(200).json({
      success: true,
      message: 'Test email sent successfully',
      messageId: info.messageId
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({
      success: false,
      error: `Failed to send test email: ${error.message}`
    });
  }
};

