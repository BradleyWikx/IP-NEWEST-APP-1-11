
import { BookingStatus, Availability } from '../types';
import { bookingRepo, waitlistRepo, calendarRepo } from './storage';

// --- 1. CONFIGURATION ---

export const CAPACITY_RULES = {
  ONLINE_BUFFER: 10,      // Keep 10 spots free for admin/door/VIP (Dynamic Limit = Capacity - 10)
  HARD_LIMIT_DEFAULT: 230,// Fallback if no capacity set
  WAITLIST_LIMIT: 10      // Max waitlist entries
};

// --- 2. DATA FETCHING (INTERNAL) ---

const getLiveStats = (date: string) => {
  // 1. Reservations
  const allRes = bookingRepo.getAll();
  const activeRes = allRes.filter(r => 
    r.date === date && 
    r.status !== BookingStatus.CANCELLED && 
    r.status !== BookingStatus.ARCHIVED && 
    r.status !== BookingStatus.NOSHOW &&
    r.status !== BookingStatus.WAITLIST
  );
  
  // FIX: Cast partySize to Number to prevent string concatenation
  const totalPax = activeRes.reduce((sum, r) => sum + (Number(r.partySize) || 0), 0);

  // 2. Waitlist
  const allWaitlist = waitlistRepo.getAll();
  const pendingWaitlist = allWaitlist.filter(w => 
    w.date === date && 
    w.status === 'PENDING'
  );

  // 3. Manual Override (Event Check)
  const event = calendarRepo.getAll().find(e => e.date === date);
  const manualStatus = event && event.type === 'SHOW' ? event.status : undefined;
  
  // Dynamic Capacity check
  const capacity = event && event.type === 'SHOW' && event.capacity ? Number(event.capacity) : CAPACITY_RULES.HARD_LIMIT_DEFAULT;

  return { totalPax, waitlistCount: pendingWaitlist.length, manualStatus, capacity };
};

// --- 3. CORE LOGIC ---

export const getEventStatus = (date: string): Availability => {
  if (!date) return 'CLOSED';

  const { totalPax, waitlistCount, manualStatus, capacity } = getLiveStats(date);

  // 1. Admin Override (Highest Priority)
  if (manualStatus === 'CLOSED') return 'CLOSED';
  if (manualStatus === 'WAITLIST') return 'WAITLIST';

  // 2. Waitlist Full?
  if (waitlistCount >= CAPACITY_RULES.WAITLIST_LIMIT) {
    return 'CLOSED';
  }

  // 3. Online Limit Calculation (Capacity - Buffer)
  const onlineLimit = capacity - CAPACITY_RULES.ONLINE_BUFFER;

  if (totalPax >= onlineLimit) {
    return 'WAITLIST';
  }

  return 'OPEN';
};

export const canBook = (date: string, partySize: number): boolean => {
  const status = getEventStatus(date);
  if (status !== 'OPEN') return false;

  const { totalPax, capacity } = getLiveStats(date);
  const onlineLimit = capacity - CAPACITY_RULES.ONLINE_BUFFER;
  
  return (totalPax + partySize) <= onlineLimit;
};

// --- 4. ADVISOR ---

export const getNextAction = (date: string): { action: string, priority: 'LOW' | 'MEDIUM' | 'HIGH' } => {
  const { totalPax, waitlistCount, capacity } = getLiveStats(date);
  const status = getEventStatus(date);

  if (status === 'CLOSED') {
    if (waitlistCount >= CAPACITY_RULES.WAITLIST_LIMIT) {
      return { action: 'Volledig vol. Geen actie mogelijk.', priority: 'LOW' };
    }
    return { action: 'Datum gesloten door Admin.', priority: 'LOW' };
  }

  if (status === 'WAITLIST') {
    const spotsFree = capacity - totalPax;
    if (spotsFree > 0 && waitlistCount > 0) {
      return { action: `${spotsFree} plekken vrijgekomen! Nodig wachtlijst uit.`, priority: 'HIGH' };
    }
    return { action: 'Houdt wachtlijst in de gaten.', priority: 'MEDIUM' };
  }

  const onlineLimit = capacity - CAPACITY_RULES.ONLINE_BUFFER;
  const toFill = onlineLimit - totalPax;
  
  if (toFill > 50) return { action: 'Promoot deze avond (veel plek).', priority: 'MEDIUM' };
  if (toFill < 20) return { action: 'Bijna vol. Laatste plekken.', priority: 'HIGH' };

  return { action: 'Loopt volgens planning.', priority: 'LOW' };
};

// --- 5. UI HELPERS ---

export const getStatusColor = (status: BookingStatus | string): string => {
  switch (status) {
    case BookingStatus.REQUEST: return 'blue';
    case BookingStatus.OPTION: return 'amber';
    case BookingStatus.CONFIRMED: return 'emerald';
    case BookingStatus.CANCELLED: return 'red';
    case BookingStatus.NOSHOW: return 'red';
    case BookingStatus.WAITLIST: return 'orange';
    case BookingStatus.INVITED: return 'purple';
    case BookingStatus.ARCHIVED: return 'slate';
    default: return 'slate';
  }
};

export const getStatusLabel = (status: BookingStatus | string): string => {
  switch (status) {
    case BookingStatus.REQUEST: return 'Aanvraag';
    case BookingStatus.OPTION: return 'Optie';
    case BookingStatus.CONFIRMED: return 'Bevestigd';
    case BookingStatus.CANCELLED: return 'Geannuleerd';
    case BookingStatus.NOSHOW: return 'No Show';
    case BookingStatus.WAITLIST: return 'Wachtlijst';
    case BookingStatus.INVITED: return 'Genodigde';
    case BookingStatus.ARCHIVED: return 'Archief';
    default: return status;
  }
};

export const getStatusStyles = (status: BookingStatus | string) => {
  const color = getStatusColor(status);
  if (status === BookingStatus.NOSHOW) {
    return 'bg-black text-red-500 border-red-900 border-2 font-black';
  }
  return `bg-${color}-900/20 text-${color}-500 border-${color}-900/50 border`;
};

// Corrected logic: Use passed capacity parameter
export const calculateEventStatus = (booked: number, capacity: number, wl: number, manual?: Availability) => {
  // CRITICAL FIX: Manual Waitlist overrides capacity checks
  if (manual === 'CLOSED') return 'CLOSED';
  if (manual === 'WAITLIST') return 'WAITLIST';
  
  if (wl >= CAPACITY_RULES.WAITLIST_LIMIT) return 'CLOSED';
  
  // Use the actual capacity passed in, minus buffer
  const effectiveLimit = capacity - CAPACITY_RULES.ONLINE_BUFFER;
  
  if (booked >= effectiveLimit) return 'WAITLIST';
  return 'OPEN';
};
