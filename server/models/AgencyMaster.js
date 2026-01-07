import mongoose from 'mongoose';

const agencyMasterSchema = new mongoose.Schema({
  agencyName: {
    type: String,
    required: [true, 'Agency name is required'],
    trim: true,
    unique: true
  },
  agencyCode: {
    type: String,
    required: [true, 'Agency code is required'],
    trim: true,
    uppercase: true,
    unique: true
  },
  agencyType: {
    type: String,
    required: [true, 'Agency type is required'],
    enum: ['AMC', 'Survey', 'Installation', 'O&M', 'Other']
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true
  },
  // Contact Details
  contactPerson: {
    type: String,
    required: [true, 'Contact person is required'],
    trim: true
  },
  mobileNumber: {
    type: String,
    required: [true, 'Mobile number is required'],
    validate: {
      validator: function(v) {
        return /^\d{10}$/.test(v);
      },
      message: 'Mobile number must be exactly 10 digits'
    }
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
  },
  alternateContact: {
    type: String,
    trim: true
  },
  // Area/Asset Mapping
  circles: {
    type: [String],
    enum: ['NORTH', 'SOUTH', 'EAST', 'WEST'],
    default: []
  },
  divisions: {
    type: [String],
    enum: [
      'HSR', 'JAYANAGARA', 'KORAMANGALA', 'KENGERI', 'RAJAJINAGAR', 
      'RAJRAJESHWARANAGARA', 'INDIRANAGAR', 'PEENYA', 'JALHALLI', 
      'MALLESHWARAM', 'VIDHANASOUDHA', 'WHITEFIELD', 'SHIVAJINAGAR', 'HEBBAL'
    ],
    default: []
  },
  equipmentTypes: {
    type: [String],
    enum: ['RMU', 'SPB', 'LRC & LBS'],
    default: []
  },
  // Contract Details
  contractStartDate: {
    type: Date
  },
  contractEndDate: {
    type: Date
  },
  amcValue: {
    type: Number
  },
  remarks: {
    type: String,
    trim: true
  },
  // Audit Fields
  createdBy: {
    type: String
  },
  updatedBy: {
    type: String
  }
}, {
  timestamps: true,
  collection: 'AgencyMaster'
});

// Indexes
agencyMasterSchema.index({ agencyCode: 1 });
agencyMasterSchema.index({ agencyName: 1 });
agencyMasterSchema.index({ status: 1 });

const AgencyMaster = mongoose.models.AgencyMaster || mongoose.model('AgencyMaster', agencyMasterSchema);

export default AgencyMaster;
