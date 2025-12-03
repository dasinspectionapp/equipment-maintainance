import mongoose from 'mongoose';

const AdminUploadFieldSchema = new mongoose.Schema(
  {
    fieldName: { 
      type: String, 
      required: true,
      trim: true
    },
    fieldKey: {
      type: String,
      required: true,
      unique: true, // unique: true automatically creates an index
      lowercase: true,
      trim: true
    },
    uploadedFile: {
      fileName: { type: String, default: '' },
      fileSize: { type: Number, default: 0 },
      fileType: { type: String, default: '' },
      fileUrl: { type: String, default: '' },
      uploadedAt: { type: Date }
    },
    createdBy: {
      type: String,
      default: 'admin'
    },
    order: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// Create index for faster queries (fieldKey already indexed via unique: true)
AdminUploadFieldSchema.index({ order: 1 });

// Use 'Admin Uploads' as the collection name in MongoDB
const AdminUploadField = mongoose.models.AdminUploadField || mongoose.model('AdminUploadField', AdminUploadFieldSchema, 'Admin Uploads');

export default AdminUploadField;

