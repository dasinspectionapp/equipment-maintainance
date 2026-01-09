import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to MongoDB');
  
  // Check user's agency
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const user = await User.findOne({ userId: 'sreeshail' });
  console.log('\n=== User Info ===');
  console.log('User ID:', user?.userId);
  console.log('Agency Code:', user?.agencyCode);
  console.log('Agency Name:', user?.agencyName);
  console.log('Role:', user?.role);
  
  // Check agency
  const AgencyMaster = mongoose.model('AgencyMaster', new mongoose.Schema({}, { strict: false }), 'AgencyMaster');
  const agency = await AgencyMaster.findOne({ agencyCode: user?.agencyCode });
  console.log('\n=== Agency Info ===');
  console.log('Agency ID:', agency?._id);
  console.log('Agency Name:', agency?.agencyName);
  console.log('Agency Code:', agency?.agencyCode);
  
  // Check maintenance tasks
  const MaintenanceTask = mongoose.model('MaintenanceTask', new mongoose.Schema({}, { strict: false }), 'MaintenanceTasks');
  const tasks = await MaintenanceTask.find({ agencyId: agency?._id });
  console.log('\n=== Maintenance Tasks ===');
  console.log('Total tasks for agency:', tasks.length);
  console.log('Tasks:', tasks.map(t => ({ _id: t._id, status: t.status, siteCode: t.siteCode, dueDate: t.dueDate })));
  
  // Check pending tasks
  const pendingTasks = await MaintenanceTask.find({ 
    agencyId: agency?._id, 
    status: { $in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] } 
  });
  console.log('\n=== Pending Tasks ===');
  console.log('Pending tasks:', pendingTasks.length);
  console.log('Tasks:', pendingTasks.map(t => ({ _id: t._id, status: t.status, siteCode: t.siteCode })));
  
  mongoose.disconnect();
}).catch(err => console.error('Error:', err));

