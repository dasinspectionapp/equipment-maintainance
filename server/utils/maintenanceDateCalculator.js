/**
 * Calculate next maintenance date based on frequency
 * @param {Date} startDate - Starting date for calculation
 * @param {String} frequency - Maintenance frequency
 * @returns {Date} - Next maintenance date
 */
export const calculateNextMaintenanceDate = (startDate, frequency) => {
  if (!startDate || !frequency) {
    throw new Error('Start date and frequency are required');
  }

  const date = new Date(startDate);
  
  // Validate date
  if (isNaN(date.getTime())) {
    throw new Error('Invalid start date');
  }

  switch (frequency) {
    case '15 Days':
      date.setDate(date.getDate() + 15);
      break;
    
    case 'Monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    
    case '2 Months':
      date.setMonth(date.getMonth() + 2);
      break;
    
    case 'Quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    
    case '4 Months':
      date.setMonth(date.getMonth() + 4);
      break;
    
    case '5 Months':
      date.setMonth(date.getMonth() + 5);
      break;
    
    case 'Half-Yearly':
      date.setMonth(date.getMonth() + 6);
      break;
    
    case '7 Months':
      date.setMonth(date.getMonth() + 7);
      break;
    
    case '8 Months':
      date.setMonth(date.getMonth() + 8);
      break;
    
    case '9 Months':
      date.setMonth(date.getMonth() + 9);
      break;
    
    case '10 Months':
      date.setMonth(date.getMonth() + 10);
      break;
    
    case '11 Months':
      date.setMonth(date.getMonth() + 11);
      break;
    
    case 'Yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    
    default:
      throw new Error(`Unsupported frequency: ${frequency}`);
  }

  return date;
};

/**
 * Calculate due date (typically same as scheduled date + grace period)
 * @param {Date} scheduledDate - Scheduled maintenance date
 * @param {Number} gracePeriodDays - Grace period in days (default 7)
 * @returns {Date} - Due date
 */
export const calculateDueDate = (scheduledDate, gracePeriodDays = 7) => {
  const date = new Date(scheduledDate);
  date.setDate(date.getDate() + gracePeriodDays);
  return date;
};

/**
 * Check if a date is due (today or past)
 * @param {Date} date - Date to check
 * @returns {Boolean}
 */
export const isDateDue = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0);
  
  return compareDate <= today;
};

/**
 * Check if a task is overdue
 * @param {Date} dueDate - Due date of task
 * @returns {Boolean}
 */
export const isOverdue = (dueDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  
  return due < today;
};

/**
 * Calculate the next future maintenance date from a starting date
 * If the starting date is in the past, advance it by frequency until it's in the future
 * @param {Date} startDate - Starting maintenance date
 * @param {String} frequency - Maintenance frequency
 * @returns {Date} - Next future maintenance date
 */
export const calculateNextFutureMaintenance = (startDate, frequency) => {
  if (!startDate || !frequency) {
    throw new Error('Start date and frequency are required');
  }

  let nextDate = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Keep advancing the date by frequency until it's in the future
  while (nextDate <= today) {
    nextDate = calculateNextMaintenanceDate(nextDate, frequency);
  }
  
  return nextDate;
};

/**
 * Get frequency options
 * @returns {Array} - Array of frequency options
 */
export const getFrequencyOptions = () => {
  return [
    '15 Days',
    'Monthly',
    '2 Months',
    'Quarterly',
    '4 Months',
    '5 Months',
    'Half-Yearly',
    '7 Months',
    '8 Months',
    '9 Months',
    '10 Months',
    '11 Months',
    'Yearly'
  ];
};
