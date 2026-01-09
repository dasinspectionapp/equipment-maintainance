import cron from 'node-cron';
import RMUMaster from '../models/RMUMaster.js';
import AgencyMaster from '../models/AgencyMaster.js';
import MaintenanceTask from '../models/MaintenanceTask.js';
import SchedulerLog from '../models/SchedulerLog.js';
import { calculateNextMaintenanceDate, calculateNextFutureMaintenance, calculateDueDate, isDateDue } from '../utils/maintenanceDateCalculator.js';

let schedulerTask = null;
let isSchedulerRunning = false;
let lastRunAt = null;
let nextRunAt = null;

/**
 * Core scheduler logic - processes all RMUs and creates maintenance tasks
 * @param {String} triggeredBy - Who triggered the scheduler
 * @param {String} triggerType - 'CRON' or 'MANUAL'
 * @returns {Object} - Execution summary
 */
export const runMaintenanceScheduler = async (triggeredBy = 'SYSTEM', triggerType = 'CRON') => {
  const startTime = Date.now();
  const errors = [];
  let tasksCreated = 0;
  let tasksSkipped = 0;
  let rmusProcessed = 0;

  try {
    console.log(`\n========================================`);
    console.log(`🔧 Maintenance Scheduler Started`);
    console.log(`Triggered by: ${triggeredBy} (${triggerType})`);
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`========================================\n`);

    // Get all RMUs with maintenance configured
    const rmus = await RMUMaster.find({
      isDeleted: false,
      maintenanceFrequency: { $exists: true, $ne: null, $ne: '' },
      maintenanceStartingDate: { $exists: true, $ne: null }
    }).lean();

    console.log(`📊 Found ${rmus.length} RMUs with maintenance configured`);

    for (const rmu of rmus) {
      rmusProcessed++;
      
      try {
        // Initialize or calculate nextMaintenanceDate
        if (!rmu.nextMaintenanceDate) {
          // If no next date is set, calculate the next future maintenance date from the starting date
          rmu.nextMaintenanceDate = calculateNextFutureMaintenance(
            rmu.maintenanceStartingDate,
            rmu.maintenanceFrequency
          );
          
          // Update the RMU with the calculated next date
          await RMUMaster.findByIdAndUpdate(rmu._id, {
            nextMaintenanceDate: rmu.nextMaintenanceDate
          });
          
          console.log(`🔄 RMU ${rmu.siteCode} - Calculated next maintenance date: ${new Date(rmu.nextMaintenanceDate).toLocaleDateString()}`);
        }

        // Check if maintenance is due (create task 14 days in advance)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const scheduledDate = new Date(rmu.nextMaintenanceDate);
        scheduledDate.setHours(0, 0, 0, 0);
        
        // Calculate the task creation date (14 days before scheduled date)
        const taskCreationDate = new Date(scheduledDate);
        taskCreationDate.setDate(taskCreationDate.getDate() - 14);
        
        if (today < taskCreationDate) {
          console.log(`⏰ RMU ${rmu.siteCode} - Not due yet (Next: ${scheduledDate.toLocaleDateString()})`);
          tasksSkipped++;
          continue;
        }

        // Check if Agency exists and is Active
        if (!rmu.agencyCode) {
          errors.push(`RMU ${rmu.siteCode}: No agency assigned`);
          tasksSkipped++;
          continue;
        }

        const agency = await AgencyMaster.findOne({
          agencyCode: rmu.agencyCode,
          status: 'Active'
        }).lean();

        if (!agency) {
          errors.push(`RMU ${rmu.siteCode}: Agency ${rmu.agencyCode} not found or inactive`);
          tasksSkipped++;
          continue;
        }

        // Check if open task already exists for this RMU
        const existingTask = await MaintenanceTask.findOne({
          rmuId: rmu._id,
          status: { $in: ['PENDING', 'IN_PROGRESS'] }
        });

        if (existingTask) {
          console.log(`📋 RMU ${rmu.siteCode} - Open task already exists (${existingTask.status})`);
          tasksSkipped++;
          continue;
        }

        // Fetch matching Checklist (Equipment type specific, Routine, Active)
        // Note: Assuming ChecklistMaster exists - adjust based on your schema
        const checklist = await findMatchingChecklist(rmu.equipmentType);

        if (!checklist) {
          errors.push(`RMU ${rmu.siteCode}: No active Routine checklist found for ${rmu.equipmentType}`);
          tasksSkipped++;
          continue;
        }

        // Create Maintenance Task
        const taskScheduledDate = new Date(rmu.nextMaintenanceDate);
        const dueDate = calculateDueDate(taskScheduledDate, 7); // 7 days grace period

        const newTask = await MaintenanceTask.create({
          rmuId: rmu._id,
          agencyId: agency._id,
          checklistId: checklist._id,
          maintenanceType: 'Routine',
          scheduledDate: taskScheduledDate,
          dueDate: dueDate,
          status: 'PENDING',
          siteCode: rmu.siteCode,
          equipmentType: rmu.equipmentType,
          createdBy: triggeredBy
        });

        // Update RMU with next maintenance date
        const nextDate = calculateNextMaintenanceDate(taskScheduledDate, rmu.maintenanceFrequency);
        
        await RMUMaster.findByIdAndUpdate(rmu._id, {
          nextMaintenanceDate: nextDate,
          lastMaintenanceScheduled: taskScheduledDate
        });

        tasksCreated++;
        console.log(`✅ RMU ${rmu.siteCode} - Task created (Next: ${nextDate.toLocaleDateString()})`);

      } catch (err) {
        const errorMsg = `RMU ${rmu.siteCode}: ${err.message}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    const executionTime = Date.now() - startTime;
    const status = errors.length === 0 ? 'SUCCESS' : (tasksCreated > 0 ? 'PARTIAL' : 'FAILED');

    // Log execution
    await SchedulerLog.create({
      runAt: new Date(),
      tasksCreated,
      tasksSkipped,
      rmusProcessed,
      errors,
      status,
      executionTime,
      triggerType,
      triggeredBy,
      details: `Processed ${rmusProcessed} RMUs, Created ${tasksCreated} tasks, Skipped ${tasksSkipped}`
    });

    lastRunAt = new Date();

    console.log(`\n========================================`);
    console.log(`✨ Scheduler Execution Complete`);
    console.log(`RMUs Processed: ${rmusProcessed}`);
    console.log(`Tasks Created: ${tasksCreated}`);
    console.log(`Tasks Skipped: ${tasksSkipped}`);
    console.log(`Errors: ${errors.length}`);
    console.log(`Execution Time: ${executionTime}ms`);
    console.log(`Status: ${status}`);
    console.log(`========================================\n`);

    return {
      success: true,
      tasksCreated,
      tasksSkipped,
      rmusProcessed,
      errors,
      executionTime,
      status
    };

  } catch (error) {
    console.error('❌ Scheduler execution failed:', error);
    
    // Log failure
    await SchedulerLog.create({
      runAt: new Date(),
      tasksCreated: 0,
      tasksSkipped: 0,
      rmusProcessed: 0,
      errors: [error.message],
      status: 'FAILED',
      executionTime: Date.now() - startTime,
      triggerType,
      triggeredBy,
      details: `Fatal error: ${error.message}`
    });

    return {
      success: false,
      error: error.message,
      tasksCreated: 0,
      errors: [error.message]
    };
  }
};

/**
 * Find matching checklist for equipment type
 * @param {String} equipmentType
 * @returns {Object|null}
 */
const findMatchingChecklist = async (equipmentType) => {
  try {
    // Import Checklist model dynamically
    const Checklist = (await import('../models/Checklist.js')).default;
    
    // Find active ROUTINE checklist for the equipment type
    const checklist = await Checklist.findOne({
      equipmentType: equipmentType,
      maintenanceType: 'ROUTINE',
      status: 'ACTIVE'
    }).lean();
    
    if (checklist) {
      console.log(`   ✓ Found checklist: ${checklist.checklistName} for ${equipmentType}`);
    } else {
      console.log(`   ✗ No checklist found for ${equipmentType}`);
    }
    
    return checklist;
  } catch (error) {
    console.error('Error finding checklist:', error);
    return null;
  }
};

/**
 * Initialize and start the cron scheduler
 */
export const initializeScheduler = () => {
  if (schedulerTask) {
    console.log('⚠️  Scheduler already initialized');
    return;
  }

  // Run daily at 2:00 AM
  schedulerTask = cron.schedule('0 2 * * *', async () => {
    if (isSchedulerRunning) {
      console.log('⚠️  Scheduler already running, skipping this execution');
      return;
    }

    isSchedulerRunning = true;
    try {
      await runMaintenanceScheduler('SYSTEM', 'CRON');
    } finally {
      isSchedulerRunning = false;
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata" // Adjust timezone as needed
  });

  // Calculate next run time
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(2, 0, 0, 0);
  nextRunAt = tomorrow;

  console.log('✅ Maintenance Scheduler initialized');
  console.log(`   Schedule: Daily at 2:00 AM IST`);
  console.log(`   Next Run: ${nextRunAt.toLocaleString()}`);
};

/**
 * Stop the scheduler
 */
export const stopScheduler = () => {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log('🛑 Scheduler stopped');
  }
};

/**
 * Get scheduler status
 */
export const getSchedulerStatus = async () => {
  const lastLog = await SchedulerLog.findOne().sort({ runAt: -1 }).lean();

  return {
    isRunning: isSchedulerRunning,
    isScheduled: schedulerTask !== null,
    lastRunAt: lastRunAt || lastLog?.runAt || null,
    nextRunAt: nextRunAt,
    lastRunStatus: lastLog?.status || null,
    tasksCreatedLastRun: lastLog?.tasksCreated || 0,
    lastRunErrors: lastLog?.errors || [],
    lastRunExecutionTime: lastLog?.executionTime || 0
  };
};

// Auto-update overdue tasks
export const updateOverdueTasks = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await MaintenanceTask.updateMany(
      {
        status: 'PENDING',
        dueDate: { $lt: today }
      },
      {
        $set: { status: 'OVERDUE' }
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`⚠️  Updated ${result.modifiedCount} tasks to OVERDUE status`);
    }

    return result.modifiedCount;
  } catch (error) {
    console.error('Error updating overdue tasks:', error);
    return 0;
  }
};

