import MaintenanceTask from '../models/MaintenanceTask.js';
import ChecklistExecution from '../models/ChecklistExecution.js';
import AgencyMaster from '../models/AgencyMaster.js';

export const getAMCTasks = async (req, res) => {
  try {
    if (req.user.role !== 'AMC') return res.status(403).json({ success: false, error: 'AMC role required' });
    const agency = await AgencyMaster.findOne({ agencyCode: req.user.agencyCode });
    if (!agency) return res.status(404).json({ success: false, error: 'Agency not found' });

    // Include SUBMITTED tasks so AMC can see what they've submitted
    const tasks = await MaintenanceTask.find({ agencyId: agency._id, status: { $in: ['PENDING', 'IN_PROGRESS', 'OVERDUE', 'SUBMITTED'] } })
      .populate('rmuId checklistId').sort({ status: 1, dueDate: 1 }).lean();

    const formatted = tasks.map(t => ({ 
      _id: t._id, 
      siteCode: t.rmuId?.siteCode || 'N/A', 
      equipmentType: t.rmuId?.equipmentType || 'N/A', 
      maintenanceType: t.maintenanceType, 
      checklistName: t.checklistId?.checklistName || 'N/A', 
      scheduledDate: t.scheduledDate, 
      dueDate: t.dueDate, 
      status: t.status,
      submittedAt: t.completedAt,
      submittedBy: t.completedBy,
      isOverdue: t.status !== 'SUBMITTED' && new Date() > new Date(t.dueDate),
      isSubmitted: t.status === 'SUBMITTED'
    }));
    return res.json({ success: true, count: formatted.length, data: formatted });
  } catch (error) {
    console.error('AMC Tasks Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch tasks' });
  }
};

export const getAMCTaskDetail = async (req, res) => {
  try {
    console.log('AMC Task Detail - Request params:', req.params);
    console.log('AMC Task Detail - User:', req.user.userId, req.user.role, req.user.agencyCode);
    
    if (req.user.role !== 'AMC') return res.status(403).json({ success: false, error: 'AMC role required' });
    
    const agency = await AgencyMaster.findOne({ agencyCode: req.user.agencyCode });
    console.log('AMC Task Detail - Agency found:', agency ? agency.agencyCode : 'NOT FOUND');
    
    if (!agency) return res.status(404).json({ success: false, error: 'Agency not found' });
    
    const task = await MaintenanceTask.findById(req.params.taskId).populate('rmuId checklistId').lean();
    console.log('AMC Task Detail - Task found:', task ? task._id : 'NOT FOUND');
    console.log('AMC Task Detail - Task agencyId:', task?.agencyId);
    console.log('AMC Task Detail - Task checklistId:', task?.checklistId);
    
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    
    // Compare agencyId directly (it's an ObjectId, not populated)
    if (task.agencyId.toString() !== agency._id.toString()) {
      console.log('AMC Task Detail - Agency mismatch:', task.agencyId.toString(), 'vs', agency._id.toString());
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    // Check if checklist was populated
    if (!task.checklistId || !task.checklistId.checklistName) {
      console.error('AMC Task Detail - Checklist not populated:', task.checklistId);
      return res.status(500).json({ success: false, error: 'Checklist not found' });
    }

    const responseData = { 
      task: { 
        _id: task._id, 
        siteCode: task.rmuId?.siteCode || 'N/A', 
        equipmentType: task.rmuId?.equipmentType || 'N/A', 
        maintenanceType: task.maintenanceType, 
        dueDate: task.dueDate,
        status: task.status,
        submittedAt: task.completedAt,
        submittedBy: task.completedBy
      }, 
      checklist: { 
        _id: task.checklistId._id, 
        checklistName: task.checklistId.checklistName, 
        parameters: task.checklistId.parameters.filter(p => p.active !== false).map(p => ({ 
          _id: p._id, 
          label: p.label, 
          key: p.key, 
          inputType: p.inputType, 
          options: p.options || [], 
          photoRequired: p.photoRequired, 
          critical: p.critical 
        })) 
      }
    };

    // If task is submitted, fetch the execution data to show what was submitted
    if (task.status === 'SUBMITTED') {
      const execution = await ChecklistExecution.findOne({ maintenanceTaskId: task._id }).lean();
      if (execution) {
        responseData.execution = {
          responses: execution.responses,
          submittedAt: execution.submittedAt,
          submittedBy: execution.submittedByName
        };
      }
      responseData.isReadOnly = true;
    }

    return res.json({ success: true, data: responseData });
  } catch (error) {
    console.error('AMC Task Detail Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch task' });
  }
};

export const submitChecklistExecution = async (req, res) => {
  try {
    if (req.user.role !== 'AMC') return res.status(403).json({ success: false, error: 'AMC role required' });
    const { responses } = req.body;
    const agency = await AgencyMaster.findOne({ agencyCode: req.user.agencyCode });
    const task = await MaintenanceTask.findById(req.params.taskId).populate('rmuId checklistId');
    if (!task || task.status === 'SUBMITTED') return res.status(400).json({ success: false, error: 'Invalid or already submitted' });

    const formatted = responses.map(r => { const p = task.checklistId.parameters.find(x => x.key === r.parameterKey); return { parameterKey: p.key, parameterLabel: p.label, inputType: p.inputType, value: r.value, photo: r.photo || null, photoRequired: p.photoRequired, critical: p.critical, remarks: r.remarks || null }; });

    await ChecklistExecution.create({ maintenanceTaskId: task._id, checklistId: task.checklistId._id, rmuId: task.rmuId._id, agencyId: agency._id, checklistName: task.checklistId.checklistName, equipmentType: task.rmuId.equipmentType, siteCode: task.rmuId.siteCode || task.siteCode, responses: formatted, submittedBy: req.user._id, submittedByName: req.user.fullName, submittedByUserId: req.user.userId, status: 'SUBMITTED' });

    task.status = 'SUBMITTED';
    task.completedAt = new Date();
    task.completedBy = req.user.fullName;
    await task.save();

    return res.json({ success: true, message: 'Submitted successfully' });
  } catch (error) {
    console.error('Submit Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to submit' });
  }
};

