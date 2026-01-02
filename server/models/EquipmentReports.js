import mongoose from 'mongoose';

const equipmentReportsSchema = new mongoose.Schema(
  {
    // Report type (Resolved, Pending, LOCAL REMOTE)
    reportType: {
      type: String,
      required: [true, 'Report type is required'],
      index: true,
      trim: true,
    },
    // User who generated/viewed this report
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
    },
    // User role
    userRole: {
      type: String,
      required: true,
      index: true,
    },
    // Site Code
    siteCode: {
      type: String,
      index: true,
      trim: true,
      uppercase: true,
    },
    // Remarks
    remarks: {
      type: String,
      default: '',
      trim: true,
    },
    // Updated time and date
    updatedTimeAndDate: {
      type: String,
      default: '',
    },
    // CCR Status
    ccrStatus: {
      type: String,
      default: '',
      trim: true,
    },
    // Resolved by
    resolvedBy: {
      type: String,
      default: '',
      trim: true,
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
    // Site Observations
    siteObservations: {
      type: String,
      default: '',
      trim: true,
    },
    // Location information
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
    // Original row data (all columns from the source)
    originalRowData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Reference to EquipmentOfflineSites record (if applicable)
    equipmentOfflineSiteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EquipmentOfflineSites',
      index: true,
    },
    // Reference to RTUTrackerSites record (if applicable)
    rtuTrackerSiteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RTUTrackerSites',
      index: true,
    },
    // Filters used when generating this report
    filters: {
      circles: [String],
      divisions: [String],
      subDivisions: [String],
      fromDate: Date,
      toDate: Date,
      timeRange: String,
    },
    // Additional metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'Equipment Reports', // Explicit collection name - will be in 'das' database
  }
);

// Indexes for efficient queries
equipmentReportsSchema.index({ reportType: 1, userId: 1 });
equipmentReportsSchema.index({ userId: 1, reportType: 1 });
equipmentReportsSchema.index({ siteCode: 1 });
equipmentReportsSchema.index({ createdAt: -1 });
equipmentReportsSchema.index({ userId: 1, reportType: 1, createdAt: -1 });

// Create model - will use 'das' database when connection.useDb('das') is called
const EquipmentReports = mongoose.model('EquipmentReports', equipmentReportsSchema);

export default EquipmentReports;

