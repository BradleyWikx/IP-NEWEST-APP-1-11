
import { 
  Reservation, Customer, WaitlistEntry, BookingStatus, ShowDefinition, 
  VoucherSaleConfig, CalendarEvent, ShowEvent, PrivateEvent,
  PromoCodeRule, DiscountKind, PromoScope, EventDate
} from '../types';
import { STORAGE_KEYS, saveData, setSeeded, clearAllData, calendarRepo, bookingRepo, customerRepo, waitlistRepo, voucherRepo } from './storage';
import { getEffectivePricing, calculateBookingTotals } from './pricing';
import { MOCK_MERCHANDISE, MOCK_ADDONS } from '../mock/data';
import { toLocalISOString } from './dateHelpers';

const CAPACITY = 230;

// --- 1. CONFIGURATION & DEFINITIONS ---

const SHOW_DEFINITIONS: ShowDefinition[] = [
  {
    id: 'SHOW-WONDERLAND',
    name: 'Alles in Wonderland',
    description: 'Een verknipt sprookje dat kant nog wal raakt. Ons pittig sprookje is ondeugend, pikant en gewaagd.',
    activeFrom: '2024-01-01',
    activeTo: '2026-12-31',
    isActive: true,
    tags: ['Cabaret', 'Show', 'Diner'],
    posterImage: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80',
    profiles: [
      {
        id: 'prof-wonderland-weekend',
        name: 'Vrijdag & Zaterdag',
        color: 'fuchsia', // Paars thema
        timing: { doorTime: '19:00', startTime: '19:30', endTime: '23:00' },
        pricing: { standard: 82.50, premium: 97.50, addonPreDrink: 15.00, addonAfterDrink: 15.00 }
      },
      {
        id: 'prof-wonderland-matinee',
        name: 'Zondag Matinee',
        color: 'purple',
        timing: { doorTime: '13:30', startTime: '14:00', endTime: '17:30' },
        pricing: { standard: 75.00, premium: 90.00, addonPreDrink: 15.00, addonAfterDrink: 15.00 }
      }
    ]
  },
  {
    id: 'SHOW-HEROES',
    name: 'Zorgzame Helden Avond',
    description: 'Speciaal voor helden uit de zorg, politie en onderwijs. Een feestelijke avond vol ontroering.',
    activeFrom: '2024-01-01',
    activeTo: '2026-12-31',
    isActive: true,
    tags: ['Special', 'Benefiet'],
    posterImage: 'https://images.unsplash.com/photo-1551590192-807e80d7b101?auto=format&fit=crop&w=800&q=80',
    profiles: [
      {
        id: 'prof-heroes-default',
        name: 'Helden Special',
        color: 'teal', // Groen thema
        timing: { doorTime: '18:00', startTime: '18:30', endTime: '22:00' },
        pricing: { standard: 65.00, premium: 80.00, addonPreDrink: 15.00, addonAfterDrink: 15.00 }
      }
    ]
  }
];

const VOUCHER_CONFIG: VoucherSaleConfig = {
  isEnabled: true,
  products: [
    { id: 'VP-25', label: 'Cadeaukaart €25', description: 'Leuk om te geven.', price: 25, active: true },
    { id: 'VP-50', label: 'Cadeaukaart €50', description: 'Een avondje uit.', price: 50, active: true },
    { id: 'VP-FULL', label: 'Volledig Arrangement', description: 'Ticket + Diner', price: 82.50, active: true }
  ],
  freeAmount: { enabled: true, min: 10, max: 500, step: 5 },
  bundling: { allowCombinedIssuance: true },
  delivery: { pickup: { enabled: true }, shipping: { enabled: true, fee: 4.95 }, digitalFee: 1.50 }
};

const PROMO_RULES: PromoCodeRule[] = [
  { id: 'PROMO-NY', code: 'NEWYEAR2026', label: 'Nieuwjaarsactie', enabled: true, kind: DiscountKind.PERCENTAGE, scope: PromoScope.ARRANGEMENT_ONLY, percentage: 10, allowWithVoucher: true, allowStacking: false },
  { id: 'PROMO-CORP', code: 'BEDRIJF26', label: 'Zakelijke Relatie', enabled: true, kind: DiscountKind.FIXED_PER_PERSON, scope: PromoScope.ARRANGEMENT_ONLY, fixedAmountPerPerson: 15, allowWithVoucher: false, allowStacking: false }
];

// --- 2. GENERATORS ---

const FIRST_NAMES = ['Jan', 'Sanne', 'Peter', 'Emma', 'Mark', 'Sophie', 'Daan', 'Lotte', 'Tim', 'Julia', 'Bram', 'Tess', 'Kees', 'Eva', 'Tom', 'Lisa', 'Willem', 'Fleur'];
const LAST_NAMES = ['Jansen', 'de Vries', 'Bakker', 'Visser', 'Smit', 'Meijer', 'Mulder', 'de Jong', 'Bos', 'Vos', 'Peters', 'Hendriks', 'Van Dijk', 'Klaassen', 'Hermans'];
const COMPANIES = ['Philips', 'ASML', 'VDL', 'Jumbo', 'Bavaria', 'DAF', 'Gemeente Eindhoven'];
const CITIES = ['Eindhoven', 'Veldhoven', 'Best', 'Helmond', 'Geldrop', 'Son', 'Nuenen', 'Valkenswaard'];
const DIETARY_OPTIONS = ['Glutenvrij', 'Notenallergie', 'Lactosevrij', 'Veganistisch', 'Vegetarisch', 'Schaaldierenallergie', 'Zwanger (geen rauw vlees/kaas)'];
const CELEBRATIONS = ['Verjaardag', '50e Verjaardag', '25 Jaar Getrouwd', 'Bedrijfsuitje', 'Pensioen', 'Vrijgezellenfeest'];

const getRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Generate a diverse customer pool
const generateCustomerPool = (count: number): Customer[] => {
  const pool: Customer[] = [];
  for (let i = 0; i < count; i++) {
    const isBusiness = Math.random() > 0.8; // 20% Business
    const company = isBusiness ? getRandom(COMPANIES) : undefined;
    const fn = getRandom(FIRST_NAMES);
    const ln = getRandom(LAST_NAMES);
    
    // Simulate recurring/no-show via notes/counters
    const isRegular = Math.random() > 0.8;
    const isNoShow = Math.random() > 0.95;

    pool.push({
      id: `CUST-2026-${i}`,
      salutation: Math.random() > 0.5 ? 'Dhr.' : 'Mevr.',
      firstName: fn,
      lastName: ln,
      email: isBusiness ? `info@${company?.toLowerCase().replace(/\s/g, '')}.nl` : `${fn.toLowerCase()}.${ln.toLowerCase().replace(/\s/g, '')}@gmail.com`,
      phone: '06' + Math.floor(Math.random() * 90000000 + 10000000),
      companyName: company,
      isBusiness,
      city: getRandom(CITIES),
      street: 'Dorpsstraat',
      houseNumber: String(Math.floor(Math.random() * 100)),
      zip: '1234 AB',
      country: 'NL',
      notes: isNoShow ? 'LET OP: Historie van No-Show' : isRegular ? 'Stamgast - Tafelvoorkeur: Voorin' : '',
      noShowCount: isNoShow ? Math.floor(Math.random() * 3) + 1 : 0
    });
  }
  return pool;
};

// --- 3. MAIN SEED FUNCTION ---

export const seedDemoData = () => {
  console.log("🚀 Starting Stress Test Generation: January 2026");
  
  clearAllData();

  const events: CalendarEvent[] = [];
  const bookings: Reservation[] = [];
  const waitlist: WaitlistEntry[] = [];
  
  // A. Generate Customers
  const customers = generateCustomerPool(60);
  
  // B. Generate Calendar (Jan 2026)
  // Logic: Fri/Sat = Wonderland, Sun = Heroes/Wonderland Matinee
  const startDate = new Date('2026-01-01');
  const endDate = new Date('2026-01-31');

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const day = d.getDay(); // 0=Sun, 5=Fri, 6=Sat
    if (day !== 5 && day !== 6 && day !== 0) continue; // Skip Mon-Thu

    const dateStr = toLocalISOString(d);
    
    // Determine Show & Profile
    let showId = 'SHOW-WONDERLAND';
    let profileId = 'prof-wonderland-weekend';

    if (day === 0) { // Sunday
        // Alternate Heroes / Wonderland Matinee
        if (d.getDate() % 2 === 0) {
            showId = 'SHOW-HEROES';
            profileId = 'prof-heroes-default';
        } else {
            profileId = 'prof-wonderland-matinee';
        }
    }

    const showDef = SHOW_DEFINITIONS.find(s => s.id === showId)!;
    const profile = showDef.profiles.find(p => p.id === profileId)!;

    events.push({
      id: `EVT-${dateStr}`,
      type: 'SHOW',
      date: dateStr,
      title: showDef.name,
      visibility: 'PUBLIC',
      bookingEnabled: true,
      times: {
        doorsOpen: profile.timing.doorTime,
        start: profile.timing.startTime,
        end: profile.timing.endTime
      },
      showId,
      profileId: profile.id,
      status: 'OPEN', // Dynamic status
      capacity: CAPACITY,
      bookedCount: 0,
      pricing: profile.pricing,
      colorKey: profile.color
    } as ShowEvent);
  }

  // C. Generate Reservations (Complex Logic)
  
  events.forEach((event: any) => {
    const evtDate = new Date(event.date);
    const day = evtDate.getDate();
    
    // Occupancy Logic per Weekend
    let targetPercent = 0;
    
    // Weekend 1 (2-4 Jan): Quiet
    if (day <= 4) targetPercent = 0.20;
    
    // Weekend 2 (9-11 Jan): Normal
    else if (day >= 9 && day <= 11) targetPercent = 0.60;
    
    // Weekend 3 (16-18 Jan): SOLD OUT
    else if (day >= 16 && day <= 18) targetPercent = 1.05; // 105% to force waitlist
    
    // Weekend 4 (23-25 Jan): Mixed
    else if (day === 23) targetPercent = 0.90; // Fri busy
    else if (day === 25) targetPercent = 0.10; // Sun empty
    else targetPercent = 0.50; // Sat normal

    const targetSeats = Math.floor(CAPACITY * targetPercent);
    let currentSeats = 0;
    let failSafe = 0;

    // Fill event
    while (currentSeats < targetSeats && failSafe < 100) {
      const customer = getRandom(customers);
      
      // Random party size 2-8
      const partySize = Math.floor(Math.random() * 7) + 2; 
      
      // Stop if we overfill too much (unless it's the sold out weekend, then we want to hit limit)
      if (currentSeats + partySize > CAPACITY && targetPercent < 1.0) break;

      // Create Reservation Data
      const show = SHOW_DEFINITIONS.find(s => s.id === event.showId)!;
      const legacyEvent: EventDate = {
          date: event.date, showId: event.showId, profileId: event.profileId, availability: 'OPEN',
          doorTime: event.times.doorsOpen, startTime: event.times.start, endTime: event.times.end,
          capacity: event.capacity, bookedCount: 0, pricing: event.pricing
      };
      
      const pricing = getEffectivePricing(legacyEvent, show);
      const isPremium = Math.random() > 0.6; // 40% Premium
      
      // Extras & Notes
      const hasDietary = Math.random() > 0.8;
      const hasCelebration = Math.random() > 0.9;
      const hasMerch = Math.random() > 0.9;
      const hasAddons = partySize > 6 && Math.random() > 0.5; // Only larger groups take addon

      // Calculate Financials using Engine
      const totals = calculateBookingTotals({
        totalGuests: partySize,
        packageType: isPremium ? 'premium' : 'standard',
        addons: hasAddons ? [{ id: 'pre-drinks', quantity: partySize }] : [],
        merchandise: hasMerch ? [{ id: 'prog-book', quantity: 1 }] : [],
        date: event.date,
        showId: show.id
      }, pricing);

      // Status Logic
      let status = BookingStatus.CONFIRMED;
      if (Math.random() > 0.9) status = BookingStatus.OPTION;
      if (Math.random() > 0.95) status = BookingStatus.CANCELLED;
      
      // Waitlist Logic (If over capacity)
      if (currentSeats + partySize > CAPACITY) {
         // Create Waitlist Entry instead of reservation
         const wEntry: WaitlistEntry = {
            id: `WL-${Date.now()}-${failSafe}`,
            date: event.date,
            customerId: customer.id,
            contactName: `${customer.firstName} ${customer.lastName}`,
            contactEmail: customer.email,
            contactPhone: customer.phone,
            partySize: partySize,
            requestDate: new Date().toISOString(),
            status: 'PENDING',
            notes: 'Hoopt op last-minute plek.'
         };
         waitlist.push(wEntry);
         failSafe++;
         continue; // Skip adding reservation, loop until "target" conceptually met
      }

      // Payment Logic
      let isPaid = status === BookingStatus.CONFIRMED;
      let paymentMethod = 'IDEAL';
      
      // Some confirmed but unpaid (Factuur)
      if (isPaid && Math.random() > 0.8) {
          isPaid = false;
          paymentMethod = 'FACTUUR';
      }
      
      // Payment Deadline
      const due = new Date(event.date);
      due.setDate(due.getDate() - 14); // Due 2 weeks before

      bookings.push({
        id: `RES-${event.date.replace(/-/g, '')}-${failSafe}`,
        createdAt: new Date().toISOString(),
        customerId: customer.id,
        customer,
        date: event.date,
        showId: show.id,
        status,
        partySize,
        packageType: isPremium ? 'premium' : 'standard',
        addons: totals.items.filter(i => i.category === 'ADDON').map(i => ({ id: i.id, quantity: i.quantity })),
        merchandise: totals.items.filter(i => i.category === 'MERCH').map(i => ({ id: i.id, quantity: i.quantity })),
        financials: {
          total: totals.subtotal,
          subtotal: totals.subtotal,
          discount: 0,
          finalTotal: totals.amountDue,
          paid: isPaid ? totals.amountDue : 0,
          isPaid,
          paymentMethod: isPaid ? paymentMethod : undefined,
          paidAt: isPaid ? new Date().toISOString() : undefined,
          paymentDueAt: due.toISOString()
        },
        notes: {
          dietary: hasDietary ? `${getRandom(DIETARY_OPTIONS)} (1p)` : '',
          isCelebrating: hasCelebration,
          celebrationText: hasCelebration ? getRandom(CELEBRATIONS) : '',
          structuredDietary: hasDietary ? { [getRandom(DIETARY_OPTIONS)]: 1 } : undefined
        },
        startTime: event.times.start
      });

      currentSeats += partySize;
      failSafe++;
    }
  });

  // D. Save All
  saveData(STORAGE_KEYS.SHOWS, SHOW_DEFINITIONS);
  saveData(STORAGE_KEYS.CALENDAR_EVENTS, events);
  saveData(STORAGE_KEYS.RESERVATIONS, bookings);
  saveData(STORAGE_KEYS.CUSTOMERS, customers);
  saveData(STORAGE_KEYS.WAITLIST, waitlist);
  
  // Aux Data
  saveData(STORAGE_KEYS.MERCHANDISE, MOCK_MERCHANDISE);
  saveData(STORAGE_KEYS.VOUCHER_CONFIG, VOUCHER_CONFIG);
  saveData(STORAGE_KEYS.PROMOS, PROMO_RULES);
  
  // Set flag
  setSeeded(true);
  console.log(`✅ Demo data voor Jan 2026 geladen: ${bookings.length} reserveringen, ${customers.length} klanten, ${waitlist.length} wachtlijst.`);
};

// --- Helpers/Stubs for compatibility ---
export const resetDemoData = () => { clearAllData(); seedDemoData(); };
export const generateRandomBookings = (count: number = 10) => { console.log(`Creating ${count} random bookings (Stub)`); }; 
export const generateRandomWaitlist = (count: number = 10) => { console.log(`Creating ${count} random waitlist entries (Stub)`); };
export const generateRandomVouchers = (count: number = 10) => { console.log(`Creating ${count} random vouchers (Stub)`); };
export const runSmokeTest = () => ({ passed: true, logs: ['Skipped'] });
