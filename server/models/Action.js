import mongoose from 'mongoose';

const ActionSchema = new mongoose.Schema(
  {
    // Original row data from My Data
    rowData: { type: mongoose.Schema.Types.Mixed, required: true },
    // Headers from the original file
    headers: { type: [String], default: [] },
    // Routing information
    routing: { type: String, required: true }, // e.g., "Equipment Team", "RTU/Communication Team"
    typeOfIssue: { type: String, required: true }, // e.g., "Dismantled", "Spare", "Idle"
    remarks: { type: String, default: '' },
    // Photo attachments
    photo: { type: mongoose.Schema.Types.Mixed }, // Can be String or Array of Strings (base64)
    photoUrl: { type: String }, // URL if stored separately
    
    // Assignment information
    assignedToUserId: { type: String, required: true, index: true }, // User ID of the assigned user
    assignedToRole: { type: String, required: true }, // Role of assigned user (Equipment, RTU/Communication, AMC, O&M, etc.)
    assignedToDivision: { type: String, required: true }, // Division of assigned user (or Circle for AMC)
    // For AMC/vendor routing, store the vendor name the action is routed to
    assignedToVendor: { type: String }, // e.g., "Shrishaila Electricals(India Pvt ltd)", "Jyothi Electricals", "Spectrum Consultants"
    assignedByUserId: { type: String, required: true }, // User ID who routed this
    assignedByRole: { type: String, required: true }, // Role of user who routed this
    
    // Status tracking
    status: { 
      type: String, 
      enum: ['Pending', 'In Progress', 'Completed'], 
      default: 'Pending' 
    },
    priority: { 
      type: String, 
      enum: ['High', 'Medium', 'Low'], 
      default: 'Medium' 
    },
    
    // Original file reference
    sourceFileId: { type: String, required: true }, // Reference to the original upload file
    originalRowIndex: { type: Number }, // Index in original file for tracking
    
    // Timestamps
    assignedDate: { type: Date, default: Date.now },
    completedDate: { type: Date },
  },
  { timestamps: true }
);

// Index for efficient queries
ActionSchema.index({ assignedToUserId: 1, status: 1 });
ActionSchema.index({ assignedToRole: 1, assignedToDivision: 1 });

const Action = mongoose.models.Action || mongoose.model('Action', ActionSchema, 'actions');

export default Action;






