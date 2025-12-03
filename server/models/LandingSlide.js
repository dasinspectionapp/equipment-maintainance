import mongoose from 'mongoose';

const landingSlideSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String },
    description: { type: String },
    eyebrow: { type: String },
    imageData: { type: String, required: true },
    backgroundImageData: { type: String },
    ctaLabel: { type: String },
    ctaUrl: { type: String },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: String },
  },
  {
    timestamps: true,
    collection: 'LandingPage',
  }
);

landingSlideSchema.index({ order: 1, createdAt: 1 });

export default mongoose.model('LandingSlide', landingSlideSchema);



