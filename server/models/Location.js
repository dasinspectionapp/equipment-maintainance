import mongoose from 'mongoose';

const LocationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      uppercase: true,
      unique: true,
      index: true
    },
    latitude: {
      type: Number,
      required: [true, 'Latitude is required'],
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      required: [true, 'Longitude is required'],
      min: -180,
      max: 180
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    kmlFilePath: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { timestamps: true }
);

// Note: name field already has index: true and unique: true, so no need for explicit index

const Location = mongoose.models.Location || mongoose.model('Location', LocationSchema);

export default Location;




