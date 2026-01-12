
import { BookingStatus, Availability } from '../types';
import { bookingRepo, waitlistRepo, calendarRepo } from './storage';

// --- 1. CONFIGURATION ---

export const CAPACITY_RULES = {
  ONLINE_LIMIT: 220,      // Drempel voor directe online boekingen
  HARD_LIMIT: 230,        // Fysieke zaalcapaciteit (incl. admin/VIP)
  WAITLIST_LIMIT: 10      // Maximaal aantal inschrijvingen (bookings, niet pax) op wachtlijst
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
    r.status !== BookingStatus.WAITLIST // Waitlist items reserveren geen stoelen
  );
  
  const totalPax = activeRes.reduce((sum, r) => sum + r.partySize, 0);

  // 2. Waitlist
  const allWaitlist = waitlistRepo.getAll();
  const pendingWaitlist = allWaitlist.filter(w => 
    w.date === date && 
    w.status === 'PENDING'
  );

  // 3. Manual Override (Event Check)
  const event = calendarRepo.getAll().find(e => e.date === date);
  const manualStatus = event && event.type === 'SHOW' ? event.status : undefined;

  return { totalPax, waitlistCount: pendingWaitlist.length, manualStatus };
};

// --- 3. CORE LOGIC ---

/**
 * Bepaalt de live status van een datum op basis van de regels.
 * @param date ISO Date string (YYYY-MM-DD)
 */
export const getEventStatus = (date: string): Availability => {
  if (!date) return 'CLOSED';

  const { totalPax, waitlistCount, manualStatus } = getLiveStats(date);

  // 1. Admin Override heeft altijd voorrang
  if (manualStatus === 'CLOSED') return 'CLOSED';

  // 2. Waitlist Vol? -> CLOSED
  if (waitlistCount >= CAPACITY_RULES.WAITLIST_LIMIT) {
    return 'CLOSED';
  }

  // 3. Online Limiet Bereikt? -> WAITLIST
  // Zelfs als er fysiek nog plek is (220-230), gaat de shop dicht en de wachtlijst open.
  if (totalPax >= CAPACITY_RULES.ONLINE_LIMIT) {
    return 'WAITLIST';
  }

  // 4. Anders -> OPEN
  return 'OPEN';
};

/**
 * Checkt of een specifieke nieuwe groep nog past.
 * @param date ISO Date string
 * @param partySize Aantal personen
 */
export const canBook = (date: string, partySize: number): boolean => {
  const status = getEventStatus(date);
  
  // Als status niet OPEN is, kan er sowieso niet direct geboekt worden
  if (status !== 'OPEN') return false;

  const { totalPax } = getLiveStats(date);
  
  // Check of deze specifieke groep de limiet overschrijdt
  return (totalPax + partySize) <= CAPACITY_RULES.ONLINE_LIMIT;
};

// --- 4. ADVISOR (VOOR ADMIN) ---

export const getNextAction = (date: string): { action: string, priority: 'LOW' | 'MEDIUM' | 'HIGH' } => {
  const { totalPax, waitlistCount } = getLiveStats(date);
  const status = getEventStatus(date);

  if (status === 'CLOSED') {
    if (waitlistCount >= CAPACITY_RULES.WAITLIST_LIMIT) {
      return { action: 'Volledig vol. Geen actie mogelijk.', priority: 'LOW' };
    }
    return { action: 'Datum gesloten door Admin.', priority: 'LOW' };
  }

  if (status === 'WAITLIST') {
    const spotsFree = CAPACITY_RULES.HARD_LIMIT - totalPax;
    if (spotsFree > 0 && waitlistCount > 0) {
      return { action: `${spotsFree} plekken vrijgekomen! Nodig wachtlijst uit.`, priority: 'HIGH' };
    }
    return { action: 'Houdt wachtlijst in de gaten.', priority: 'MEDIUM' };
  }

  // OPEN
  const toFill = CAPACITY_RULES.ONLINE_LIMIT - totalPax;
  if (toFill > 50) return { action: 'Promoot deze avond (veel plek).', priority: 'MEDIUM' };
  if (toFill < 20) return { action: 'Bijna vol. Laatste plekken.', priority: 'HIGH' };

  return { action: 'Loopt volgens planning.', priority: 'LOW' };
};

// --- 5. UI HELPERS (LEGACY SUPPORT) ---

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

// Backwards compatibility alias if needed by imports
export const calculateEventStatus = (booked: number, capacity: number, wl: number, manual?: Availability) => {
  // Dit is een legacy wrapper. We gebruiken nu de live data, dus de params (behalve manual) worden genegeerd 
  // als we getEventStatus(date) zouden aanroepen. 
  // Echter, oude componenten roepen dit statisch aan. We emuleren de logica:
  
  if (manual === 'CLOSED') return 'CLOSED';
  if (wl >= CAPACITY_RULES.WAITLIST_LIMIT) return 'CLOSED';
  if (booked >= CAPACITY_RULES.ONLINE_LIMIT) return 'WAITLIST';
  return 'OPEN';
};
