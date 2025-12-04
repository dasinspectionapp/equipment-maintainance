import mongoose from 'mongoose';

const equipmentOfflineSitesSchema = new mongoose.Schema(
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
    // Original user ID - tracks the original owner even after ownership transfer
    // This ensures Pending Site Observations show in Reports tab for original owner
    originalUserId: {
      type: String,
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
    // CCR Status (Pending/Approved/Kept for Monitoring) - tracks CCR approval status for resolved observations
    ccrStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Kept for Monitoring', ''],
      default: '',
    },
    // Task Status (calculated from routing actions)
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
    // Support Documents (for AMC users - PDF files)
    supportDocuments: {
      type: [mongoose.Schema.Types.Mixed], // Array of { name: string, data: string }
      default: [],
    },
    // Status of the offline site
    status: {
      type: String,
      enum: ['Offline', 'Online', 'Pending', 'Resolved'],
      default: 'Offline',
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
    // Device Status (from ONLINE-OFFLINE DATA file)
    deviceStatus: {
      type: String,
      trim: true,
    },
    // No of Days Offline (from ONLINE-OFFLINE DATA file)
    noOfDaysOffline: {
      type: Number,
    },
    // Source of the data
    savedFrom: {
      type: String,
      default: 'MY OFFLINE SITES',
    },
    // Last synced timestamp
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'Equipment offline sites', // Explicit collection name
  }
);

// Compound unique index on fileId and rowKey to prevent duplicates
equipmentOfflineSitesSchema.index({ fileId: 1, rowKey: 1 }, { unique: true });
// Indexes for efficient queries
equipmentOfflineSitesSchema.index({ siteCode: 1, userId: 1 });
equipmentOfflineSitesSchema.index({ userId: 1, updatedAt: -1 });
equipmentOfflineSitesSchema.index({ originalUserId: 1, updatedAt: -1 }); // For Reports query by original owner
equipmentOfflineSitesSchema.index({ status: 1 });
equipmentOfflineSitesSchema.index({ siteCode: 1, status: 1 });
equipmentOfflineSitesSchema.index({ fileId: 1 });

const EquipmentOfflineSites = mongoose.model('EquipmentOfflineSites', equipmentOfflineSitesSchema);

export default EquipmentOfflineSites;

