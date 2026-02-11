import mongoose from 'mongoose';

const fcmTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    fcmToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ['android', 'ios'],
      default: 'android',
    },
    deviceId: {
      type: String,
      default: 'unknown',
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
fcmTokenSchema.index({ userId: 1, fcmToken: 1 });

// Auto-update lastUpdated on save
fcmTokenSchema.pre('save', function (next) {
  this.lastUpdated = new Date();
  next();
});

const FCMToken = mongoose.model('FCMToken', fcmTokenSchema);

export default FCMToken;

