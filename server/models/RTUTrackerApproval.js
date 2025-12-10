import mongoose from 'mongoose';

const rtuTrackerApprovalSchema = new mongoose.Schema(
  {
    // Reference to the original Approval record (if exists)
    approvalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Approval',
      index: true,
    },
    // Reference to RTU Tracker Site
    rtuTrackerSiteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RTUTrackerSites',
      index: true,
    },
    // Site Code for quick reference
    siteCode: {
      type: String,
      required: [true, 'Site Code is required'],
      index: true,
      trim: true,
      uppercase: true,
    },
    // File and row identification
    fileId: {
      type: String,
      required: true,
      index: true,
    },
    rowKey: {
      type: String,
      required: true,
      index: true,
    },
    // Approval status
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Kept for Monitoring', 'Recheck Requested'],
      default: 'Pending',
      index: true,
    },
    // User who submitted the resolution
    submittedByUserId: {
      type: String,
      required: true,
      index: true,
    },
    submittedByRole: {
      type: String,
      required: true,
    },
    // User who is assigned to approve (CCR)
    assignedToUserId: {
      type: String,
      required: true,
      index: true,
    },
    assignedToRole: {
      type: String,
      required: true,
    },
    // User who approved (if completed)
    approvedByUserId: {
      type: String,
      index: true,
    },
    approvedByRole: {
      type: String,
    },
    // Approval date
    approvedAt: {
      type: Date,
    },
    // Type of Issue (selected by CCR)
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
    // CCR Remarks
    ccrRemarks: {
      type: String,
      default: '',
      trim: true,
    },
    // Field Team Action taken/Observation (from submission)
    fieldTeamAction: {
      type: String,
      default: '',
      trim: true,
    },
    // Date of Inspection
    dateOfInspection: {
      type: String,
      default: '',
      trim: true,
    },
    // Original remarks from the submitter
    submissionRemarks: {
      type: String,
      default: '',
      trim: true,
    },
    // Approval remarks from CCR
    approvalRemarks: {
      type: String,
      default: '',
      trim: true,
    },
    // Photos attached to the approval
    photos: {
      type: [String], // Array of base64 image strings or URLs
      default: [],
    },
    // Support documents
    supportDocuments: {
      type: [mongoose.Schema.Types.Mixed], // Array of { name: string, data: string }
      default: [],
    },
    // Original row data snapshot
    originalRowData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Additional metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'RTU Tracker Approval', // Explicit collection name
  }
);

// Indexes for efficient queries
rtuTrackerApprovalSchema.index({ assignedToUserId: 1, status: 1 });
rtuTrackerApprovalSchema.index({ siteCode: 1, status: 1 });
rtuTrackerApprovalSchema.index({ submittedByUserId: 1, createdAt: -1 });
rtuTrackerApprovalSchema.index({ assignedToUserId: 1, createdAt: -1 });
rtuTrackerApprovalSchema.index({ approvalId: 1 });
rtuTrackerApprovalSchema.index({ rtuTrackerSiteId: 1 });
rtuTrackerApprovalSchema.index({ fileId: 1, rowKey: 1 });

const RTUTrackerApproval = mongoose.models.RTUTrackerApproval || mongoose.model('RTUTrackerApproval', rtuTrackerApprovalSchema);

export default RTUTrackerApproval;



