import mongoose from 'mongoose';

const emailConfigSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: false
  },
  host: {
    type: String,
    required: true,
    trim: true
  },
  port: {
    type: String,
    required: true,
    trim: true
  },
  secure: {
    type: Boolean,
    default: false
  },
  auth: {
    user: {
      type: String,
      required: true,
      trim: true
    },
    pass: {
      type: String,
      required: true
    }
  },
  fromEmail: {
    type: String,
    required: true,
    trim: true
  },
  fromName: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

const EmailConfig = mongoose.model('EmailConfig', emailConfigSchema);

export default EmailConfig;

