import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      unique: true,
      required: false, // Will be set by pre-save hook
      trim: true
    },
    userId: {
      type: String,
      required: true,
      trim: true
    },
    userName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    mobile: {
      type: String,
      trim: true
    },
    application: {
      type: String,
      required: true,
      trim: true
      // No enum restriction - allows "Other" custom values
    },
    category: {
      type: String,
      required: true,
      trim: true
      // No enum restriction - allows "Other" custom values
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    priority: {
      type: String,
      required: true,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium'
    },
    status: {
      type: String,
      required: true,
      enum: ['Open', 'Assigned', 'In Progress', 'Waiting for User', 'Resolved', 'Closed'],
      default: 'Open'
    },
    attachments: [
      {
        fileName: String,
        fileUrl: String,
        fileSize: Number,
        fileType: String,
        uploadedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    // Auto-captured information
    userIP: {
      type: String,
      trim: true
    },
    browser: {
      type: String,
      trim: true
    },
    os: {
      type: String,
      trim: true
    },
    // Assignment and tracking
    assignedTo: {
      userId: {
        type: String,
        trim: true
      },
      userName: {
        type: String,
        trim: true
      },
      assignedAt: {
        type: Date
      }
    },
    // Comments/Replies
    comments: [
      {
        userId: {
          type: String,
          required: true
        },
        userName: {
          type: String,
          required: true
        },
        userRole: {
          type: String,
          required: true
        },
        comment: {
          type: String,
          required: true,
          trim: true
        },
        isInternal: {
          type: Boolean,
          default: false // false = visible to user, true = admin/internal only
        },
        attachments: [
          {
            fileName: String,
            fileUrl: String,
            fileSize: Number,
            fileType: String
          }
        ],
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    // Internal notes (admin only)
    internalNotes: [
      {
        userId: {
          type: String,
          required: true
        },
        userName: {
          type: String,
          required: true
        },
        note: {
          type: String,
          required: true,
          trim: true
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    // Status history
    statusHistory: [
      {
        status: {
          type: String,
          required: true
        },
        changedBy: {
          userId: String,
          userName: String
        },
        changedAt: {
          type: Date,
          default: Date.now
        },
        note: String
      }
    ],
    // Resolution details
    resolvedAt: {
      type: Date
    },
    resolvedBy: {
      userId: {
        type: String,
        trim: true
      },
      userName: {
        type: String,
        trim: true
      }
    },
    resolutionNote: {
      type: String,
      trim: true
    },
    closedAt: {
      type: Date
    },
    closedBy: {
      userId: {
        type: String,
        trim: true
      },
      userName: {
        type: String,
        trim: true
      }
    }
  },
  {
    timestamps: true
  }
);

// Indexes for faster queries
ticketSchema.index({ ticketNumber: 1 });
ticketSchema.index({ userId: 1 });
ticketSchema.index({ status: 1 });
ticketSchema.index({ priority: 1 });
ticketSchema.index({ category: 1 });
ticketSchema.index({ createdAt: -1 });
ticketSchema.index({ 'assignedTo.userId': 1 });

// Generate unique ticket number before saving
ticketSchema.pre('save', async function (next) {
  // Only generate if ticketNumber is not already set (for new documents)
  if (!this.ticketNumber && this.isNew) {
    try {
      // Use the model directly (Ticket is defined at the bottom of this file)
      const TicketModel = this.constructor;
      const count = await TicketModel.countDocuments({});
      const timestamp = Date.now().toString().slice(-6);
      const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      this.ticketNumber = `TKT-${timestamp}-${String(count + 1).padStart(4, '0')}-${randomSuffix}`;
      
      // Ensure uniqueness by checking if it exists (unlikely but possible)
      const existing = await TicketModel.findOne({ ticketNumber: this.ticketNumber });
      if (existing) {
        // If exists, regenerate with different random suffix
        const newRandomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        this.ticketNumber = `TKT-${timestamp}-${String(count + 1).padStart(4, '0')}-${newRandomSuffix}`;
      }
    } catch (error) {
      console.error('Error generating ticket number:', error);
      // Fallback: use timestamp and random number
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 100000);
      this.ticketNumber = `TKT-${timestamp}-${random}`;
    }
  }
  next();
});

// Add status change to history
ticketSchema.methods.addStatusHistory = function (status, changedBy, note) {
  this.statusHistory.push({
    status,
    changedBy: {
      userId: changedBy.userId,
      userName: changedBy.userName
    },
    changedAt: new Date(),
    note: note || ''
  });
};

const Ticket = mongoose.model('Ticket', ticketSchema);

export default Ticket;

