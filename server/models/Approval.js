import mongoose from 'mongoose';

const approvalSchema = new mongoose.Schema(
  {
    // Reference to the action that triggered this approval
    actionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Action',
    },
    // Site Code for quick reference
    siteCode: {
      type: String,
      required: [true, 'Site Code is required'],
      index: true,
      trim: true,
      uppercase: true,
    },
    // Reference to EquipmentOfflineSites record
    equipmentOfflineSiteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EquipmentOfflineSites',
    },
    // Reference to RTUTrackerSites record
    rtuTrackerSiteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RTUTrackerSites',
    },
    // Approval type
    approvalType: {
      type: String,
      required: true,
      enum: ['AMC Resolution Approval', 'CCR Resolution Approval', 'RTU Tracker Resolution Approval'],
      index: true,
    },
    // Current status of the approval
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Kept for Monitoring', 'Recheck Requested'],
      default: 'Pending',
      index: true,
    },
    // User who submitted the resolution (AMC user for AMC Resolution Approval)
    submittedByUserId: {
      type: String,
      required: true,
      index: true,
    },
    submittedByRole: {
      type: String,
      required: true,
    },
    // User who is assigned to approve (Equipment or CCR)
    assignedToUserId: {
      type: String,
      required: true,
      index: true,
    },
    assignedToRole: {
      type: String,
      required: true,
    },
    // User who approved/rejected (if completed)
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
    // Remarks from the approver
    approvalRemarks: {
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
    // Photos attached to the approval
    photos: {
      type: [String], // Array of base64 image strings or URLs
      default: [],
    },
    // Support documents (for AMC users - PDF files)
    supportDocuments: {
      type: [mongoose.Schema.Types.Mixed], // Array of { name: string, data: string }
      default: [],
    },
    // File and row identification for reference
    fileId: {
      type: String,
      index: true,
    },
    rowKey: {
      type: String,
      index: true,
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
    collection: 'Approvals', // Explicit collection name
  }
);

// Indexes for efficient queries
approvalSchema.index({ assignedToUserId: 1, status: 1 });
approvalSchema.index({ siteCode: 1, status: 1 });
approvalSchema.index({ approvalType: 1, status: 1 });
approvalSchema.index({ submittedByUserId: 1, createdAt: -1 });
approvalSchema.index({ assignedToUserId: 1, createdAt: -1 });
approvalSchema.index({ actionId: 1 });
approvalSchema.index({ equipmentOfflineSiteId: 1 });

const Approval = mongoose.models.Approval || mongoose.model('Approval', approvalSchema);

export default Approval;

