
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
  
  // Logic Flags
  fits: boolean;
  isTight: boolean; // True if fits but leaves very few seats (e.g. < 5)
  status: Availability;
  
  // Display Fields
  showLabel: string;
  timeLabel: string; // Start time
  availabilityBadge: 'OPEN' | 'LAST_SPOTS' | 'FULL' | 'WAITLIST' | 'CLOSED';
  capacityHint: string; // e.g., "180/230 booked"
  
  // Ranking Debug
  rankScore: number; 
}

// --- Constants ---

const TIGHT_THRESHOLD = 10; 

// --- Main Logic ---

export const findAvailableShowDates = (query: AvailabilityQuery): RankedSlot[] => {
  // 1. Load Data (Injection or Store)
  const events = query.data?.events || getCalendarEvents();
  const reservations = query.data?.reservations || getReservations();
  const shows = query.data?.shows || getShowDefinitions();

  const { start, end } = query.dateRange;
  const startDate = new Date(start);
  const endDate = new Date(end);

  // 2. Filter Candidate Events
  const candidates = events.filter(e => {
    // Must be a Show
    if (e.type !== 'SHOW') return false;
    
    // Date Range
    if (e.date < start || e.date > end) return false;
    
    // Weekday Filter
    if (query.weekdays && query.weekdays.length > 0) {
      const day = new Date(e.date).getDay();
      if (!query.weekdays.includes(day)) return false;
    }

    // Profile/Show Filter
    if (query.profileFilter && query.profileFilter !== 'ALL') {
      const showEvent = e as ShowEvent;
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
    // We strictly calculate from reservations to ensure accuracy
    const eventReservations = reservations.filter(r => 
      r.date === event.date && 
      r.status !== 'CANCELLED' && 
      r.status !== 'ARCHIVED'
    );
    
    const booked = eventReservations.reduce((sum, r) => sum + r.partySize, 0);
    const capacity = event.capacity || 230; // Default fallback
    const remaining = Math.max(0, capacity - booked);
    
    // Logic Checks
    // 'fits' is true if there is space OR if the event is technically OPEN but we are an admin (admin might overbook via 'REQUEST')
    // However, strictly for the finder 'fits' logic:
    const physicalFit = remaining >= query.partySize;
    
    // If status is CLOSED, it never fits unless includeClosed is true
    const isOpenStatus = event.status === 'OPEN' || (query.includeClosed && event.status !== 'ARCHIVED');
    const fits = physicalFit && isOpenStatus;

    const remainingAfter = remaining - query.partySize;

    // Badge Logic
    let badge: RankedSlot['availabilityBadge'] = 'OPEN';
    if (event.status === 'CLOSED') badge = 'CLOSED';
    else if (event.status === 'WAITLIST') badge = 'WAITLIST';
    else if (remaining <= 0) badge = 'FULL';
    else if (remaining < TIGHT_THRESHOLD) badge = 'LAST_SPOTS';

    return {
      date: event.date,
      showId: event.showId,
      eventId: event.id,
      capacity,
      booked,
      remaining,
      remainingAfterBooking: remainingAfter,
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
  // Rules:
  // 1) Fits first (boolean)
  // 2) Minimal remaining after booking (Tetris fit - efficiency)
  // 3) Earliest date
  
  return results.sort((a, b) => {
    // 1. Fits First
    if (a.fits !== b.fits) return a.fits ? -1 : 1;

    // 2. Efficiency (Tetris) - Only if both fit
    if (a.fits && b.fits) {
      // Smaller remaining *after* booking is better (means we filled a slot efficiently)
      // Example: A (rem: 5, after: 1) vs B (rem: 100, after: 96) -> A wins
      if (a.remainingAfterBooking !== b.remainingAfterBooking) {
        return a.remainingAfterBooking - b.remainingAfterBooking;
      }
    }

    // 3. Earliest Date
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }

    return 0;
  });
};

// --- Test Scenarios ---

export const runAvailabilityTests = () => {
  console.group('Availability Finder Tests');

  const mockShows = [{ id: 'S1', name: 'Show 1' } as any];
  const mockEventBase = { type: 'SHOW', showId: 'S1', visibility: 'PUBLIC', times: { start: '20:00' }, capacity: 100 } as any;

  const scenarios = [
    {
      name: 'Scenario 1: Basic Fit',
      query: { partySize: 2, dateRange: { start: '2025-01-01', end: '2025-01-02' } },
      data: {
        events: [
          { ...mockEventBase, id: 'E1', date: '2025-01-01', status: 'OPEN' }, // 0 Booked
          { ...mockEventBase, id: 'E2', date: '2025-01-02', status: 'OPEN' }  // 0 Booked
        ],
        reservations: [
          { date: '2025-01-02', status: 'CONFIRMED', partySize: 100 } as any // E2 Full
        ],
        shows: mockShows
      },
      expectTop: '2025-01-01'
    },
    {
      name: 'Scenario 2: Best Capacity Fit (Efficiency)',
      query: { partySize: 10, dateRange: { start: '2025-01-01', end: '2025-01-02' } },
      data: {
        events: [
          { ...mockEventBase, id: 'E1', date: '2025-01-01', status: 'OPEN' }, // Will have 90 booked (10 rem)
          { ...mockEventBase, id: 'E2', date: '2025-01-02', status: 'OPEN' }  // Will have 0 booked (100 rem)
        ],
        reservations: [
          { date: '2025-01-01', status: 'CONFIRMED', partySize: 90 } as any
        ],
        shows: mockShows
      },
      expectTop: '2025-01-01' // Should win because it perfectly fills the room (Tetris logic)
    },
    {
      name: 'Scenario 3: Date Sort (Tie-breaker)',
      query: { partySize: 2, dateRange: { start: '2025-01-01', end: '2025-01-05' } },
      data: {
        events: [
          { ...mockEventBase, id: 'E2', date: '2025-01-03', status: 'OPEN' },
          { ...mockEventBase, id: 'E1', date: '2025-01-01', status: 'OPEN' }
        ],
        reservations: [],
        shows: mockShows
      },
      expectTop: '2025-01-01'
    },
    {
      name: 'Scenario 4: Oversize (Does not fit)',
      query: { partySize: 11, dateRange: { start: '2025-01-01', end: '2025-01-01' } },
      data: {
        events: [
          { ...mockEventBase, id: 'E1', date: '2025-01-01', status: 'OPEN' } // 90 booked, 10 rem
        ],
        reservations: [
          { date: '2025-01-01', status: 'CONFIRMED', partySize: 90 } as any
        ],
        shows: mockShows
      },
      expectFirstFit: false
    },
    {
      name: 'Scenario 5: Profile Filter',
      query: { partySize: 2, dateRange: { start: '2025-01-01', end: '2025-01-01' }, profileFilter: 'S2' },
      data: {
        events: [
          { ...mockEventBase, id: 'E1', date: '2025-01-01', showId: 'S1', status: 'OPEN' }
        ],
        reservations: [],
        shows: mockShows
      },
      expectResultsCount: 0
    },
    {
      name: 'Scenario 6: Weekday Filter (Sunday only)',
      query: { partySize: 2, dateRange: { start: '2025-01-01', end: '2025-01-07' }, weekdays: [0] }, // 2025-01-05 is Sunday
      data: {
        events: [
          { ...mockEventBase, id: 'E1', date: '2025-01-01', status: 'OPEN' }, // Wednesday
          { ...mockEventBase, id: 'E2', date: '2025-01-05', status: 'OPEN' }  // Sunday
        ],
        reservations: [],
        shows: mockShows
      },
      expectTop: '2025-01-05'
    }
  ];

  scenarios.forEach(sc => {
    const results = findAvailableShowDates(sc.query as any);
    const top = results[0];
    
    let passed = true;
    if (sc.expectTop && top?.date !== sc.expectTop) passed = false;
    if (sc.expectFirstFit !== undefined && top?.fits !== sc.expectFirstFit) passed = false;
    if (sc.expectResultsCount !== undefined && results.length !== sc.expectResultsCount) passed = false;

    console.log(`${passed ? '✅' : '❌'} ${sc.name}`);
    if (!passed) {
        console.table(results.map(r => ({ date: r.date, fits: r.fits, remAfter: r.remainingAfterBooking })));
    }
  });

  console.groupEnd();
};
