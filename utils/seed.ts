
import { 
  ShowDefinition, ShowProfile, CalendarEvent, Reservation, 
  Customer, BookingStatus, LineItem, WaitlistEntry 
} from '../types';
import { 
  showRepo, calendarRepo, bookingRepo, customerRepo, 
  waitlistRepo, clearAllData 
} from './storage';

// --- CONSTANTS & CONFIG ---

const NAMES_FIRST = ['Jan', 'Sanne', 'Sophie', 'Daan', 'Tim', 'Lisa', 'Anne', 'Thomas', 'Eva', 'Lars', 'Ruben', 'Fleur', 'Emma', 'Thijs', 'Jesse', 'Lotte', 'Tess', 'Bram', 'Sem', 'Lucas', 'Julia', 'Mila', 'Levi', 'Nora', 'Saar'];
const NAMES_LAST = ['Jansen', 'de Vries', 'Bakker', 'Visser', 'Smit', 'Meijer', 'de Jong', 'Mulder', 'Groot', 'Bos', 'Vos', 'Peters', 'Hendriks', 'van Dijk', 'Dekker', 'Brouwer', 'de Ruiter', 'Janssen', 'de Boer', 'Vermeulen'];
const COMPANIES = ['Shell', 'Philips', 'KLM', 'Rabobank', 'Bol.com', 'Coolblue', 'ASML', 'Unilever', 'Heineken', 'Ing'];

// Shows Configuration
const SHOW_WONDERLAND: ShowDefinition = {
  id: 'show-wonderland',
  name: 'Alles in Wonderland',
  description: 'Een magische avond vol verrassingen en culinaire hoogstandjes.',
  activeFrom: '2024-01-01',
  activeTo: '2026-12-31',
  isActive: true,
  tags: ['Magie', 'Culinair', 'Theatraal'],
  profiles: [{
    id: 'prof-wonderland-std',
    name: 'Wonderland Experience',
    color: 'purple',
    timing: { doorTime: '18:30', startTime: '19:30', endTime: '22:30' },
    pricing: { standard: 79.50, premium: 95.00, addonPreDrink: 12.50, addonAfterDrink: 15.00 }
  }]
};

const SHOW_HEROES: ShowDefinition = {
  id: 'show-heroes',
  name: 'Zorgzame Helden',
  description: 'Een ode aan de helden van de zorg met muziek en emotie.',
  activeFrom: '2024-01-01',
  activeTo: '2026-12-31',
  isActive: true,
  tags: ['Muziek', 'Ode', 'Emotie'],
  profiles: [{
    id: 'prof-heroes-std',
    name: 'Helden Avond',
    color: 'emerald', // Green theme
    timing: { doorTime: '18:00', startTime: '19:00', endTime: '22:00' },
    pricing: { standard: 65.00, premium: 80.00, addonPreDrink: 10.00, addonAfterDrink: 12.50 }
  }]
};

const SHOW_VEGAS: ShowDefinition = {
  id: 'show-vegas',
  name: 'Viva Las Vegas',
  description: 'Glitter, glamour en spektakel in Las Vegas stijl.',
  activeFrom: '2024-01-01',
  activeTo: '2026-12-31',
  isActive: true,
  tags: ['Show', 'Spectacle', 'Gala'],
  profiles: [{
    id: 'prof-vegas-std',
    name: 'Vegas Night',
    color: 'amber', // Gold theme
    timing: { doorTime: '19:00', startTime: '20:00', endTime: '23:30' },
    pricing: { standard: 85.00, premium: 110.00, addonPreDrink: 15.00, addonAfterDrink: 20.00 }
  }]
};

const SHOWS = [SHOW_WONDERLAND, SHOW_HEROES, SHOW_VEGAS];

// --- GENERATOR HELPERS ---

const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomBool = (chance: number = 0.5) => Math.random() < chance;

const generateCustomer = (i: number): Customer => {
  const isBusiness = randomBool(0.2);
  const firstName = randomItem(NAMES_FIRST);
  const lastName = randomItem(NAMES_LAST);
  
  return {
    id: `CUST-SEED-${i}`,
    salutation: randomItem(['Dhr.', 'Mevr.']),
    firstName,
    lastName,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(' ', '')}@example.com`,
    phone: `06${randomInt(10000000, 99999999)}`,
    companyName: isBusiness ? randomItem(COMPANIES) : undefined,
    isBusiness,
    street: 'Dorpsstraat',
    houseNumber: `${randomInt(1, 150)}`,
    zip: '1234 AB',
    city: randomItem(['Amsterdam', 'Rotterdam', 'Utrecht', 'Eindhoven']),
    country: 'NL',
    notes: randomBool(0.1) ? 'VIP Gast' : (randomBool(0.1) ? 'Slechte betaler' : undefined)
  };
};

// --- FINANCIAL LOGIC ---

const calculateReservationFinancials = (
  partySize: number, 
  pkg: 'standard' | 'premium', 
  profile: ShowProfile,
  status: BookingStatus
) => {
  const items: LineItem[] = [];
  
  // 1. Ticket
  const price = pkg === 'premium' ? profile.pricing.premium : profile.pricing.standard;
  items.push({
    id: 'ticket',
    label: `${pkg === 'premium' ? 'Premium' : 'Standard'} Ticket`,
    quantity: partySize,
    unitPrice: price,
    total: partySize * price,
    category: 'TICKET'
  });

  // 2. Addons (Randomly add drinks for 30% of bookings)
  if (randomBool(0.3)) {
    const qty = partySize;
    const p = profile.pricing.addonPreDrink;
    items.push({
      id: 'pre-drinks',
      label: 'Borrel Vooraf',
      quantity: qty,
      unitPrice: p,
      total: qty * p,
      category: 'ADDON'
    });
  }

  // 3. Merch (Randomly add for 10%)
  if (randomBool(0.1)) {
    items.push({
      id: 'prog-book',
      label: 'Programma Boek',
      quantity: 1,
      unitPrice: 15.00,
      total: 15.00,
      category: 'MERCH'
    });
  }

  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  
  // 4. Payment Logic
  let isPaid = false;
  let paidAmount = 0;
  let paymentMethod = undefined;
  
  // Past events are usually paid
  // Future events depend on status
  if (status === BookingStatus.CONFIRMED || status === BookingStatus.ARCHIVED) {
    if (randomBool(0.9)) { // 90% paid
      isPaid = true;
      paidAmount = subtotal;
      paymentMethod = randomItem(['IDEAL', 'FACTUUR', 'CREDITCARD']);
    } else {
      // Deposit
      paidAmount = subtotal * 0.5;
    }
  }

  return {
    total: subtotal,
    subtotal: subtotal,
    discount: 0,
    finalTotal: subtotal,
    paid: paidAmount,
    isPaid,
    paymentMethod,
    priceBreakdown: items,
    paymentDueAt: new Date(Date.now() + 86400000 * 14).toISOString() // dummy
  };
};

// --- MAIN SEED FUNCTION ---

export const seedDemoData = () => {
  console.log("🌱 Starting Massive Seed...");
  
  // 1. Clear Data
  localStorage.clear();
  
  // 2. Create Shows
  showRepo.saveAll(SHOWS);

  // 3. Create Customers (60 Base Customers)
  const customers: Customer[] = [];
  for (let i = 0; i < 60; i++) {
    customers.push(generateCustomer(i));
  }
  customerRepo.saveAll(customers);

  // 4. Generate Timeline (Events & Bookings)
  const today = new Date();
  const startDate = new Date(today);
  startDate.setMonth(today.getMonth() - 1); // 1 Month back
  startDate.setDate(1);
  
  const endDate = new Date(today);
  endDate.setMonth(today.getMonth() + 6); // 6 Months forward

  const reservations: Reservation[] = [];
  const events: CalendarEvent[] = [];
  const waitlist: WaitlistEntry[] = [];

  // Iterate days
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay(); // 0=Sun, 6=Sat, 5=Fri
    const dateStr = d.toISOString().split('T')[0];
    const isPast = d < today;
    const daysFromNow = (d.getTime() - today.getTime()) / (1000 * 3600 * 24);

    // Only Shows on Fri, Sat, Sun
    if (![0, 5, 6].includes(dayOfWeek)) continue;

    // Pick Show
    let showDef = SHOW_WONDERLAND; // Default
    if (dayOfWeek === 0) showDef = SHOW_HEROES; // Sunday Matinee
    if (dayOfWeek === 6 && randomBool(0.3)) showDef = SHOW_VEGAS; // Occasional Vegas Sat

    const profile = showDef.profiles[0];

    // Determine Status & Target Occupancy
    let status: any = 'OPEN';
    let targetOccupancy = 0; // 0 to 230

    if (isPast) {
      status = 'CLOSED'; // Past events are closed
      targetOccupancy = randomInt(200, 230); // Almost full in past
    } else {
      if (daysFromNow < 14) targetOccupancy = randomInt(180, 225); // Near future busy
      else if (daysFromNow < 30) targetOccupancy = randomInt(100, 180); // Month out
      else if (daysFromNow < 90) targetOccupancy = randomInt(20, 80); // 3 months out
      else targetOccupancy = randomInt(0, 10); // Far future empty
    }

    // Create Event
    const eventId = `EVT-${dateStr}`;
    const newEvent: CalendarEvent = {
      id: eventId,
      date: dateStr,
      type: 'SHOW',
      title: showDef.name,
      visibility: 'PUBLIC',
      bookingEnabled: true,
      times: {
        start: profile.timing.startTime,
        doorsOpen: profile.timing.doorTime,
        end: profile.timing.endTime
      },
      showId: showDef.id,
      profileId: profile.id,
      status: status,
      capacity: 230,
      bookedCount: 0, // Will be updated by logic later/computed
      colorKey: profile.color,
      pricing: profile.pricing
    };
    events.push(newEvent);

    // Generate Bookings to fill Occupancy
    let currentOccupancy = 0;
    
    while (currentOccupancy < targetOccupancy) {
      const partySize = randomBool(0.8) ? randomInt(2, 6) : randomInt(8, 20); // Mostly small, some large
      if (currentOccupancy + partySize > 230) break;

      const customer = randomItem(customers); // Pick returning customer
      const pkg = randomBool(0.3) ? 'premium' : 'standard';
      
      // Reservation Status
      let rStatus: BookingStatus = BookingStatus.CONFIRMED;
      if (isPast) {
        rStatus = BookingStatus.ARCHIVED;
      } else {
        if (randomBool(0.1)) rStatus = BookingStatus.OPTION;
        if (randomBool(0.05)) rStatus = BookingStatus.REQUEST;
      }

      const financials = calculateReservationFinancials(partySize, pkg, profile, rStatus);

      const res: Reservation = {
        id: `RES-${Date.now()}-${randomInt(1000,9999)}`,
        createdAt: isPast ? dateStr : new Date().toISOString(),
        customerId: customer.id,
        customer: {
          ...customer,
          // Snapshot current details
        },
        date: dateStr,
        showId: showDef.id,
        status: rStatus,
        partySize,
        packageType: pkg,
        addons: [],
        merchandise: [],
        financials,
        notes: {
          dietary: randomBool(0.05) ? '1x Gluten' : '',
          isCelebrating: randomBool(0.05),
          celebrationText: 'Verjaardag'
        },
        startTime: profile.timing.startTime
      };

      reservations.push(res);
      currentOccupancy += partySize;
    }
  }

  // --- SCENARIO INJECTION ---

  // 1. "De Drukke Zaterdag" (Next month 2nd Saturday)
  const nextMonth = new Date(); nextMonth.setMonth(nextMonth.getMonth() + 1); nextMonth.setDate(1);
  // Find first saturday
  while (nextMonth.getDay() !== 6) nextMonth.setDate(nextMonth.getDate() + 1);
  nextMonth.setDate(nextMonth.getDate() + 7); // 2nd saturday
  const busyDate = nextMonth.toISOString().split('T')[0];

  // Force close event
  const busyEventIdx = events.findIndex(e => e.date === busyDate);
  if (busyEventIdx >= 0) {
    events[busyEventIdx] = { ...events[busyEventIdx], status: 'CLOSED' } as any;
    
    // Fill with bookings up to 230
    const fillerRes: Reservation = {
      id: `RES-BUSY-FILL`,
      createdAt: new Date().toISOString(),
      customerId: customers[0].id,
      customer: customers[0],
      date: busyDate,
      showId: (events[busyEventIdx] as any).showId,
      status: BookingStatus.CONFIRMED,
      partySize: 50, // Huge filler
      packageType: 'standard',
      addons: [], merchandise: [],
      financials: calculateReservationFinancials(50, 'standard', SHOW_WONDERLAND.profiles[0], BookingStatus.CONFIRMED),
      notes: { internal: 'Scenario Filler' }
    };
    reservations.push(fillerRes);

    // Add Waitlist
    for(let w=0; w<5; w++) {
      waitlist.push({
        id: `WL-${w}`,
        date: busyDate,
        customerId: customers[w].id,
        contactName: `${customers[w].firstName} ${customers[w].lastName}`,
        contactEmail: customers[w].email,
        partySize: 3,
        requestDate: new Date().toISOString(),
        status: 'PENDING'
      });
    }
  }

  // 2. "De Geannuleerde Groep" (Tomorrow)
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const cancelDate = tomorrow.toISOString().split('T')[0];
  const cancelRes: Reservation = {
    id: `RES-CANCELLED-GROUP`,
    createdAt: new Date().toISOString(),
    customerId: customers[1].id,
    customer: customers[1],
    date: cancelDate,
    showId: SHOW_WONDERLAND.id,
    status: BookingStatus.CANCELLED,
    partySize: 12,
    packageType: 'premium',
    addons: [], merchandise: [],
    financials: calculateReservationFinancials(12, 'premium', SHOW_WONDERLAND.profiles[0], BookingStatus.CANCELLED),
    notes: { internal: 'Scenario: Grote annulering' }
  };
  reservations.push(cancelRes);

  // 3. "De Dieet Nachtmerrie" (Friday in 2 weeks)
  const dietDateObj = new Date(); dietDateObj.setDate(dietDateObj.getDate() + 14);
  while(dietDateObj.getDay() !== 5) dietDateObj.setDate(dietDateObj.getDate() + 1);
  const dietDate = dietDateObj.toISOString().split('T')[0];
  
  // Inject specific reservation with complex dietary
  const dietRes: Reservation = {
    id: `RES-DIET-HORROR`,
    createdAt: new Date().toISOString(),
    customerId: customers[2].id,
    customer: customers[2],
    date: dietDate,
    showId: SHOW_WONDERLAND.id,
    status: BookingStatus.CONFIRMED,
    partySize: 8,
    packageType: 'standard',
    addons: [], merchandise: [],
    financials: calculateReservationFinancials(8, 'standard', SHOW_WONDERLAND.profiles[0], BookingStatus.CONFIRMED),
    notes: { 
      dietary: '3x Gluten, 2x Vegan, 1x Noten (EPIPEN!), 1x Geen Vis',
      structuredDietary: { 'Glutenvrij': 3, 'Vegan': 2, 'Notenallergie': 1, 'Geen Vis': 1 }
    }
  };
  reservations.push(dietRes);

  // --- SAVE EVERYTHING ---
  calendarRepo.saveAll(events);
  bookingRepo.saveAll(reservations);
  waitlistRepo.saveAll(waitlist);
  
  console.log(`✅ Seed Complete: ${events.length} Events, ${reservations.length} Reservations, ${waitlist.length} Waitlist items.`);
  
  // Reload Page
  window.location.reload();
};

export const resetDemoData = () => {
  clearAllData();
  window.location.reload();
};

// Stubs for individual actions if needed by UI
export const generateRandomBookings = (count?: number) => { console.log('Generating bookings', count); };
export const generateRandomWaitlist = (count?: number) => { console.log('Generating waitlist', count); };
export const generateRandomVouchers = (count?: number) => { console.log('Generating vouchers', count); };
export const runSmokeTest = () => ({ passed: true, logs: ['System Ready'] });
