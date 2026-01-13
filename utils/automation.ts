
import { bookingRepo, tasksRepo } from './storage';
import { BookingStatus, TaskType } from '../types';

/**
 * Runs all background automation checks.
 * Called once when the Admin Layout mounts.
 */
export const runAutomations = () => {
  console.log("⚙️ Running System Automations...");
  checkExpiredOptions();
};

/**
 * Scans for Options that have expired or expire today.
 * Generates tasks for the sales team to follow up.
 */
const checkExpiredOptions = () => {
  const allReservations = bookingRepo.getAll();
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Find candidates: Status OPTION + Expired Date
  const expiredOptions = allReservations.filter(r => 
    r.status === BookingStatus.OPTION && 
    r.optionExpiresAt && 
    r.optionExpiresAt <= todayStr
  );

  if (expiredOptions.length === 0) return;

  const currentTasks = tasksRepo.getAll();
  let createdCount = 0;

  expiredOptions.forEach(res => {
    // Check if task already exists
    const taskExists = currentTasks.some(t => 
      t.entityId === res.id && 
      t.type === 'CALL_OPTION_EXPIRING' && 
      t.status !== 'DONE'
    );

    if (!taskExists) {
      tasksRepo.createAutoTask({
        type: 'CALL_OPTION_EXPIRING',
        title: `Verlopen Optie: ${res.customer.lastName}`,
        notes: `Optie verliep op ${res.optionExpiresAt}. Neem contact op om te bevestigen of vrij te geven.`,
        dueAt: new Date().toISOString(), // Due today
        entityType: 'RESERVATION',
        entityId: res.id
      });
      createdCount++;
    }
  });

  if (createdCount > 0) {
    console.log(`🤖 Generated ${createdCount} follow-up tasks for expired options.`);
  }
};
