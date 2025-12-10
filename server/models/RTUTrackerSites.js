import mongoose from 'mongoose';

const rtuTrackerSitesSchema = new mongoose.Schema(
  {
    // File and row identification
    fileId: {
      type: String,
      required: [true, 'File ID is required'],
    },
    rowKey: {
      type: String,
      required: [true, 'Row Key is required'],
      index: true,
    },
    // Compound unique index on fileId and rowKey
    siteCode: {
      type: String,
      required: [true, 'Site Code is required'],
      index: true,
      trim: true,
      uppercase: true,
    },
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
    },
    // Reference to User model
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    // All original row data from the uploaded file (all columns)
    originalRowData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    // Original headers from the file
    headers: {
      type: [String],
      default: [],
    },
    // Site Observations (Resolved/Pending)
    siteObservations: {
      type: String,
      enum: ['Resolved', 'Pending', ''],
      default: '',
    },
    // Task Status
    taskStatus: {
      type: String,
      default: '',
      trim: true,
    },
    // Type of Issue
    typeOfIssue: {
      type: String,
      default: '',
      trim: true,
    },
    // CCR Status (Attended & Cleared, Attended & Not Cleared, Unattended)
    ccrStatus: {
      type: String,
      default: '',
      trim: true,
    },
    // View Photos (array of base64 image strings or URLs)
    viewPhotos: {
      type: [String],
      default: [],
    },
    // Photo metadata (latitude, longitude, timestamp, location for each photo)
    photoMetadata: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    // Remarks/notes
    remarks: {
      type: String,
      default: '',
      trim: true,
    },
    // Date of Inspection (for Resolved observations)
    dateOfInspection: {
      type: String,
      default: '',
      trim: true,
    },
    // Location information (extracted from row data)
    circle: {
      type: String,
      trim: true,
    },
    division: {
      type: String,
      trim: true,
    },
    subDivision: {
      type: String,
      trim: true,
    },
    // Source of the data
    savedFrom: {
      type: String,
      default: 'MY RTU TRACKER',
    },
    // Last synced timestamp
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'RTU Tracker Sites', // Explicit collection name
  }
);

// Compound unique index on fileId and rowKey to prevent duplicates
rtuTrackerSitesSchema.index({ fileId: 1, rowKey: 1 }, { unique: true });
// Indexes for efficient queries
rtuTrackerSitesSchema.index({ siteCode: 1, userId: 1 });
rtuTrackerSitesSchema.index({ userId: 1, updatedAt: -1 });
rtuTrackerSitesSchema.index({ fileId: 1 });

const RTUTrackerSites = mongoose.model('RTUTrackerSites', rtuTrackerSitesSchema);

export default RTUTrackerSites;

