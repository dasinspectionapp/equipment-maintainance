import mongoose from 'mongoose';

const userDataStateSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
    },
    fileId: {
      type: String,
      required: [true, 'File ID is required'],
      index: true,
    },
    // Data state from MyData page
    siteObservations: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    taskStatus: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    typeOfIssue: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    viewPhotos: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    remarks: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    photoMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    supportDocuments: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    savedFrom: {
      type: String,
      default: 'Web Application',
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Compound index for efficient queries
userDataStateSchema.index({ userId: 1, fileId: 1 }, { unique: true });
userDataStateSchema.index({ userId: 1, updatedAt: -1 });

const UserDataState = mongoose.models.UserDataState || mongoose.model('UserDataState', userDataStateSchema);

export default UserDataState;


