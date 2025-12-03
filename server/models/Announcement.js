import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    category: { type: String },
    date: { type: Date, default: Date.now },
    closingDate: { type: Date },
    linkText: { type: String },
    linkUrl: { type: String },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    createdBy: { type: String },
  },
  {
    timestamps: true,
    collection: 'Announcements',
  }
);

announcementSchema.index({ order: 1, createdAt: -1 });
announcementSchema.index({ isActive: 1, order: 1 });

export default mongoose.model('Announcement', announcementSchema);


