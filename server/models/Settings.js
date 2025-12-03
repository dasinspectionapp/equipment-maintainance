import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    description: {
      type: String,
      trim: true
    },
    updatedBy: {
      type: String
    }
  },
  { timestamps: true }
);

// Prevent duplicate keys
SettingsSchema.index({ key: 1 }, { unique: true });

const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema, 'settings');

export default Settings;

