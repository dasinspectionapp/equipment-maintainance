import mongoose from 'mongoose';

const rmuMasterSchema = new mongoose.Schema(
  {
    // Location Information
    circle: {
      type: String,
      required: [true, 'Circle is required'],
      enum: ['NORTH', 'SOUTH', 'EAST', 'WEST'],
      index: true
    },
    division: {
      type: String,
      required: [true, 'Division is required'],
      enum: [
        'HSR', 'JAYANAGARA', 'KORAMANGALA', 'KENGERI', 'RAJAJINAGAR', 
        'RAJRAJESHWARANAGARA', 'INDIRANAGAR', 'PEENYA', 'JALHALLI', 
        'MALLESHWARAM', 'VIDHANASOUDHA', 'WHITEFIELD', 'SHIVAJINAGAR', 'HEBBAL'
      ],
      index: true
    },
    subDivision: {
      type: String,
      trim: true,
      uppercase: true,
      default: ''
    },
    siteCode: {
      type: String,
      required: [true, 'Site Code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },

    // RMU Identification
    hrn: {
      type: String,
      required: [true, 'HRN is required'],
      trim: true,
      uppercase: true,
      index: true
    },
    rmuMake: {
      type: String,
      trim: true
    },
    equipmentType: {
      type: String,
      required: [true, 'Equipment Type is required'],
      enum: ['RMU', 'SPB', 'LRC & LBS']
    },

    // Dates
    installationDate: {
      type: Date
    },
    commissioningDate: {
      type: Date
    },
    maintenanceStartingDate: {
      type: Date
    },

    // Maintenance
    maintenanceFrequency: {
      type: String,
      enum: [
        'Monthly', 'Quarterly', 'Half-Yearly', 'Yearly',
        '2 Months', '4 Months', '5 Months', '7 Months',
        '8 Months', '9 Months', '10 Months', '11 Months',
        '15 Days', ''
      ]
    },
    nextMaintenanceDate: {
      type: Date,
      index: true
    },
    lastMaintenanceScheduled: {
      type: Date
    },

    // Coordinates
    latitude: {
      type: Number,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180
    },

    // Agency Association
    agencyCode: {
      type: String,
      trim: true,
      uppercase: true
    },

    // Upload Metadata
    uploadedBy: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    uploadBatchId: {
      type: String,
      index: true
    },

    // Audit Fields
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date
    },
    deletedBy: {
      type: String
    }
  },
  {
    timestamps: true,
    collection: 'RMUMaster'
  }
);

// Indexes for efficient queries
rmuMasterSchema.index({ siteCode: 1 });
rmuMasterSchema.index({ hrn: 1 });
rmuMasterSchema.index({ circle: 1, division: 1 });
rmuMasterSchema.index({ agencyCode: 1 });
rmuMasterSchema.index({ status: 1 });
rmuMasterSchema.index({ uploadBatchId: 1 });
rmuMasterSchema.index({ isDeleted: 1 });

// Compound index for location queries
rmuMasterSchema.index({ circle: 1, division: 1, subDivision: 1 });

const RMUMaster = mongoose.models.RMUMaster || mongoose.model('RMUMaster', rmuMasterSchema);

export default RMUMaster;
