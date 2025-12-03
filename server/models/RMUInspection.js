import mongoose from 'mongoose';

const rmuInspectionSchema = new mongoose.Schema({
  siteCode: {
    type: String,
    required: [true, 'Site Code is required'],
    trim: true,
    unique: true
  },
  circle: {
    type: String,
    trim: true
  },
  division: {
    type: String,
    trim: true
  },
  subDivision: {
    type: String,
    trim: true
  },
  om: {
    type: String,
    trim: true
  },
  dateOfCommission: {
    type: Date
  },
  feederNumberAndName: {
    type: String,
    trim: true
  },
  inspectionDate: {
    type: Date,
    required: [true, 'Inspection Date is required']
  },
  rmuMakeType: {
    type: String,
    trim: true
  },
  locationHRN: {
    type: String,
    trim: true
  },
  serialNo: {
    type: String,
    trim: true
  },
  latLong: {
    type: String,
    trim: true
  },
  warrantyStatus: {
    type: String,
    trim: true
  },
  coFeederName: {
    type: String,
    trim: true
  },
  previousAMCDate: {
    type: Date
  },
  mfmMake: {
    type: String,
    trim: true
  },
  relayMakeModelNo: {
    type: String,
    trim: true
  },
  fpiMakeModelNo: {
    type: String,
    trim: true
  },
  rtuMakeSlno: {
    type: String,
    trim: true
  },
  rmuStatus: {
    type: String,
    enum: ['Working', 'Idler', 'Faulty', '']
  },
  availability24V: {
    type: String,
    enum: ['YES', 'NO', '']
  },
  ptVoltageAvailability: {
    type: String,
    enum: ['YES', 'NO', '']
  },
  batteryChargerCondition: {
    type: String,
    enum: ['Healthy', 'Faulty', '']
  },
  earthingConnection: {
    type: String,
    enum: ['Good', 'Poor', 'Disconnected', '']
  },
  commAccessoriesAvailability: {
    type: String,
    enum: ['Available', 'Not Available', '']
  },
  relayGroupChange: {
    type: String,
    trim: true
  },
  fpiStatus: {
    type: String,
    enum: ['Good', 'Faulty', 'Battery Faulty', '']
  },
  availability12V: {
    type: String,
    enum: ['YES', 'NO', '']
  },
  overallWiringIssue: {
    type: String,
    enum: ['YES', 'NO', 'Can be rectify', '']
  },
  controlCard: {
    type: String,
    enum: ['Healthy', 'Faulty', '']
  },
  beddingCondition: {
    type: String,
    enum: ['Good', 'Damaged', 'Poor', '']
  },
  batteryStatus: {
    type: String,
    enum: ['Good', 'Faulty', 'Not Available', '']
  },
  relayGroupChangeUpdate: {
    type: String,
    trim: true
  },
  availability230V: {
    type: String,
    enum: ['YES', 'NO', '']
  },
  sf6Gas: {
    type: String,
    enum: ['Green', 'Red', '']
  },
  rmuLocationSameAsGIS: {
    type: String,
    enum: ['YES', 'Shifted', '']
  },
  doorHydraulics: {
    type: String,
    enum: ['Good', 'Faulty', '']
  },
  controlCabinetDoor: {
    type: String,
    enum: ['Good', 'Damaged', 'Poor', '']
  },
  doorGasket: {
    type: String,
    enum: ['Good', 'Damaged', 'Poor', '']
  },
  dummyLatchCommand: {
    type: String,
    enum: ['Working', 'Not Working', '']
  },
  // Terminal data - stored as objects for OD1, OD2, VL1, VL2, VL3
  terminals: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  cableICFromOrOGTo: {
    type: String,
    trim: true
  },
  remarks: {
    type: String,
    trim: true
  },
  images: {
    type: [String], // Array of base64 image strings
    default: []
  },
  video: {
    type: String, // Base64 or URL
    default: null
  },
  pdfFile: {
    type: String, // Base64 or file reference
    default: null
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index on siteCode is automatically created by unique: true

const RMUInspection = mongoose.model('RMUInspection', rmuInspectionSchema);

export default RMUInspection;

