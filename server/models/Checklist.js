import mongoose from 'mongoose';

const ParameterSchema = new mongoose.Schema({
  label: {
    type: String,
    required: [true, 'Parameter label is required'],
    trim: true
  },
  key: {
    type: String,
    required: [true, 'Parameter key is required'],
    trim: true
    // Unique per checklist, validated at checklist level
  },
  inputType: {
    type: String,
    enum: ['ENUM', 'BOOLEAN', 'TEXT'],
    required: [true, 'Input type is required']
  },
  options: {
    type: [String],
    default: [],
    validate: {
      validator: function(value) {
        // If inputType is ENUM, must have at least 2 options
        if (this.inputType === 'ENUM') {
          return value && value.length >= 2;
        }
        return true;
      },
      message: 'ENUM type must have at least 2 options'
    }
  },
  photoRequired: {
    type: Boolean,
    default: false
  },
  critical: {
    type: Boolean,
    default: false
  },
  active: {
    type: Boolean,
    default: true
  }
}, { _id: true });

const ChecklistSchema = new mongoose.Schema(
  {
    checklistName: {
      type: String,
      required: [true, 'Checklist name is required'],
      trim: true,
      unique: true
    },
    maintenanceType: {
      type: String,
      enum: ['ROUTINE', 'BREAKDOWN'],
      required: [true, 'Maintenance type is required']
    },
    equipmentType: {
      type: String,
      enum: ['RMU', 'SPB', 'LRC & LBS'],
      default: 'RMU'
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE'
    },
    parameters: {
      type: [ParameterSchema],
      validate: {
        validator: function(value) {
          return value && value.length > 0;
        },
        message: 'Checklist must have at least one parameter'
      }
    }
  },
  { 
    timestamps: true,
    collection: 'checklists'
  }
);

// Index for efficient queries
ChecklistSchema.index({ maintenanceType: 1, equipmentType: 1, status: 1 });

// Validate unique parameter keys within a checklist
ChecklistSchema.pre('save', function(next) {
  if (this.parameters && this.parameters.length > 0) {
    const keys = this.parameters.map(p => p.key);
    const uniqueKeys = new Set(keys);
    if (keys.length !== uniqueKeys.size) {
      return next(new Error('Parameter keys must be unique within a checklist'));
    }
  }
  next();
});

// Method to check if checklist is in use (will be implemented when RMU maintenance is added)
ChecklistSchema.methods.isInUse = async function() {
  // TODO: Check if this checklist is referenced by any RMU maintenance records
  // For now, return false
  // When routine maintenance is implemented, check:
  // const count = await mongoose.model('RoutineMaintenance').countDocuments({ checklistId: this._id });
  // return count > 0;
  return false;
};

const Checklist = mongoose.models.Checklist || mongoose.model('Checklist', ChecklistSchema);

export default Checklist;

