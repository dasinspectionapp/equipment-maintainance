import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    unique: true,
    trim: true,
    lowercase: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    validate: {
      validator: function(v) {
        return /^\d{10}$/.test(v);
      },
      message: 'Mobile must be exactly 10 digits'
    }
  },
  designation: {
    type: String,
    required: [true, 'Designation is required'],
    enum: [
      'System Admin',
      'Junior Engineer (J.E)',
      'Assistant Engineer (A.E)',
      'Assistant Executive Engineer (AEE)',
      'Executive Engineer (EE)',
      'Superintendent Engineer (SE)'
    ]
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
    enum: ['Admin', 'Equipment', 'CCR', 'AMC', 'RTU/Communication', 'Planning', 'O&M']
  },
  circle: {
    type: [String],
    enum: ['NORTH', 'SOUTH', 'EAST', 'WEST'],
    default: []
  },
  division: {
    type: [String],
    enum: [
      'HSR', 'JAYANAGARA', 'KORAMANGALA', 'KENGERI', 'RAJAJINAGAR', 
      'RAJRAJESHWARANAGARA', 'INDIRANAGAR', 'PEENYA', 'JALHALLI', 
      'MALLESHWARAM', 'VIDHANASOUDHA', 'WHITEFIELD', 'SHIVAJINAGAR', 'HEBBAL'
    ],
    default: []
  },
  subDivision: {
    type: [String],
    enum: [
      'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7',
      'E1', 'E2', 'E3', 'E4', 'E5', 'E6',
      'W1', 'W2', 'W3'
    ],
    default: []
  },
  sectionName: {
    type: String,
    trim: true
  },
  vendor: {
    type: String,
    enum: [
      'Shrishaila Electricals(India Pvt ltd)',
      'Spectrum Consultants',
      'Jyothi Electricals',
      'Vendor1',
      'Vendor2'
    ],
    trim: true
  },
  mappedTo: {
    type: [String],
    enum: ['Equipment Maintenance', 'Equipment Survey'],
    default: []
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

const User = mongoose.model('User', userSchema);

export default User;

