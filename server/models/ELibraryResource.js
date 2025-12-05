import mongoose from 'mongoose';

const ELibraryResourceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['Manual', 'Guide', 'Documentation', 'Form', 'Policy', 'Procedure', 'Other'],
      default: 'Other'
    },
    file: {
      fileName: { type: String, default: '' },
      fileSize: { type: Number, default: 0 },
      fileType: { type: String, default: '' },
      fileUrl: { type: String, default: '' },
      uploadedAt: { type: Date }
    },
    link: {
      type: String,
      trim: true,
      default: ''
    },
    resourceType: {
      type: String,
      enum: ['file', 'link'],
      default: 'file'
    },
    tags: [{
      type: String,
      trim: true
    }],
    isActive: {
      type: Boolean,
      default: true
    },
    downloadCount: {
      type: Number,
      default: 0
    },
    order: {
      type: Number,
      default: 0
    },
    createdBy: {
      type: String,
      default: 'admin'
    }
  },
  { timestamps: true }
);

// Indexes for faster queries
ELibraryResourceSchema.index({ category: 1, isActive: 1 });
ELibraryResourceSchema.index({ tags: 1 });
ELibraryResourceSchema.index({ order: 1 });

const ELibraryResource = mongoose.models.ELibraryResource || 
  mongoose.model('ELibraryResource', ELibraryResourceSchema, 'E-Library Resources');

export default ELibraryResource;

