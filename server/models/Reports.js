import mongoose from 'mongoose';

const reportsSchema = new mongoose.Schema(
  {
    // Report category/type (e.g., 'Equipment Reports')
    category: {
      type: String,
      required: [true, 'Report category is required'],
      index: true,
      trim: true,
    },
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
    collection: 'Reports', // Explicit collection name
  }
);

// Indexes for efficient queries
reportsSchema.index({ category: 1, reportType: 1 });
reportsSchema.index({ userId: 1, category: 1, reportType: 1 });
reportsSchema.index({ siteCode: 1 });
reportsSchema.index({ createdAt: -1 });
reportsSchema.index({ category: 1, userId: 1, createdAt: -1 });

// Create model on default connection
// Note: We'll use useDb('das') when actually saving to ensure it goes to 'das' database
const Reports = mongoose.model('Reports', reportsSchema);

export default Reports;

