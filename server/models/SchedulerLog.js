import mongoose from 'mongoose';

const schedulerLogSchema = new mongoose.Schema(
  {
    runAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    tasksCreated: {
      type: Number,
      required: true,
      default: 0
    },
    tasksSkipped: {
      type: Number,
      default: 0
    },
    rmusProcessed: {
      type: Number,
      default: 0
    },
    errors: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      required: true,
      enum: ['SUCCESS', 'FAILED', 'PARTIAL'],
      default: 'SUCCESS'
    },
    executionTime: {
      type: Number, // in milliseconds
      default: 0
    },
    triggerType: {
      type: String,
      enum: ['CRON', 'MANUAL'],
      default: 'CRON'
    },
    triggeredBy: {
      type: String,
      default: 'SYSTEM'
    },
    details: {
      type: String
    }
  },
  {
    timestamps: false,
    collection: 'SchedulerLogs'
  }
);

// Index for querying recent logs
schedulerLogSchema.index({ runAt: -1 });
schedulerLogSchema.index({ status: 1, runAt: -1 });

const SchedulerLog = mongoose.models.SchedulerLog || mongoose.model('SchedulerLog', schedulerLogSchema);

export default SchedulerLog;

