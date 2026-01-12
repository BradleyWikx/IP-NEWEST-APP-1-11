import { 
  ShowDefinition, CalendarEvent, Reservation, Customer, 
  BookingStatus, WaitlistEntry, Voucher, VoucherOrder,
  LineItem
} from '../types';
import { 
  saveData, STORAGE_KEYS,
  getCalendarEvents, getCustomers, getShowDefinitions, getReservations
} from './storage';

// --- DATA SETS ---

const FIRST_NAMES = ['Daan', 'Sophie', 'Lucas', 'Julia', 'Sem', 'Mila', 'Noah', 'Emma', 'Levi', 'Tess', 'Bram', 'Zoë', 'Luuk', 'Sara', 'Milan', 'Eva', 'Jesse', 'Nora', 'Thijs', 'Fleur', 'Jan', 'Sanne', 'Willem', 'Lotte', 'Hendrik', 'Anne'];
const LAST_NAMES = ['de Vries', 'Jansen', 'Bakker', 'Visser', 'Smit', 'Meijer', 'de Jong', 'Mulder', 'Groot', 'Bos', 'Vos', 'Peters', 'Hendriks', 'van Dijk', 'Dekker', 'Brouwer', 'de Ruiter', 'Janssen', 'de Boer', 'Vermeulen'];
const COMPANIES = ['Shell', 'Philips', 'Rabobank', 'KPN', 'Bol.com', 'Coolblue', 'ASML', 'Unilever', 'Heineken', 'ING', 'Gemeente Amsterdam', 'Ziggo'];
const DIETARY_NEEDS = ['Glutenvrij', 'Lactosevrij', 'Notenallergie', 'Vegetarisch', 'Veganistisch', 'Geen Vis', 'Halal'];
const CITIES = ['Amsterdam', 'Rotterdam', 'Utrecht', 'Eindhoven', 'Haarlem', 'Den Haag', 'Leiden', 'Zwolle'];

// --- SHOW CONFIGURATION ---

const SHOWS: ShowDefinition[] = [
  {
    id: 'show-comedy',
    name: 'Comedy Night Live',
    description: 'Een avond vol humor en satire met de beste comedians van Nederland.',
    activeFrom: '2024-01-01',
    activeTo: '2026-12-31',
    isActive: true,
    tags: ['Humor', 'Cabaret', 'Diner'],
    profiles: [
      {
        id: 'prof-comedy-std', name: 'Standaard', color: 'purple',
        timing: { doorTime: '19:00', startTime: '20:00', endTime: '22:30' },
        pricing: { standard: 65.00, premium: 85.00, addonPreDrink: 12.50, addonAfterDrink: 15.00 }
      },
      {
        id: 'prof-comedy-late', name: 'Late Night', color: 'indigo',
        timing: { doorTime: '21:00', startTime: '21:30', endTime: '23:30' },
        pricing: { standard: 55.00, premium: 75.00, addonPreDrink: 10.00, addonAfterDrink: 15.00 }
      }
    ]
  },
  {
    id: 'show-jazz',
    name: 'Jazz & Dining',
    description: 'Sfeervol dineren onder begeleiding van live jazz muziek.',
    activeFrom: '2024-01-01',
    activeTo: '2026-12-31',
    isActive: true,
    tags: ['Muziek', 'Romantisch', 'Culinair'],
    profiles: [
      {
        id: 'prof-jazz-std', name: 'Dinner Concert', color: 'amber',
        timing: { doorTime: '18:30', startTime: '19:00', endTime: '22:00' },
        pricing: { standard: 79.50, premium: 99.00, addonPreDrink: 15.00, addonAfterDrink: 17.50 }
      }
    ]
  },
  {
    id: 'show-theater',
    name: 'Theater Special: De Verdieping',
    description: 'Een meeslepend theaterstuk in intieme setting.',
    activeFrom: '2024-01-01',
    activeTo: '2026-12-31',
    isActive: true,
    tags: ['Drama', 'Theater', 'Exclusief'],
    profiles: [
      {
        id: 'prof-theater-matinee', name: 'Matinee', color: 'emerald',
        timing: { doorTime: '13:30', startTime: '14:30', endTime: '17:00' },
        pricing: { standard: 55.00, premium: 70.00, addonPreDrink: 10.00, addonAfterDrink: 12.50 }
      },
      {
        id: 'prof-theater-soir', name: 'Soiree', color: 'rose',
        timing: { doorTime: '19:30', startTime: '20:30', endTime: '23:00' },
        pricing: { standard: 65.00, premium: 85.00, addonPreDrink: 12.50, addonAfterDrink: 15.00 }
      }
    ]
  }
];

// --- HELPERS ---

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomBool = (chance: number = 0.5) => Math.random() < chance;

// --- GENERATORS ---

const generateCustomer = (index: number): Customer => {
  const isBusiness = randomBool(0.2);
  const firstName = randomItem(FIRST_NAMES);
  const lastName = randomItem(LAST_NAMES);
  const company = isBusiness ? randomItem(COMPANIES) : undefined;
  
  return {
    id: `CUST-${index + 1000}-${Date.now()}`,
    salutation: randomItem(['Dhr.', 'Mevr.']),
    firstName,
    lastName,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s/g, '')}@${isBusiness ? company?.toLowerCase().replace(/\s/g, '') + '.nl' : 'gmail.com'}`,
    phone: `06-${randomInt(10000000, 99999999)}`,
    companyName: company,
    isBusiness,
    street: 'Hoofdstraat',
    houseNumber: `${randomInt(1, 200)}`,
    zip: `${randomInt(1000, 9999)} AB`,
    city: randomItem(CITIES),
    country: 'NL',
    notes: randomBool(0.1) ? 'VIP Gast' : undefined
  };
};

const generateReservation = (
  event: CalendarEvent, 
  show: ShowDefinition, 
  customers: Customer[], 
  isPast: boolean
): Reservation | null => {
  if (event.type !== 'SHOW') return null;

  const customer = randomItem(customers);
  const partySize = randomBool(0.8) ? randomInt(2, 6) : randomInt(7, 12);
  const isPremium = randomBool(0.3);
  
  const profile = show.profiles.find(p => p.id === (event as any).profileId) || show.profiles[0];
  const price = isPremium ? profile.pricing.premium : profile.pricing.standard;
  const subtotal = partySize * price;

  // Status Logic
  let status = BookingStatus.CONFIRMED;
  if (isPast) {
    status = randomBool(0.05) ? BookingStatus.NOSHOW : randomBool(0.1) ? BookingStatus.CANCELLED : BookingStatus.ARRIVED;
  } else {
    status = randomBool(0.1) ? BookingStatus.OPTION : randomBool(0.05) ? BookingStatus.REQUEST : BookingStatus.CONFIRMED;
  }

  // Financials
  const isPaid = status === BookingStatus.CONFIRMED || status === BookingStatus.ARRIVED ? randomBool(0.8) : false;
  const items: LineItem[] = [{
    id: 'ticket',
    label: `${isPremium ? 'Premium' : 'Standard'} Ticket`,
    quantity: partySize,
    unitPrice: price,
    total: subtotal,
    category: 'TICKET'
  }];

  // Extras
  const dietary: Record<string, number> = {};
  if (randomBool(0.2)) {
    const diet = randomItem(DIETARY_NEEDS);
    dietary[diet] = randomInt(1, partySize);
  }

  return {
    id: `RES-${Date.now()}-${randomInt(1000, 99999)}`,
    createdAt: new Date().toISOString(),
    customerId: customer.id,
    customer,
    date: event.date,
    showId: show.id,
    status,
    partySize,
    packageType: isPremium ? 'premium' : 'standard',
    addons: [],
    merchandise: [],
    financials: {
      total: subtotal,
      subtotal: subtotal,
      discount: 0,
      finalTotal: subtotal,
      paid: isPaid ? subtotal : 0,
      isPaid,
      paymentMethod: isPaid ? randomItem(['IDEAL', 'CREDITCARD', 'FACTUUR']) : undefined,
      paymentDueAt: isPaid ? undefined : new Date(Date.now() + 86400000 * 7).toISOString(),
      priceBreakdown: items
    },
    notes: {
      structuredDietary: dietary,
      dietary: Object.entries(dietary).map(([k, v]) => `${v}x ${k}`).join(', '),
      isCelebrating: randomBool(0.1),
      celebrationText: 'Verjaardag'
    },
    startTime: event.times?.start
  };
};

// --- MAIN EXPORTS ---

export const seedFullDatabase = () => {
  console.log("🚀 Starting Full Seed...");
  
  // 1. Wipe
  localStorage.clear();

  // 2. Generate Shows
  saveData(STORAGE_KEYS.SHOWS, SHOWS);

  // 3. Generate Customers
  const customers: Customer[] = [];
  for (let i = 0; i < 50; i++) {
    customers.push(generateCustomer(i));
  }
  saveData(STORAGE_KEYS.CUSTOMERS, customers);

  // 4. Generate Timeline & Events
  const events: CalendarEvent[] = [];
  const reservations: Reservation[] = [];
  const waitlist: WaitlistEntry[] = [];

  const today = new Date();
  const startDate = new Date(today);
  startDate.setMonth(today.getMonth() - 3);
  const endDate = new Date(today);
  endDate.setMonth(today.getMonth() + 3);

  // Iterate dates
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const day = d.getDay(); // 0=Sun, 6=Sat
    const dateStr = d.toISOString().split('T')[0];
    const isPast = d < today;

    // Schedule: Fri (Comedy), Sat (Jazz), Sun (Theater)
    if (![0, 5, 6].includes(day)) continue;

    let show = SHOWS[0];
    if (day === 6) show = SHOWS[1];
    if (day === 0) show = SHOWS[2];

    // Pick profile
    const profile = day === 0 ? show.profiles[0] : (randomBool() ? show.profiles[0] : show.profiles[1] || show.profiles[0]);

    // Create Event
    const event: CalendarEvent = {
      id: `EVT-${dateStr}`,
      date: dateStr,
      type: 'SHOW',
      title: show.name,
      visibility: 'PUBLIC',
      bookingEnabled: true,
      times: { start: profile.timing.startTime, doorsOpen: profile.timing.doorTime, end: profile.timing.endTime },
      showId: show.id,
      profileId: profile.id,
      status: 'OPEN',
      capacity: 230,
      bookedCount: 0,
      pricing: profile.pricing
    };
    events.push(event);

    // Generate Reservations for this event
    let dailyOccupancy = 0;
    const targetOccupancy = isPast ? randomInt(150, 230) : (d < new Date(today.getTime() + 14 * 86400000) ? randomInt(100, 220) : randomInt(10, 80));

    while (dailyOccupancy < targetOccupancy) {
      const res = generateReservation(event, show, customers, isPast);
      if (res) {
        if (dailyOccupancy + res.partySize > 230) break; // Cap
        reservations.push(res);
        dailyOccupancy += res.partySize;
      }
    }

    // Determine Event Status based on occupancy
    if (dailyOccupancy >= 220) {
      (event as any).status = 'CLOSED'; // Or WAITLIST
      
      // Generate Waitlist if full and in future
      if (!isPast) {
        for(let w=0; w<randomInt(1, 5); w++) {
          const wlCust = randomItem(customers);
          waitlist.push({
            id: `WL-${Date.now()}-${w}`,
            date: dateStr,
            customerId: wlCust.id,
            contactName: `${wlCust.firstName} ${wlCust.lastName}`,
            contactEmail: wlCust.email,
            contactPhone: wlCust.phone,
            partySize: randomInt(2, 4),
            requestDate: new Date().toISOString(),
            status: 'PENDING'
          });
        }
      }
    } else if (dailyOccupancy >= 200) {
      (event as any).status = 'WAITLIST';
    }
  }

  // 5. Generate Vouchers
  const vouchers: Voucher[] = [];
  const orders: VoucherOrder[] = [];
  
  for(let i=0; i<20; i++) {
    const cust = randomItem(customers);
    const amount = randomItem([50, 75, 100, 150]);
    const code = `VOUCH-${randomInt(1000,9999)}-${randomItem(['A','B','C'])}`;
    const isActive = randomBool(0.7);
    
    vouchers.push({
      code,
      originalBalance: amount,
      currentBalance: isActive ? amount : 0,
      isActive,
      createdAt: new Date().toISOString(),
      issuedTo: `${cust.firstName} ${cust.lastName}`,
      label: 'Cadeaubon'
    });

    orders.push({
      id: `ORD-${randomInt(1000,9999)}`,
      createdAt: new Date().toISOString(),
      status: 'PAID',
      buyer: { firstName: cust.firstName, lastName: cust.lastName },
      items: [{ id: 'custom', label: 'Voucher', price: amount, quantity: 1 }],
      amount,
      totals: { subtotal: amount, shipping: 0, fee: 0, grandTotal: amount },
      deliveryMethod: 'DIGITAL',
      recipient: { name: 'Ontvanger' },
      issuanceMode: 'INDIVIDUAL',
      customerEmail: cust.email
    });
  }

  // 6. Save All
  saveData(STORAGE_KEYS.CALENDAR_EVENTS, events);
  saveData(STORAGE_KEYS.RESERVATIONS, reservations);
  saveData(STORAGE_KEYS.WAITLIST, waitlist);
  saveData(STORAGE_KEYS.VOUCHERS, vouchers);
  saveData(STORAGE_KEYS.VOUCHER_ORDERS, orders);

  console.log("✅ Seed Complete!");
};

export const addRandomReservations = (count: number = 5) => {
  console.log(`➕ Adding ${count} random reservations...`);
  
  const events = getCalendarEvents().filter(e => e.type === 'SHOW' && e.status !== 'CLOSED');
  const shows = getShowDefinitions();
  const customers = getCustomers();
  
  if (events.length === 0 || customers.length === 0) {
    console.warn("⚠️ Cannot add reservations: No events or customers found. Please run full seed first.");
    return 0;
  }

  const newReservations: Reservation[] = [];
  const today = new Date();
  
  for(let i=0; i<count; i++) {
    const event = randomItem(events);
    const show = shows.find(s => s.id === (event as any).showId);
    if (!show) continue;
    
    // Check if event is in past
    const isPast = new Date(event.date) < today;
    
    const res = generateReservation(event, show, customers, isPast);
    if (res) newReservations.push(res);
  }
  
  const currentRes = getReservations();
  saveData(STORAGE_KEYS.RESERVATIONS, [...currentRes, ...newReservations]);
  console.log(`✅ Added ${newReservations.length} reservations.`);
  return newReservations.length;
};