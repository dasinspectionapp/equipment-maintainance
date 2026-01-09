import mongoose from 'mongoose';

const ParameterResponseSchema = new mongoose.Schema({
  parameterKey: { type: String, required: true },
  parameterLabel: { type: String, required: true },
  inputType: { type: String, enum: ['ENUM', 'BOOLEAN', 'TEXT'], required: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  photo: { type: String, default: null },
  photoRequired: { type: Boolean, default: false },
  critical: { type: Boolean, default: false },
  remarks: { type: String, default: null }
});

const ChecklistExecutionSchema = new mongoose.Schema({
  maintenanceTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'MaintenanceTask', required: true, unique: true },
  checklistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Checklist', required: true },
  rmuId: { type: mongoose.Schema.Types.ObjectId, ref: 'RMUMaster', required: true },
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'AgencyMaster', required: true },
  checklistName: { type: String, required: true },
  equipmentType: { type: String, required: true },
  siteCode: { type: String, required: true },
  responses: [ParameterResponseSchema],
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  submittedByName: { type: String, required: true },
  submittedByUserId: { type: String, required: true },
  submittedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['SUBMITTED', 'APPROVED', 'REJECTED'], default: 'SUBMITTED' }
}, { timestamps: true, collection: 'ChecklistExecutions' });

export default mongoose.models.ChecklistExecution || mongoose.model('ChecklistExecution', ChecklistExecutionSchema);

