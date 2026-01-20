
import { 
  CalendarEvent, 
  Reservation, 
  ShowDefinition, 
  ShowEvent, 
  Availability 
} from '../types';
import { 
  getCalendarEvents, 
  getReservations, 
  getShowDefinitions 
} from '../utils/storage';

// --- Types ---

export interface AvailabilityQuery {
  partySize: number;
  dateRange: {
    start: string; // YYYY-MM-DD
    end: string;   // YYYY-MM-DD
  };
  profileFilter?: string; // Show Definition ID or 'ALL'
  weekdays?: number[]; // 0=Sun, 1=Mon...
  includeClosed?: boolean; // For admin overrides
  // Optional dependency injection for testing
  data?: {
    events: CalendarEvent[];
    reservations: Reservation[];
    shows: ShowDefinition[];
  };
}

export interface RankedSlot {
  // Core Data
  date: string;
  showId: string;
  eventId: string;
  
  // Computed Metrics
  capacity: number;
  booked: number;
  remaining: number;
  remainingAfterBooking: number;
  occupancyRate: number; // New metric
  
  // Logic Flags
  fits: boolean;
  isTight: boolean; // True if fits but leaves very few seats (e.g. < 5)
  status: Availability;
  
  // Display Fields
  showLabel: string;
  timeLabel: string; // Start time
  availabilityBadge: 'OPEN' | 'ALMOST_FULL' | 'LAST_SPOTS' | 'FULL' | 'WAITLIST' | 'CLOSED';
  capacityHint: string; // e.g., "180/230 booked"
  
  // Ranking Debug
  rankScore: number; 
}

// --- Constants ---

const TIGHT_THRESHOLD = 10; 
const URGENCY_THRESHOLD = 0.8; // 80%

// --- Main Logic ---

export const findAvailableShowDates = (query: AvailabilityQuery): RankedSlot[] => {
  // 1. Load Data (Injection or Store)
  const events = query.data?.events || getCalendarEvents();
  const reservations = query.data?.reservations || getReservations();
  const shows = query.data?.shows || getShowDefinitions();

  const { start, end } = query.dateRange;
  
  // 24H LOCK: Filter out dates closer than 24h from now unless includeClosed (admin override) is true
  const now = new Date();
  const cutoffDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  // 2. Filter Candidate Events
  const candidates = events.filter(e => {
    // Must be a Show
    if (e.type !== 'SHOW') return false;
    const showEvent = e as ShowEvent;
    
    // Find Definition
    const showDef = shows.find(s => s.id === showEvent.showId);
    
    // Check if Show is Active
    if (!showDef || !showDef.isActive) return false;

    // Check Show Definition Date Range (if set)
    if (showDef.activeFrom && e.date < showDef.activeFrom) return false;
    if (showDef.activeTo && e.date > showDef.activeTo) return false;

    // Date Range
    if (e.date < start || e.date > end) return false;
    
    // 24H Rule Check (Online Booking Block)
    if (!query.includeClosed && e.date < cutoffStr) {
      return false; 
    }
    
    // Weekday Filter
    if (query.weekdays && query.weekdays.length > 0) {
      const day = new Date(e.date).getDay();
      if (!query.weekdays.includes(day)) return false;
    }

    // Profile/Show Filter
    if (query.profileFilter && query.profileFilter !== 'ALL') {
      // Filter matches either Show ID (e.g. 'matinee') or specific Profile ID
      if (showEvent.showId !== query.profileFilter && showEvent.profileId !== query.profileFilter) {
        return false;
      }
    }

    return true;
  }) as ShowEvent[];

  // 3. Process & Rank
  const results: RankedSlot[] = candidates.map(event => {
    const showDef = shows.find(s => s.id === event.showId);
    
    // Calculate Occupancy
    const eventReservations = reservations.filter(r => 
      r.date === event.date && 
      r.status !== 'CANCELLED' && 
      r.status !== 'ARCHIVED'
    );
    
    const booked = eventReservations.reduce((sum, r) => sum + r.partySize, 0);
    const capacity = event.capacity || 230; // Default fallback
    const remaining = Math.max(0, capacity - booked);
    const occupancyRate = capacity > 0 ? booked / capacity : 0;
    
    // Logic Checks
    const physicalFit = remaining >= query.partySize;
    const isOpenStatus = event.status === 'OPEN' || (query.includeClosed && event.status !== 'ARCHIVED');
    const fits = physicalFit && isOpenStatus;

    const remainingAfter = remaining - query.partySize;

    // Badge Logic
    let badge: RankedSlot['availabilityBadge'] = 'OPEN';
    
    if (event.status === 'CLOSED') badge = 'CLOSED';
    else if (event.status === 'WAITLIST') badge = 'WAITLIST';
    else if (remaining <= 0) badge = 'FULL';
    else if (occupancyRate > URGENCY_THRESHOLD) badge = 'ALMOST_FULL';
    else if (remaining < TIGHT_THRESHOLD) badge = 'LAST_SPOTS';

    return {
      date: event.date,
      showId: event.showId,
      eventId: event.id,
      capacity,
      booked,
      remaining,
      remainingAfterBooking: remainingAfter,
      occupancyRate,
      fits,
      isTight: fits && remainingAfter < 5,
      status: event.status,
      showLabel: showDef?.name || 'Show',
      timeLabel: event.times?.start || '19:30',
      availabilityBadge: badge,
      capacityHint: `${booked}/${capacity}`,
      rankScore: 0 // Will sort below
    };
  });

  // 4. Sort / Rank
  return results.sort((a, b) => {
    if (a.fits !== b.fits) return a.fits ? -1 : 1;
    
    // Efficiency (Tetris) - Only if both fit
    if (a.fits && b.fits) {
      if (a.remainingAfterBooking !== b.remainingAfterBooking) {
        return a.remainingAfterBooking - b.remainingAfterBooking;
      }
    }

    // Earliest Date
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }

    return 0;
  });
};
