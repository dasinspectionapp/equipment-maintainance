import mongoose from 'mongoose';

const UploadSchema = new mongoose.Schema(
  {
    fileId: { type: String, required: true, index: true, unique: true },
    name: { type: String, required: true },
    size: { type: Number, default: 0 },
    type: { type: String, default: '' },
    uploadType: { type: String, default: 'device-status-upload' }, // Track upload type: 'device-status-upload' or 'online-offline-data'
    uploadedAt: { type: Date, default: Date.now },
    headers: { type: [String], default: [] },
    rows: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true }
);

const Upload = mongoose.models.Upload || mongoose.model('Upload', UploadSchema, 'uploads');

export default Upload;




















