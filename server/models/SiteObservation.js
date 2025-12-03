import mongoose from 'mongoose';

const siteObservationSchema = new mongoose.Schema(
  {
    siteCode: {
      type: String,
      required: [true, 'Site Code is required'],
      index: true,
      trim: true,
      uppercase: true,
    },
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Resolved'],
      required: true,
    },
    typeOfIssue: {
      type: String,
      default: '',
    },
    rawTypeOfIssue: {
      type: String,
      default: '',
    },
    specifyOther: {
      type: String,
      default: '',
    },
    typeOfSpare: {
      type: [String],
      default: [],
    },
    specifySpareOther: {
      type: String,
      default: '',
    },
    remarks: {
      type: String,
      default: '',
    },
    capturedPhotos: {
      type: [String], // Array of base64 image strings
      default: [],
    },
    uploadedPhotos: {
      type: [String], // Array of file URLs or references
      default: [],
    },
    viewPhotos: {
      type: [String], // Array of photo data URLs
      default: [],
    },
    savedFrom: {
      type: String,
      default: 'Web Application',
    },
  },
  { timestamps: true }
);

// Compound index for efficient queries
siteObservationSchema.index({ siteCode: 1, userId: 1 });
siteObservationSchema.index({ userId: 1, updatedAt: -1 });

const SiteObservation = mongoose.models.SiteObservation || mongoose.model('SiteObservation', siteObservationSchema);

export default SiteObservation;


