
import { 
  ShowDefinition, CalendarEvent, Reservation, Customer, 
  BookingStatus, WaitlistEntry, Voucher, VoucherOrder,
  LineItem, AdminNotification, Task, EmailLog, MerchandiseItem,
  NotificationType, NotificationSeverity, ShowEvent
} from '../types';
import { 
  showRepo, calendarRepo, customerRepo, bookingRepo, 
  waitlistRepo, voucherRepo, voucherOrderRepo, 
  tasksRepo, notificationsRepo, merchRepo, emailLogRepo
} from './storage';
import { MOCK_ADDONS, MOCK_MERCHANDISE } from '../mock/data';

// --- CONSTANTS ---

const FIRST_NAMES = ['Sanne', 'Eva', 'Lieke', 'Anne', 'Lisa', 'Emma', 'Tess', 'Sophie', 'Julia', 'Anna', 'Laura', 'Sarah', 'Femke', 'Lotte', 'Fleur', 'Jan', 'Peter', 'Mark', 'Thomas', 'Paul', 'Rob', 'Kees', 'Willem', 'Dennis', 'Tim', 'Bas', 'Nick', 'Daan', 'Thijs'];
const LAST_NAMES = ['Jansen', 'de Vries', 'Bakker', 'Visser', 'Smit', 'Meijer', 'de Jong', 'Mulder', 'Groot', 'Bos', 'Vos', 'Peters', 'Hendriks', 'van Dijk', 'Dekker', 'Brouwer', 'de Ruiter', 'Janssen', 'de Boer', 'Vermeulen', 'Verhoeven', 'Willems', 'Kramer', 'Schouten'];

const COMPANIES = [
  'Rabobank Regio Oost', 'Gemeente Utrecht', 'Bouwbedrijf Janssen', 'Huisartsenpraktijk De Linde', 
  'Notariskantoor Viser', 'Basisschool De Klimop', 'Politie Eenheid Midden', 'Brandweer Kazerne A',
  'Albert Heijn Distributie', 'Bol.com Tech Team', 'Zorginstelling Het Anker', 'Rotary Club Noord',
  'Voetbalvereniging SV', 'Tandartspraktijk Wit', 'Kapsalon Chic', 'Autodealer Van Dam', 'Restaurant De Gouden Pollepel'
];

const CITIES = ['Utrecht', 'Amersfoort', 'Zeist', 'Hilversum', 'De Bilt', 'Nieuwegein', 'Houten', 'Maarssen', 'Baarn', 'Soest'];
const STREETS = ['Dorpsstraat', 'Hoofdstraat', 'Kerkstraat', 'Stationsweg', 'Industrieweg', 'Amsterdamsestraatweg', 'Utrechtseweg', 'Brink', 'Schoolstraat', 'Molenweg'];

// --- HELPERS ---

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomBool = (chance: number = 0.5) => Math.random() < chance;

const toLocalYMD = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number) => { 
  const d = new Date(date); 
  d.setDate(d.getDate() + days); 
  return d; 
};

const generateSecureCode = () => `CODE-${randomInt(1000,9999)}-${randomInt(100,999)}`;

const yieldToUI = () => new Promise(resolve => setTimeout(resolve, 0));

// --- DATA DEFINITIONS ---

const SHOW_DEFS: ShowDefinition[] = [
  {
    id: 'show-wonderland',
    name: 'Alles in Wonderland',
    description: 'Een avond vol culinaire magie en verwondering. Ons paradepaardje.',
    activeFrom: '2024-01-01',
    activeTo: '2026-12-31',
    isActive: true,
    tags: ['Magie', 'Culinair', 'Beleving'],
    profiles: [
        { id: 'prof-wonderland', name: 'Dinner Show', color: 'purple', timing: { doorTime: '18:30', startTime: '19:30', endTime: '23:00' }, pricing: { standard: 79.50, premium: 99.50, addonPreDrink: 12.5, addonAfterDrink: 15 } }
    ]
  },
  {
    id: 'show-heroes',
    name: 'Zorgzame Helden',
    description: 'Een muzikale ode aan de helden van de zorg. Meezingers en tranentrekkers.',
    activeFrom: '2024-01-01',
    activeTo: '2026-12-31',
    isActive: true,
    tags: ['Muziek', 'Ode', 'Nederlands'],
    profiles: [
        { id: 'prof-heroes', name: 'Special', color: 'teal', timing: { doorTime: '19:00', startTime: '20:00', endTime: '22:30' }, pricing: { standard: 69.50, premium: 89.50, addonPreDrink: 12.5, addonAfterDrink: 15 } }
    ]
  },
  {
    id: 'show-vegas',
    name: 'Viva Las Vegas',
    description: 'Glitter, glamour en de grootste hits uit Las Vegas.',
    activeFrom: '2024-01-01',
    activeTo: '2026-12-31',
    isActive: true,
    tags: ['Show', 'Dans', 'Glamour'],
    profiles: [
        { id: 'prof-vegas', name: 'Gala Night', color: 'rose', timing: { doorTime: '19:00', startTime: '20:00', endTime: '23:30' }, pricing: { standard: 85.00, premium: 110.00, addonPreDrink: 15, addonAfterDrink: 17.5 } }
    ]
  }
];

// --- MAIN SEED FUNCTION ---

export const seedFullDatabase = async (onProgress?: (msg: string, progress: number) => void) => {
  console.log("🚀 Starting Advanced Seed...");
  if (onProgress) onProgress("Database wissen...", 5);
  
  localStorage.clear();
  await yieldToUI();

  // 1. BASICS
  showRepo.saveAll(SHOW_DEFS);
  merchRepo.saveAll(MOCK_MERCHANDISE);
  
  const events: CalendarEvent[] = [];
  const reservations: Reservation[] = [];
  const customers: Customer[] = [];
  const waitlist: WaitlistEntry[] = [];

  const today = new Date();
  const todayStr = toLocalYMD(today);
  
  // Calculate next Saturday for the specific Merch scenario
  const nextSat = new Date();
  nextSat.setDate(nextSat.getDate() + ((6 - nextSat.getDay() + 7) % 7));
  const nextSatStr = toLocalYMD(nextSat);

  // --- 2. CALENDAR & RESERVATIONS LOOP ---
  
  const startDate = addDays(today, -90);
  const endDate = addDays(today, 180);
  const totalDays = 270;
  let currentDate = startDate;
  let dayCount = 0;

  while (currentDate <= endDate) {
    dayCount++;
    if (dayCount % 20 === 0 && onProgress) {
        onProgress(`Agenda vullen (${Math.round((dayCount/totalDays)*40) + 5}%)`, 5 + Math.round((dayCount/totalDays)*40));
        await yieldToUI();
    }

    const dateStr = toLocalYMD(currentDate);
    const isToday = dateStr === todayStr;
    const isNextSat = dateStr === nextSatStr;
    const dayOfWeek = currentDate.getDay();

    let showDef: ShowDefinition | null = null;

    // RULE: Always show today (Wonderland)
    if (isToday) showDef = SHOW_DEFS[0];
    else if (isNextSat) showDef = SHOW_DEFS[0]; // Force show on target merch date
    else if (dayOfWeek === 5) showDef = SHOW_DEFS[0];
    else if (dayOfWeek === 6) showDef = randomBool(0.7) ? SHOW_DEFS[0] : SHOW_DEFS[2];
    else if (dayOfWeek === 0 && randomBool(0.3)) showDef = SHOW_DEFS[1];

    if (showDef) {
        const profile = showDef.profiles[0];
        const event: CalendarEvent = {
            id: `EVT-${dateStr}`,
            date: dateStr,
            type: 'SHOW',
            title: showDef.name,
            visibility: 'PUBLIC',
            bookingEnabled: true,
            times: { start: profile.timing.startTime, doorsOpen: profile.timing.doorTime, end: profile.timing.endTime },
            showId: showDef.id,
            profileId: profile.id,
            status: 'OPEN',
            capacity: 230,
            bookedCount: 0,
            pricing: profile.pricing
        };

        // --- SPECIFIC SCENARIO: TODAY (HOST VIEW) ---
        if (isToday) {
            let paxCount = 0;
            // Create exactly 20 reservations for the host view
            // 2 Arrived, 1 NoShow, 17 Confirmed
            const statuses = [
                ...Array(2).fill(BookingStatus.ARRIVED),
                BookingStatus.NOSHOW,
                ...Array(17).fill(BookingStatus.CONFIRMED)
            ];

            for (let i = 0; i < 20; i++) {
                const partySize = randomInt(2, 6);
                const status = statuses[i];
                const timeOffset = i * 60000; // 1 min difference for sorting
                const createdTime = new Date(today.getTime() - 10000000 + timeOffset).toISOString();

                const c = createRandomCustomer();
                customers.push(c);

                reservations.push(createReservation(
                    c, event, showDef, dateStr, partySize, status, createdTime, false
                ));
                paxCount += partySize;
            }
            event.bookedCount = paxCount;
        } 
        // --- SPECIFIC SCENARIO: NEXT SATURDAY (MERCH) ---
        else if (isNextSat) {
            // Add the Big Merch Order
            const c = createRandomCustomer();
            c.firstName = "Grote"; c.lastName = "Besteller";
            customers.push(c);
            
            const merchRes = createReservation(c, event, showDef, dateStr, 20, BookingStatus.CONFIRMED, new Date().toISOString(), true);
            
            // Add specific items: 10x Prog Book, 10x Mask
            const book = MOCK_MERCHANDISE.find(m => m.name.includes('Program'))!;
            const mask = MOCK_MERCHANDISE.find(m => m.name.includes('Masker'))!;
            
            merchRes.merchandise = [
                { id: book.id, quantity: 10 },
                { id: mask.id, quantity: 10 }
            ];
            // Recalc total
            const merchTotal = (10 * book.price) + (10 * mask.price);
            merchRes.financials.finalTotal += merchTotal;
            merchRes.financials.total += merchTotal;
            
            reservations.push(merchRes);
            event.bookedCount = 20; // + random filler below
        }
        // --- STANDARD FILLER ---
        else {
            const isPast = currentDate < today;
            let currentOccupancy = 0;
            let target = isPast ? randomInt(100, 220) : randomInt(0, 150);
            
            while(currentOccupancy < target) {
                const partySize = randomInt(2, 8);
                if (currentOccupancy + partySize > 230) break;
                
                const c = createRandomCustomer();
                customers.push(c);
                
                // 15% Chance of Merchandise
                const hasMerch = randomBool(0.15);
                const status = isPast ? BookingStatus.CONFIRMED : (randomBool(0.8) ? BookingStatus.CONFIRMED : BookingStatus.OPTION);
                
                const r = createReservation(c, event, showDef, dateStr, partySize, status, new Date(currentDate.getTime() - randomInt(86400000, 86400000*30)).toISOString(), hasMerch);
                
                reservations.push(r);
                currentOccupancy += partySize;
            }
            event.bookedCount = currentOccupancy;
            if (currentOccupancy >= 220) event.status = 'CLOSED';
        }
        events.push(event);
    }
    currentDate = addDays(currentDate, 1);
  }

  // --- 3. FINANCIAL EDGE CASES ---
  if (onProgress) onProgress("Financiële data toevoegen...", 60);
  
  // A. Wanbetaler (Archived but Unpaid)
  const deadbeatCust = createRandomCustomer();
  deadbeatCust.lastName = "Wanbetaler";
  customers.push(deadbeatCust);
  const pastEvent = events.find(e => e.date < todayStr && e.type === 'SHOW');
  if (pastEvent) {
      const deadbeatRes = createReservation(deadbeatCust, pastEvent, SHOW_DEFS[0], pastEvent.date, 4, BookingStatus.ARCHIVED, addDays(today, -40).toISOString(), false);
      deadbeatRes.financials.isPaid = false;
      deadbeatRes.financials.paid = 0;
      deadbeatRes.financials.paymentDueAt = addDays(today, -30).toISOString(); // Overdue
      reservations.push(deadbeatRes);
  }

  // B. Grote Aanbetaling (Future, €2000 total, €500 paid)
  const depositCust = createRandomCustomer();
  depositCust.lastName = "De Grote Betaler";
  depositCust.companyName = "Big Corp BV";
  depositCust.isBusiness = true;
  customers.push(depositCust);
  const futureEvent = events.find(e => e.date > todayStr && e.type === 'SHOW');
  if (futureEvent) {
      const depositRes = createReservation(depositCust, futureEvent, SHOW_DEFS[0], futureEvent.date, 20, BookingStatus.CONFIRMED, new Date().toISOString(), false);
      // Force prices to hit 2000 roughly
      depositRes.adminPriceOverride = { unitPrice: 100, reason: 'All-in deal' };
      depositRes.financials.finalTotal = 2000;
      depositRes.financials.paid = 500; // Partial
      depositRes.financials.isPaid = false;
      reservations.push(depositRes);
  }

  // C. Factuur Klant (Sent status via payment method)
  const invoiceCust = createRandomCustomer();
  invoiceCust.lastName = "Factuurklant";
  customers.push(invoiceCust);
  if (futureEvent) {
      const invRes = createReservation(invoiceCust, futureEvent, SHOW_DEFS[0], futureEvent.date, 6, BookingStatus.CONFIRMED, new Date().toISOString(), false);
      invRes.financials.paymentMethod = 'FACTUUR';
      invRes.financials.isPaid = false;
      invRes.notes.internal = 'Factuur verzonden op ' + todayStr;
      reservations.push(invRes);
  }

  // --- 4. VOUCHERS & CADAEUBONNEN (Requirement #1) ---
  if (onProgress) onProgress("Vouchers genereren...", 75);
  await yieldToUI();

  const voucherList: Voucher[] = [];
  const voucherOrders: VoucherOrder[] = [];

  const createVoucher = (status: 'NEW' | 'PARTIAL' | 'USED' | 'EXPIRED' | 'PHYSICAL') => {
      const amount = randomItem([50, 75, 100, 150]);
      const code = generateSecureCode();
      const creationDate = status === 'EXPIRED' ? '2023-01-01' : toLocalYMD(today);
      
      let currentBalance = amount;
      let isActive = true;

      if (status === 'PARTIAL') currentBalance = 25;
      if (status === 'USED') { currentBalance = 0; isActive = false; }
      if (status === 'EXPIRED') isActive = true; // Technically active but date logic in engine handles it, or toggle false. Let's toggle false for simplicity in list.
      if (status === 'EXPIRED') isActive = false; 

      const v: Voucher = {
          code,
          originalBalance: amount,
          currentBalance,
          isActive,
          createdAt: creationDate,
          label: status === 'PHYSICAL' ? 'Fysieke Cadeaukaart' : 'Digitale Voucher',
          issuedTo: `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`
      };
      voucherList.push(v);

      // Create Order for tracking
      const orderId = `ORD-${code}`;
      voucherOrders.push({
          id: orderId,
          createdAt: creationDate,
          status: 'PAID',
          buyer: { firstName: 'Koper', lastName: 'Van Voucher' },
          items: [{ id: 'voucher', label: 'Cadeaubon', price: amount, quantity: 1 }],
          amount,
          totals: { subtotal: amount, shipping: status === 'PHYSICAL' ? 4 : 0, fee: 0, grandTotal: amount + (status === 'PHYSICAL' ? 4 : 0) },
          deliveryMethod: status === 'PHYSICAL' ? 'POST' : 'DIGITAL',
          recipient: { 
              name: v.issuedTo!, 
              address: status === 'PHYSICAL' ? { street: 'Dorpsstraat 1', city: 'Utrecht', zip: '1234AB' } : undefined 
          },
          issuanceMode: 'INDIVIDUAL',
          generatedCodes: [code]
      });
  };

  for(let i=0; i<10; i++) createVoucher('NEW');
  for(let i=0; i<10; i++) createVoucher('PARTIAL');
  for(let i=0; i<10; i++) createVoucher('USED');
  for(let i=0; i<5; i++) createVoucher('EXPIRED');
  for(let i=0; i<5; i++) createVoucher('PHYSICAL');

  // --- 5. TASKS & NOTIFICATIONS (Requirement #3) ---
  if (onProgress) onProgress("Taken en meldingen...", 85);
  
  // Specific Tasks
  const tasks: Task[] = [
      { id: 'T1', type: 'GENERAL_FOLLOW_UP', title: 'Bel Bedrijf Jansen', notes: 'Factuur details kloppen niet', dueAt: addDays(today, -1).toISOString(), status: 'OPEN', entityType: 'CUSTOMER', entityId: 'CUST-1', createdAt: todayStr },
      { id: 'T2', type: 'GENERAL_FOLLOW_UP', title: 'Dieetwensen checken', notes: 'Groep De Vries (morgen)', dueAt: addDays(today, 1).toISOString(), status: 'OPEN', entityType: 'RESERVATION', entityId: 'RES-1', createdAt: todayStr },
      { id: 'T3', type: 'CALL_OPTION_EXPIRING', title: 'Nabellen optie', notes: 'Verloopt vandaag', dueAt: todayStr, status: 'OPEN', entityType: 'RESERVATION', entityId: 'RES-2', createdAt: todayStr },
      // Filler tasks
      ...Array(5).fill(0).map((_, i) => ({
          id: `T-FILL-${i}`,
          type: 'SEND_PAYMENT_REMINDER' as const,
          title: `Betaalherinnering sturen`,
          notes: 'Automatisch aangemaakt',
          dueAt: addDays(today, i).toISOString(),
          status: 'OPEN' as const,
          entityType: 'RESERVATION' as const,
          entityId: `RES-FILL-${i}`,
          createdAt: todayStr
      }))
  ];

  // Notifications
  const notifications: AdminNotification[] = [
      ...Array(10).fill(0).map((_, i) => ({
          id: `NOT-${i}`,
          type: randomItem(['NEW_BOOKING', 'PAYMENT_OVERDUE', 'NEW_WAITLIST', 'NEW_CHANGE_REQUEST'] as NotificationType[]),
          title: randomItem(['Nieuwe aanvraag', 'Betaling mislukt', 'Wachtlijst inschrijving', 'Wijziging']),
          message: 'Er is actie vereist voor deze melding.',
          link: '/admin',
          entityType: 'SYSTEM' as const,
          entityId: 'SYS',
          severity: randomItem(['INFO', 'WARNING', 'URGENT'] as NotificationSeverity[]),
          createdAt: new Date(today.getTime() - i * 3600000).toISOString()
      }))
  ];

  // --- 6. EMAIL LOGS (Requirement #6) ---
  if (onProgress) onProgress("Email logboek vullen...", 90);
  
  const emailLogs: EmailLog[] = [];
  const templates = ['BOOKING_CONFIRMED', 'BOOKING_PAYMENT_REMINDER', 'VOUCHER_DELIVERY_DIGITAL'];
  
  for(let i=0; i<50; i++) {
      const status = i < 2 ? 'FAILED' : 'SENT'; // 2 failures
      const tmpl = randomItem(templates);
      emailLogs.push({
          id: `MAIL-${i}`,
          templateKey: tmpl,
          entityType: 'RESERVATION',
          entityId: `RES-MAIL-${i}`,
          to: `klant${i}@example.com`,
          subject: `Uw reservering bij Inspiration Point`,
          bodyHtml: `<p>Dit is een test email content.</p>`,
          bodyText: 'Test content',
          status: status as any,
          createdAt: new Date(today.getTime() - i * 10000000).toISOString(),
          error: status === 'FAILED' ? 'SMTP Error: Connection Refused' : undefined
      });
  }

  // --- 7. SAVE ALL ---
  if (onProgress) onProgress("Opslaan...", 95);
  await yieldToUI();

  calendarRepo.saveAll(events);
  bookingRepo.saveAll(reservations);
  customerRepo.saveAll(customers);
  waitlistRepo.saveAll(waitlist);
  voucherRepo.saveAll(voucherList);
  voucherOrderRepo.saveAll(voucherOrders);
  tasksRepo.saveAll(tasks);
  notificationsRepo.saveAll(notifications);
  emailLogRepo.saveAll(emailLogs);

  // Trigger UI refresh
  window.dispatchEvent(new Event('storage-update'));

  if (onProgress) onProgress("Klaar!", 100);
  console.log(`✅ Advanced Seed Complete. ${reservations.length} reservations, ${voucherList.length} vouchers.`);
};

// --- SUB-FUNCTIONS ---

function createRandomCustomer(): Customer {
    const isBusiness = randomBool(0.2);
    const lastName = randomItem(LAST_NAMES);
    return {
        id: `CUST-${Date.now()}-${randomInt(1000,99999)}`,
        firstName: randomItem(FIRST_NAMES),
        lastName: isBusiness ? `(Bedrijf) ${lastName}` : lastName,
        email: `klant-${randomInt(100,999)}@example.com`,
        phone: '0612345678',
        isBusiness,
        companyName: isBusiness ? randomItem(COMPANIES) : undefined,
        street: randomItem(STREETS),
        houseNumber: `${randomInt(1, 150)}`,
        zip: '1234 AB',
        city: randomItem(CITIES),
        country: 'NL'
    };
}

function createReservation(
    customer: Customer, 
    event: CalendarEvent, 
    show: ShowDefinition, 
    date: string, 
    partySize: number, 
    status: BookingStatus, 
    createdAt: string,
    forceMerch: boolean
): Reservation {
    const isPremium = randomBool(0.3);
    // Explicitly cast event to ShowEvent since we are creating reservation for a show
    const showEvent = event as ShowEvent;
    
    // Safety check in case pricing is missing (should not happen for ShowEvent created in seed)
    const pricing = showEvent.pricing || { standard: 0, premium: 0 };
    const price = isPremium ? (pricing.premium || 0) : (pricing.standard || 0);
    
    let total = partySize * price;
    
    const merch = [];
    if (forceMerch || randomBool(0.15)) {
        const item = randomItem(MOCK_MERCHANDISE);
        merch.push({ id: item.id, quantity: randomInt(1, 4) });
        total += item.price * merch[0].quantity;
    }

    const addons = [];
    if (partySize > 20 && randomBool(0.5)) {
        addons.push({ id: 'pre-drinks', quantity: partySize });
        total += 12.5 * partySize;
    }

    const isPaid = status === BookingStatus.CONFIRMED || status === BookingStatus.ARRIVED || status === BookingStatus.ARCHIVED;

    return {
        id: `RES-${Date.now()}-${randomInt(1000,9999)}`,
        createdAt,
        customerId: customer.id,
        customer,
        date,
        showId: show.id,
        status,
        partySize,
        packageType: isPremium ? 'premium' : 'standard',
        addons,
        merchandise: merch,
        financials: {
            total, subtotal: total, discount: 0, finalTotal: total,
            paid: isPaid ? total : 0,
            isPaid,
            paymentMethod: isPaid ? 'IDEAL' : undefined,
            paidAt: isPaid ? createdAt : undefined,
            paymentDueAt: addDays(new Date(date), -14).toISOString()
        },
        notes: {
            dietary: randomBool(0.2) ? '1x Glutenvrij' : '',
            structuredDietary: {},
            comments: '',
            isCelebrating: randomBool(0.1),
            celebrationText: 'Verjaardag'
        },
        startTime: event.times.start
    };
}
