import mongoose from 'mongoose';

const maintenanceTaskSchema = new mongoose.Schema(
  {
    rmuId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RMUMaster',
      required: [true, 'RMU ID is required'],
      index: true
    },
    agencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AgencyMaster',
      required: [true, 'Agency ID is required'],
      index: true
    },
    checklistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChecklistMaster',
      required: [true, 'Checklist ID is required']
    },
    maintenanceType: {
      type: String,
      required: [true, 'Maintenance type is required'],
      enum: ['Routine', 'SF6'],
      default: 'Routine'
    },
    scheduledDate: {
      type: Date,
      required: [true, 'Scheduled date is required'],
      index: true
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
      index: true
    },
    status: {
      type: String,
      required: [true, 'Status is required'],
      enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED'],
      default: 'PENDING',
      index: true
    },
    // Additional metadata
    siteCode: {
      type: String,
      index: true
    },
    equipmentType: {
      type: String
    },
    completedAt: {
      type: Date
    },
    completedBy: {
      type: String
    },
    remarks: {
      type: String
    },
    // Audit fields
    createdBy: {
      type: String,
      default: 'SYSTEM'
    }
  },
  {
    timestamps: true,
    collection: 'MaintenanceTasks'
  }
);

// Compound indexes for efficient queries
maintenanceTaskSchema.index({ rmuId: 1, status: 1 });
maintenanceTaskSchema.index({ agencyId: 1, status: 1 });
maintenanceTaskSchema.index({ scheduledDate: 1, status: 1 });
maintenanceTaskSchema.index({ status: 1, dueDate: 1 });

const MaintenanceTask = mongoose.models.MaintenanceTask || mongoose.model('MaintenanceTask', maintenanceTaskSchema);

export default MaintenanceTask;

