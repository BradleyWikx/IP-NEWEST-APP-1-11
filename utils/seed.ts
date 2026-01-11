
import { 
  ShowType, EventDate, MerchandiseItem, Voucher, VoucherOrder,
  Reservation, Customer, WaitlistEntry, BookingStatus, ShowDefinition, 
  ShowProfile, VoucherSaleConfig, CalendarEvent, ShowEvent, PrivateEvent, RehearsalEvent,
  EmailTemplate, PromoCodeRule, DiscountKind, PromoScope
} from '../types';
import { STORAGE_KEYS, saveData, setSeeded, clearAllData, calendarRepo, showRepo, bookingRepo, customerRepo, voucherRepo, waitlistRepo, emailTemplateRepo, promoRepo } from './storage';
import { getEffectivePricing, calculateBookingTotals } from './pricing';

const CAPACITY = 230;

const SHOW_TYPES: ShowType[] = [
  { id: 'matinee', name: 'Sunday Matinee', color: 'emerald', basePrice: 45, premiumPrice: 65, startTime: '13:00', description: 'Gezellige middagvoorstelling voor de hele familie.' },
  { id: 'weekday', name: 'Evening Performance', color: 'indigo', basePrice: 55, premiumPrice: 85, startTime: '19:30', description: 'Onze klassieke avondshow vol spektakel.' },
  { id: 'weekend', name: 'Weekend Gala', color: 'amber', basePrice: 75, premiumPrice: 110, startTime: '19:00', description: 'De ultieme gala ervaring met live orkest en 5-gangen diner.' },
  { id: 'special', name: 'Charity Gala Night', color: 'rose', basePrice: 90, premiumPrice: 150, startTime: '18:30', description: 'Exclusieve avond voor het goede doel met speciale gasten.' },
];

const SHOW_DEFINITIONS: ShowDefinition[] = SHOW_TYPES.map(st => ({
  id: st.id,
  name: st.name,
  description: st.description || '',
  posterImage: st.id === 'matinee' ? 'https://images.unsplash.com/photo-1514525253440-b393452e8d26?auto=format&fit=crop&w=800&q=80' :
               st.id === 'weekend' ? 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80' :
               st.id === 'special' ? 'https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?auto=format&fit=crop&w=800&q=80' :
               'https://images.unsplash.com/photo-1503095392237-fc785870e913?auto=format&fit=crop&w=800&q=80',
  activeFrom: '2025-01-01',
  activeTo: '2025-12-31',
  isActive: true,
  tags: ['Theater', 'Diner', 'Live Muziek'],
  profiles: [{
    id: `${st.id}-default`,
    name: 'Standaard Profiel',
    color: st.color,
    timing: { doorTime: '18:00', startTime: st.startTime, endTime: '22:30' },
    pricing: { standard: st.basePrice, premium: st.premiumPrice, addonPreDrink: 12.50, addonAfterDrink: 15.00 }
  }]
}));

const MERCH_CATALOG: MerchandiseItem[] = [
  { id: 'prog-book', name: 'Luxury Program Book', price: 15.00, category: 'Souvenir', stock: 100, active: true, description: '50 pagina\'s achter de schermen bij de show.', image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=80' },
  { id: 'glass-set', name: 'Crystal Glass Set', price: 34.50, category: 'Home', stock: 50, active: true, description: 'Set of 2 gegraveerde kristallen glazen met ons logo.', image: 'https://images.unsplash.com/photo-1596562092607-4402633005df?auto=format&fit=crop&w=600&q=80' },
  { id: 'theatre-mask', name: 'Venetian Mask', price: 45.00, category: 'Apparel', stock: 25, active: true, description: 'Handgemaakt masker voor de ultieme gala ervaring.', image: 'https://images.unsplash.com/photo-1595507425626-d39a3852028d?auto=format&fit=crop&w=600&q=80' },
  { id: 'signed-poster', name: 'Signed Cast Poster', price: 20.00, category: 'Art', stock: 10, active: true, description: 'Gelimiteerde poster gesigneerd door de hoofdrolspelers.', image: 'https://images.unsplash.com/photo-1572947650440-e8a97ef053b5?auto=format&fit=crop&w=600&q=80' },
  { id: 'tote-bag', name: 'Theater Tote', price: 12.50, category: 'Apparel', stock: 150, active: true, description: 'Kwaliteits tas van biologisch katoen.', image: 'https://images.unsplash.com/photo-1597484662317-9bd7bdda2907?auto=format&fit=crop&w=600&q=80' },
  { id: 'soundtrack', name: 'Vinyl Soundtrack', price: 29.99, category: 'Art', stock: 40, active: true, description: 'De live muziek van de show op 180g vinyl.', image: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=600&q=80' }
];

const VOUCHER_SALE_CONFIG: VoucherSaleConfig = {
  isEnabled: true,
  products: [
    { id: 'VPROD-STD', label: 'Standard Arrangement', description: 'Toegang voor 1 persoon incl. 4-gangen diner.', price: 55.00, active: true },
    { id: 'VPROD-PREM', label: 'Premium Arrangement', description: 'VIP toegang, beste plaatsen en wijnarrangement.', price: 85.00, active: true }
  ],
  freeAmount: { enabled: true, min: 10, max: 500, step: 5 },
  bundling: { allowCombinedIssuance: true },
  delivery: {
    pickup: { enabled: true },
    shipping: { enabled: true, fee: 4.95 },
    digitalFee: 2.50
  }
};

const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'TMPL-REQ',
    key: 'BOOKING_REQUEST_RECEIVED',
    name: 'Aanvraag Ontvangen',
    category: 'BOOKING',
    enabled: true,
    updatedAt: new Date().toISOString(),
    subject: 'Bevestiging Aanvraag - Inspiration Point',
    bodyHtml: '<p>Beste {{firstName}},</p><p>Bedankt voor uw aanvraag voor <strong>{{showName}}</strong> op {{showDateLong}}.</p><p>We hebben uw verzoek voor {{partySize}} personen ontvangen. We controleren de beschikbaarheid en sturen u binnen 24 uur een definitieve bevestiging en betaalverzoek.</p><p>Met vriendelijke groet,<br>Inspiration Point Team</p>',
    bodyText: 'Bedankt voor uw aanvraag. We nemen snel contact op.'
  },
  {
    id: 'TMPL-CONF',
    key: 'BOOKING_CONFIRMED',
    name: 'Reservering Bevestigd',
    category: 'BOOKING',
    enabled: true,
    updatedAt: new Date().toISOString(),
    subject: 'Uw Reservering is Bevestigd! - {{showDate}}',
    bodyHtml: '<p>Beste {{fullName}},</p><p>Goed nieuws! Uw reservering is bevestigd.</p><p><strong>Details:</strong><br>Datum: {{showDateLong}}<br>Tijd: {{showTime}} (Deuren open: {{doorTime}})<br>Aantal: {{partySize}} personen<br>Totaal: €{{totalAmount}}</p><p>We kijken ernaar uit u te verwelkomen!</p>',
    bodyText: 'Uw reservering is bevestigd. Tot snel!'
  },
  {
    id: 'TMPL-PAY',
    key: 'BOOKING_PAYMENT_REMINDER',
    name: 'Betaalherinnering',
    category: 'BOOKING',
    enabled: true,
    updatedAt: new Date().toISOString(),
    subject: 'Herinnering: Betaling Reservering {{reservationNumber}}',
    bodyHtml: '<p>Beste {{firstName}},</p><p>We herinneren u eraan dat de betaling voor uw reservering nog openstaat.</p><p>Te betalen: <strong>€{{amountDue}}</strong></p><p>Klik hier om te betalen.</p>',
    bodyText: 'Betaalherinnering voor uw reservering.'
  },
  {
    id: 'TMPL-VOUCH',
    key: 'VOUCHER_DELIVERY_DIGITAL',
    name: 'Uw Digitale Voucher',
    category: 'VOUCHER',
    enabled: true,
    updatedAt: new Date().toISOString(),
    subject: 'Uw Inspiration Point Voucher',
    bodyHtml: '<p>Gefeliciteerd!</p><p>Hierbij ontvangt u uw digitale voucher.</p><p><strong>Code: {{voucherCode}}</strong><br>Waarde: €{{voucherValue}}</p><p>Veel plezier ermee!</p>',
    bodyText: 'Uw voucher code is: {{voucherCode}}'
  }
];

const SEED_PROMO_RULES: PromoCodeRule[] = [
  {
    id: 'PROMO-1',
    code: 'FAMILY10',
    label: 'Family Deal (€10 p.p. korting)',
    enabled: true,
    kind: DiscountKind.FIXED_PER_PERSON,
    scope: PromoScope.ARRANGEMENT_ONLY,
    fixedAmountPerPerson: 10,
    allowWithVoucher: true,
    allowStacking: false,
    constraints: { minPartySize: 4 }
  },
  {
    id: 'PROMO-2',
    code: 'WELCOME10',
    label: 'Welkomstkorting (10%)',
    enabled: true,
    kind: DiscountKind.PERCENTAGE,
    scope: PromoScope.ARRANGEMENT_ONLY,
    percentage: 10,
    allowWithVoucher: true,
    allowStacking: false
  },
  {
    id: 'PROMO-3',
    code: 'HOST_VIP',
    label: 'VIP Gasten (Gratis Entree)',
    enabled: true,
    kind: DiscountKind.INVITED_COMP,
    scope: PromoScope.ARRANGEMENT_ONLY,
    invitedConfig: {
      freeArrangementsMode: 'ALL',
      eligibleArrangement: 'ANY'
    },
    allowWithVoucher: false,
    allowStacking: false
  },
  {
    id: 'PROMO-4',
    code: 'ARTIST_GUEST',
    label: 'Artiesten Gastenlijst (2 Vrijkaarten)',
    enabled: true,
    kind: DiscountKind.INVITED_COMP,
    scope: PromoScope.ARRANGEMENT_ONLY,
    invitedConfig: {
      freeArrangementsMode: 'COUNT',
      freeCount: 2,
      eligibleArrangement: 'ANY'
    },
    allowWithVoucher: true,
    allowStacking: false
  }
];

const generateCalendar = (): CalendarEvent[] => {
  const events: CalendarEvent[] = [];
  const today = new Date();
  
  // 1. Generate Public Shows (ShowEvents)
  for (let i = 0; i < 40; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const day = d.getDay();
    
    // Skip some days for other events
    if (i === 5 || i === 12 || i === 20 || i === 25 || i === 26) continue;

    let showId = 'weekday';
    if (day === 0) showId = 'matinee';
    if (day === 5 || day === 6) showId = 'weekend';
    if (i === 15) showId = 'special';

    const st = SHOW_TYPES.find(s => s.id === showId)!;
    
    events.push({
      id: `SHOW-${dateStr}`,
      type: 'SHOW',
      date: dateStr,
      title: st.name,
      visibility: 'PUBLIC',
      bookingEnabled: true,
      colorKey: st.color,
      times: {
        doorsOpen: '18:00',
        start: st.startTime,
        end: '22:30'
      },
      showId,
      profileId: `${showId}-default`,
      status: Math.random() > 0.9 ? 'CLOSED' : Math.random() > 0.8 ? 'WAITLIST' : 'OPEN',
      capacity: CAPACITY,
      bookedCount: Math.floor(Math.random() * 50),
      pricing: { standard: st.basePrice, premium: st.premiumPrice, addonPreDrink: 12.50, addonAfterDrink: 15.00 }
    });
  }

  // 2. Generate Private Events
  const privateDates = [5, 20];
  privateDates.forEach((offset, idx) => {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    const dateStr = d.toISOString().split('T')[0];
    
    const pEvent: PrivateEvent = {
      id: `PRIV-${dateStr}`,
      type: 'PRIVATE_EVENT',
      date: dateStr,
      title: idx === 0 ? 'Bedrijfsfeest Shell' : 'Jubileum Janssen',
      visibility: 'INTERNAL', // or PUBLIC if blocked on calendar
      bookingEnabled: false,
      colorKey: 'purple',
      times: { doorsOpen: '17:00', start: '18:00', end: '23:00' },
      companyName: idx === 0 ? 'Shell' : undefined,
      contactName: idx === 0 ? 'Pieter Post' : 'Jan Janssen',
      contactEmail: 'contact@example.com',
      contactPhone: '0612345678',
      pricingModel: 'FIXED_TOTAL',
      financials: {
        expectedGuests: 150,
        priceTotal: 15000,
        invoiceStatus: idx === 0 ? 'PAID' : 'SENT'
      },
      preferences: {
        occasionType: idx === 0 ? 'COMPANY' : 'OTHER',
        dietary: '5x Gluten, 2x Vegan',
        barType: 'STANDARD',
        scheduleNotes: 'Speech om 18:30',
        techConfig: {
          mic: true,
          music: true,
          lights: false,
          projector: idx === 0
        }
      }
    };
    events.push(pEvent);
  });

  // 3. Generate Rehearsals
  const rehearsalDates = [12, 25, 26];
  rehearsalDates.forEach(offset => {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    const dateStr = d.toISOString().split('T')[0];

    const rEvent: RehearsalEvent = {
      id: `REH-${dateStr}`,
      type: 'REHEARSAL',
      date: dateStr,
      title: 'Technische Doorloop',
      visibility: 'INTERNAL',
      bookingEnabled: false,
      colorKey: 'blue',
      times: { start: '10:00', end: '16:00' },
      team: ['TECH', 'CAST'],
      location: 'Main Hall'
    };
    events.push(rEvent);
  });

  return events;
};

const MOCK_RESERVATIONS: Reservation[] = [
  {
    id: 'RES-12345678',
    createdAt: new Date().toISOString(),
    customerId: 'CUST-001',
    customer: { id: 'CUST-001', firstName: 'Jan', lastName: 'Jansen', email: 'jan@voorbeeld.nl', phone: '0612345678', address: 'Hoofdstraat 1', city: 'Amsterdam' },
    date: new Date().toISOString().split('T')[0],
    showId: 'weekend',
    status: BookingStatus.CONFIRMED,
    partySize: 4,
    packageType: 'premium',
    addons: [],
    merchandise: [{ id: 'prog-book', quantity: 1 }],
    financials: { total: 440, subtotal: 440, discount: 0, paid: 440, isPaid: true, finalTotal: 440 },
    notes: {
      dietary: '',
      isCelebrating: false,
      celebrationText: '',
      internal: 'Seed data'
    }
  }
];

export const seedDemoData = () => {
  saveData(STORAGE_KEYS.SHOWS, SHOW_DEFINITIONS);
  saveData(STORAGE_KEYS.CALENDAR_EVENTS, generateCalendar()); // Using new key
  saveData(STORAGE_KEYS.MERCHANDISE, MERCH_CATALOG);
  saveData(STORAGE_KEYS.RESERVATIONS, MOCK_RESERVATIONS);
  saveData(STORAGE_KEYS.VOUCHER_CONFIG, VOUCHER_SALE_CONFIG);
  saveData(STORAGE_KEYS.EMAIL_TEMPLATES, DEFAULT_EMAIL_TEMPLATES);
  saveData(STORAGE_KEYS.PROMOS, SEED_PROMO_RULES);
  saveData(STORAGE_KEYS.VOUCHERS, [
    { code: 'TEST-100', originalBalance: 100, currentBalance: 100, isActive: true, issuedTo: 'Test Gebruiker' },
    { code: 'VIP-GIFT', originalBalance: 250, currentBalance: 250, isActive: true, issuedTo: 'VIP Relatie' }
  ]);
  setSeeded(true);
};

export const resetDemoData = () => {
  clearAllData();
  seedDemoData();
};

// --- Generator Functions ---

const NAMES = ['De Vries', 'Bakker', 'Visser', 'Smit', 'Mulder', 'Janssen', 'De Jong', 'Bos', 'Meijer', 'Vermeulen'];
const FIRSTNAMES = ['Emma', 'Noah', 'Mila', 'Sem', 'Julia', 'Lucas', 'Sophie', 'Daan', 'Tess', 'Finn'];

const getRandomElement = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const generateRandomBookings = (count: number) => {
  // Use legacy adapter to get events in format expected by booking logic
  const events = calendarRepo.getLegacyEvents().filter(e => e.availability !== 'CLOSED');
  const shows = showRepo.getAll();
  const existing = bookingRepo.getAll();
  const newBookings: Reservation[] = [];

  if (events.length === 0 || shows.length === 0) return;

  for (let i = 0; i < count; i++) {
    const event = getRandomElement(events);
    const show = shows.find(s => s.id === event.showId) || shows[0];
    const firstName = getRandomElement(FIRSTNAMES);
    const lastName = getRandomElement(NAMES);
    const partySize = Math.floor(Math.random() * 6) + 2;
    const packageType = Math.random() > 0.5 ? 'premium' : 'standard';
    
    // Pricing
    const pricing = getEffectivePricing(event, show);
    const wizardState = {
      totalGuests: partySize,
      packageType,
      addons: [],
      merchandise: [],
    };
    const totals = calculateBookingTotals(wizardState, pricing);

    const booking: Reservation = {
      id: `RES-GEN-${Date.now()}-${i}`,
      createdAt: new Date().toISOString(),
      customerId: `CUST-GEN-${i}`,
      customer: {
        id: `CUST-GEN-${i}`,
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
        phone: '0612345678',
        address: 'Willekeurigestraat 1',
        city: 'Amsterdam'
      },
      date: event.date,
      showId: event.showId,
      status: Math.random() > 0.7 ? BookingStatus.CONFIRMED : Math.random() > 0.5 ? BookingStatus.OPTION : BookingStatus.REQUEST,
      partySize,
      packageType: packageType as 'standard' | 'premium',
      addons: [],
      merchandise: [],
      financials: {
        total: totals.subtotal,
        subtotal: totals.subtotal,
        discount: 0,
        finalTotal: totals.amountDue,
        paid: 0,
        isPaid: false,
        paymentDueAt: new Date(new Date().setDate(new Date().getDate() + 14)).toISOString()
      },
      notes: {
        dietary: Math.random() > 0.8 ? 'Vegetarisch' : '',
        isCelebrating: Math.random() > 0.9,
        celebrationText: 'Verjaardag'
      }
    };
    newBookings.push(booking);
  }

  bookingRepo.saveAll([...existing, ...newBookings]);
};

export const generateRandomWaitlist = (count: number) => {
  const events = calendarRepo.getLegacyEvents();
  const existing = waitlistRepo.getAll();
  const newEntries: WaitlistEntry[] = [];

  for (let i = 0; i < count; i++) {
    const event = getRandomElement(events);
    const firstName = getRandomElement(FIRSTNAMES);
    const lastName = getRandomElement(NAMES);

    newEntries.push({
      id: `WL-GEN-${Date.now()}-${i}`,
      date: event.date,
      customerId: `CUST-WL-${i}`,
      partySize: Math.floor(Math.random() * 4) + 2,
      requestDate: new Date().toISOString(),
      status: 'PENDING',
      contactName: `${firstName} ${lastName}`,
      contactEmail: `${firstName.toLowerCase()}@example.com`,
      notes: 'Generated via Demo Panel'
    });
  }
  
  waitlistRepo.saveAll([...existing, ...newEntries]);
};

export const generateRandomVouchers = (count: number) => {
  const existing = voucherRepo.getAll();
  const newVouchers: Voucher[] = [];

  for (let i = 0; i < count; i++) {
    newVouchers.push({
      code: `GEN-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      originalBalance: 100,
      currentBalance: 100,
      isActive: true,
      createdAt: new Date().toISOString(),
      issuedTo: 'Demo User'
    });
  }

  voucherRepo.saveAll([...existing, ...newVouchers]);
};

export const runSmokeTest = () => {
  const logs: string[] = [];
  let passed = true;

  const log = (msg: string, isErr = false) => {
    logs.push(isErr ? `❌ ${msg}` : `✅ ${msg}`);
    if (isErr) passed = false;
  };

  try {
    const events = calendarRepo.getLegacyEvents();
    const bookings = bookingRepo.getAll();
    const shows = showRepo.getAll();

    if (events.length === 0) log('Event database is empty', true);
    else log(`${events.length} events found (legacy view)`);

    if (shows.length === 0) log('Show definitions missing', true);
    else log(`${shows.length} shows found`);

    if (bookings.length === 0) log('No bookings found (warning only)');
    else {
      let invalidRefs = 0;
      let calcErrors = 0;
      
      bookings.forEach(b => {
        const ev = events.find(e => e.date === b.date);
        if (!ev) invalidRefs++;
        
        if (!b.financials || typeof b.financials.finalTotal !== 'number') {
          calcErrors++;
        }
      });

      if (invalidRefs > 0) log(`${invalidRefs} bookings have invalid event dates`, true);
      else log('All booking dates valid');

      if (calcErrors > 0) log(`${calcErrors} bookings have malformed financials`, true);
      else log('All booking financials valid');
    }

    const vouchers = voucherRepo.getAll();
    if (vouchers.some(v => v.currentBalance > v.originalBalance)) log('Voucher integrity check failed (curr > orig)', true);
    else log('Voucher integrity check passed');

  } catch (e: any) {
    log(`Exception during test: ${e.message}`, true);
  }

  return { passed, logs };
};
