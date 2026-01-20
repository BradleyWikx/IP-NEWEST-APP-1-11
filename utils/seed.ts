
import { 
  ShowDefinition, CalendarEvent, Reservation, Customer, 
  BookingStatus, WaitlistEntry, Voucher, VoucherOrder,
  AdminNotification, Task, EmailLog, ShowEvent, PaymentRecord,
  AuditLogEntry
} from '../types';
import { 
  showRepo, calendarRepo, customerRepo, bookingRepo, 
  waitlistRepo, voucherRepo, voucherOrderRepo, 
  tasksRepo, notificationsRepo, merchRepo, emailLogRepo,
  auditRepo, notesRepo
} from './storage';
import { MOCK_MERCHANDISE } from '../mock/data';

// --- CONSTANTS ---

const FIRST_NAMES = ['Sanne', 'Eva', 'Lieke', 'Anne', 'Lisa', 'Emma', 'Tess', 'Sophie', 'Julia', 'Anna', 'Laura', 'Sarah', 'Femke', 'Lotte', 'Fleur', 'Jan', 'Peter', 'Mark', 'Thomas', 'Paul', 'Rob', 'Kees', 'Willem', 'Dennis', 'Tim', 'Bas', 'Nick', 'Daan', 'Thijs', 'Bram', 'Sem', 'Lucas', 'Milan', 'Levi'];
const LAST_NAMES = ['Jansen', 'de Vries', 'Bakker', 'Visser', 'Smit', 'Meijer', 'de Jong', 'Mulder', 'Groot', 'Bos', 'Vos', 'Peters', 'Hendriks', 'van Dijk', 'Dekker', 'Brouwer', 'de Ruiter', 'Janssen', 'de Boer', 'Vermeulen', 'Verhoeven', 'Willems', 'Kramer', 'Schouten', 'Van der Meer', 'Prins'];

const COMPANIES = [
  'Rabobank Regio Oost', 'Gemeente Utrecht', 'Bouwbedrijf Janssen', 'Huisartsenpraktijk De Linde', 
  'Notariskantoor Viser', 'Basisschool De Klimop', 'Politie Eenheid Midden', 'Brandweer Kazerne A',
  'Albert Heijn Distributie', 'Bol.com Tech Team', 'Zorginstelling Het Anker', 'Rotary Club Noord',
  'Voetbalvereniging SV', 'Tandartspraktijk Wit', 'Kapsalon Chic', 'Autodealer Van Dam', 'Restaurant De Gouden Pollepel'
];

const CITIES = ['Utrecht', 'Amersfoort', 'Zeist', 'Hilversum', 'De Bilt', 'Nieuwegein', 'Houten', 'Maarssen', 'Baarn', 'Soest', 'Bilthoven', 'Doorn'];
const STREETS = ['Dorpsstraat', 'Hoofdstraat', 'Kerkstraat', 'Stationsweg', 'Industrieweg', 'Amsterdamsestraatweg', 'Utrechtseweg', 'Brink', 'Schoolstraat', 'Molenweg', 'Julianalaan', 'Beatrixstraat'];

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

const yieldToUI = () => new Promise(resolve => setTimeout(resolve, 0));

// VOUCHER CODE GENERATOR (Matches VoucherManager logic)
const VOUCHER_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; 
const generateRealisticVoucherCode = (prefix: string = 'GS'): string => {
    // Simplified checksum logic for seed (visual match only)
    const p1 = Array(4).fill(0).map(() => VOUCHER_CHARSET[randomInt(0, VOUCHER_CHARSET.length -1)]).join('');
    const p2 = Array(4).fill(0).map(() => VOUCHER_CHARSET[randomInt(0, VOUCHER_CHARSET.length -1)]).join('');
    const check = VOUCHER_CHARSET[randomInt(0, VOUCHER_CHARSET.length -1)];
    return `${prefix}-${p1}-${p2}-${check}`;
};

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
  const auditLogs: AuditLogEntry[] = [];

  const today = new Date();
  const todayStr = toLocalYMD(today);
  
  // Calculate next Saturday for special scenario
  const nextSat = new Date();
  nextSat.setDate(nextSat.getDate() + ((6 - nextSat.getDay() + 7) % 7));
  const nextSatStr = toLocalYMD(nextSat);

  // --- 2. CALENDAR & RESERVATIONS LOOP ---
  
  const startDate = addDays(today, -90);
  const endDate = addDays(today, 120); // 4 months ahead
  let currentDate = startDate;
  let dayCount = 0;
  const totalDays = 210;

  // Track customer ID to reuse them for realism
  const customerPool: string[] = [];
  
  // Track tables per date for sequential assignment
  const tableCounters: Record<string, number> = {};

  while (currentDate <= endDate) {
    dayCount++;
    if (dayCount % 20 === 0 && onProgress) {
        onProgress(`Agenda vullen (${Math.round((dayCount/totalDays)*40) + 5}%)`, 5 + Math.round((dayCount/totalDays)*40));
        await yieldToUI();
    }

    const dateStr = toLocalYMD(currentDate);
    const isToday = dateStr === todayStr;
    const dayOfWeek = currentDate.getDay();

    let showDef: ShowDefinition | null = null;

    // RULE: Schedule logic
    if (isToday) showDef = SHOW_DEFS[0]; // Always show today
    else if (dayOfWeek === 5) showDef = SHOW_DEFS[0]; // Friday
    else if (dayOfWeek === 6) showDef = randomBool(0.7) ? SHOW_DEFS[0] : SHOW_DEFS[2]; // Saturday
    else if (dayOfWeek === 0 && randomBool(0.4)) showDef = SHOW_DEFS[1]; // Sunday

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
            pricing: profile.pricing
        };

        // --- POPULATE RESERVATIONS ---
        
        let targetOccupancy = 0;
        const isPast = currentDate < today;
        
        // Past events: High occupancy. Future: tapering off.
        if (isPast) targetOccupancy = randomInt(120, 225);
        else if (isToday) targetOccupancy = randomInt(150, 200);
        else {
            const daysFuture = Math.floor((currentDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
            if (daysFuture < 14) targetOccupancy = randomInt(100, 180);
            else if (daysFuture < 30) targetOccupancy = randomInt(40, 100);
            else targetOccupancy = randomInt(0, 40);
        }

        let currentOccupancy = 0;

        // Specific scenario for TODAY: Needs to be lively for demo
        if (isToday) {
             // Ensure at least some "Arrived" guests for Host View
             const arrivedGroups = 5;
             for(let k=0; k<arrivedGroups; k++) {
                 const pax = randomInt(2, 4);
                 const c = createRandomCustomer();
                 customers.push(c);
                 // Table assignment logic
                 tableCounters[dateStr] = (tableCounters[dateStr] || 0) + 1;
                 const tableId = `TAB-${tableCounters[dateStr]}`;
                 
                 reservations.push(createReservation(c, event, showDef, dateStr, pax, BookingStatus.ARRIVED, new Date().toISOString(), false, tableId));
                 currentOccupancy += pax;
             }
        }

        while(currentOccupancy < targetOccupancy) {
            const partySize = randomInt(2, 8);
            if (currentOccupancy + partySize > 230) break;
            
            // Reuse customer occasionally (Loyalty)
            let c: Customer;
            if (customerPool.length > 20 && randomBool(0.1)) {
                const existingId = randomItem(customerPool);
                const existingC = customers.find(cust => cust.id === existingId);
                c = existingC || createRandomCustomer();
            } else {
                c = createRandomCustomer();
                customers.push(c);
                customerPool.push(c.id);
            }
            
            // Status Logic
            let status: BookingStatus = BookingStatus.CONFIRMED;
            if (!isPast) {
                const r = Math.random();
                if (r > 0.95) status = BookingStatus.REQUEST;
                else if (r > 0.8) status = BookingStatus.OPTION;
            }

            const createdAt = new Date(currentDate.getTime() - randomInt(86400000 * 5, 86400000 * 60)).toISOString();
            
            // Assign sequential table number for confirmed/arrived/past bookings
            let tableId: string | undefined = undefined;
            // Note: status in this loop is restricted to CONFIRMED, REQUEST, OPTION.
            if (status === BookingStatus.CONFIRMED) {
                 tableCounters[dateStr] = (tableCounters[dateStr] || 0) + 1;
                 tableId = `TAB-${tableCounters[dateStr]}`;
            }

            const r = createReservation(c, event, showDef, dateStr, partySize, status, createdAt, randomBool(0.15), tableId);
            
            reservations.push(r);
            currentOccupancy += partySize;
        }
        
        if (currentOccupancy >= 225) event.status = 'CLOSED';
        events.push(event);
    }
    currentDate = addDays(currentDate, 1);
  }

  // --- 3. SPECIAL CASES & ISSUES ---
  if (onProgress) onProgress("Scenario's toevoegen...", 65);

  // A. Overdue Payment
  const overdueEvent = events.find(e => e.date > todayStr && e.type === 'SHOW');
  if (overdueEvent) {
      const c = createRandomCustomer(); 
      c.lastName = "Vergeetachtig";
      customers.push(c);
      
      tableCounters[overdueEvent.date] = (tableCounters[overdueEvent.date] || 0) + 1;
      const tableId = `TAB-${tableCounters[overdueEvent.date]}`;

      const res = createReservation(c, overdueEvent, SHOW_DEFS[0], overdueEvent.date, 4, BookingStatus.CONFIRMED, addDays(today, -20).toISOString(), false, tableId);
      // Hack financials to be unpaid and overdue
      res.financials.paid = 0;
      res.financials.isPaid = false;
      res.financials.payments = [];
      res.financials.paymentDueAt = addDays(today, -5).toISOString();
      reservations.push(res);
  }

  // B. Waitlist
  const fullEvent = events.find(e => (e as any).status === 'CLOSED' && e.date > todayStr);
  if (fullEvent) {
      for(let i=0; i<5; i++) {
          const c = createRandomCustomer();
          waitlist.push({
              id: `WL-${Date.now()}-${i}`,
              date: fullEvent.date,
              customerId: c.id,
              contactName: `${c.firstName} ${c.lastName}`,
              contactEmail: c.email,
              contactPhone: c.phone,
              partySize: randomInt(2, 4),
              requestDate: new Date().toISOString(),
              status: 'PENDING',
              notes: 'Graag bellen als er plek is!'
          });
      }
  }

  // --- 4. VOUCHERS (Correct Format) ---
  if (onProgress) onProgress("Vouchers genereren...", 75);
  
  const voucherList: Voucher[] = [];
  const voucherOrders: VoucherOrder[] = [];

  for(let i=0; i<15; i++) {
      const amount = randomItem([50, 75, 100, 150]);
      const code = generateRealisticVoucherCode();
      const isActive = i < 10; // 5 used
      const balance = isActive ? amount : 0;
      
      const v: Voucher = {
          code,
          originalBalance: amount,
          currentBalance: balance,
          isActive,
          createdAt: addDays(today, -randomInt(1, 100)).toISOString(),
          label: 'Cadeaukaart',
          issuedTo: `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`
      };
      voucherList.push(v);

      // Create Order
      voucherOrders.push({
          id: `ORD-${code.split('-')[1]}`,
          createdAt: v.createdAt!,
          status: 'PAID',
          buyer: { firstName: 'Koper', lastName: 'Van Voucher' },
          items: [{ id: 'voucher', label: 'Cadeaubon', price: amount, quantity: 1 }],
          amount,
          totals: { subtotal: amount, shipping: 0, fee: 0, grandTotal: amount },
          deliveryMethod: 'DIGITAL',
          recipient: { name: v.issuedTo! },
          issuanceMode: 'INDIVIDUAL',
          generatedCodes: [code]
      });
  }

  // --- 5. TASKS & NOTIFICATIONS ---
  if (onProgress) onProgress("Taken en meldingen...", 85);
  
  const tasks: Task[] = [
      { id: 'T1', type: 'GENERAL_FOLLOW_UP', title: 'Bel Bedrijf Jansen', notes: 'Factuur details kloppen niet', dueAt: addDays(today, -1).toISOString(), status: 'OPEN', entityType: 'CUSTOMER', entityId: 'CUST-1', createdAt: todayStr },
      { id: 'T2', type: 'CALL_OPTION_EXPIRING', title: 'Nabellen optie', notes: 'Verloopt vandaag', dueAt: todayStr, status: 'OPEN', entityType: 'RESERVATION', entityId: 'RES-2', createdAt: todayStr },
  ];

  const notifications: AdminNotification[] = [
      { id: 'N1', type: 'NEW_BOOKING', title: 'Nieuwe Aanvraag', message: 'Groep van 12 personen voor Zaterdag.', link: '/admin/reservations', entityType: 'RESERVATION', entityId: 'RES-NEW', severity: 'INFO', createdAt: new Date().toISOString() },
      { id: 'N2', type: 'PAYMENT_OVERDUE', title: 'Betaling Vervallen', message: 'Reservering De Vries staat nog open.', link: '/admin/payments', entityType: 'RESERVATION', entityId: 'RES-OVERDUE', severity: 'WARNING', createdAt: new Date().toISOString() }
  ];

  // --- 6. AUDIT LOGS ---
  if (onProgress) onProgress("Logboeken vullen...", 90);
  
  for(let i=0; i<20; i++) {
      auditLogs.push({
          id: `LOG-${i}`,
          timestamp: new Date(today.getTime() - i * 3600000).toISOString(),
          user: { name: 'Admin User', role: 'ADMIN' },
          action: randomItem(['UPDATE_STATUS', 'CREATE_RESERVATION', 'SEND_EMAIL', 'REGISTER_PAYMENT']),
          entityType: 'RESERVATION',
          entityId: `RES-LOG-${i}`,
          changes: { description: 'Systeem actie uitgevoerd tijdens demo generatie.' }
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
  auditRepo.saveAll(auditLogs);
  
  // Add a nice note
  notesRepo.saveAll([{
      id: 'NOTE-INIT',
      text: 'Welkom in de demo omgeving! Alle data is fictief maar realistisch gestructureerd. Probeer de agenda, maak een boeking of verwerk een betaling.',
      authorRole: 'ADMIN',
      createdAt: new Date().toISOString()
  }]);

  if (onProgress) onProgress("Klaar!", 100);
  console.log(`✅ Advanced Seed Complete. ${reservations.length} reservations, ${voucherList.length} vouchers.`);
};

// --- SUB-FUNCTIONS ---

function createRandomCustomer(): Customer {
    const isBusiness = randomBool(0.15);
    const lastName = randomItem(LAST_NAMES);
    return {
        id: `CUST-${Date.now()}-${randomInt(1000,99999)}`,
        salutation: randomItem(['Dhr.', 'Mevr.']),
        firstName: randomItem(FIRST_NAMES),
        lastName: isBusiness ? `(Bedrijf) ${lastName}` : lastName,
        email: `demo.${randomInt(100,999)}@example.com`,
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
    forceMerch: boolean,
    tableId?: string
): Reservation {
    const isPremium = randomBool(0.3);
    const showEvent = event as ShowEvent;
    
    // Pricing Logic
    const pricing = showEvent.pricing || { standard: 0, premium: 0 };
    const pricePerPerson = isPremium ? (pricing.premium || 0) : (pricing.standard || 0);
    
    let total = partySize * pricePerPerson;
    
    const merch = [];
    if (forceMerch || randomBool(0.15)) {
        const item = randomItem(MOCK_MERCHANDISE);
        const qty = randomInt(1, 2);
        merch.push({ id: item.id, quantity: qty });
        total += item.price * qty;
    }

    const addons = [];
    // Pre-drinks logic
    if (partySize > 20 && randomBool(0.5)) {
        addons.push({ id: 'pre-drinks', quantity: partySize });
        total += 12.5 * partySize;
    }

    const isPaid = status === BookingStatus.CONFIRMED || status === BookingStatus.ARRIVED || status === BookingStatus.ARCHIVED;
    
    // Create realistic payment records if paid
    const payments: PaymentRecord[] = [];
    if (isPaid) {
        payments.push({
            id: `PAY-${Date.now()}-${randomInt(100,999)}`,
            amount: total,
            method: randomItem(['IDEAL', 'CREDITCARD', 'FACTUUR']),
            date: createdAt, // Paid at booking time
            type: 'FINAL'
        });
    }

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
            total, 
            subtotal: total, 
            discount: 0, 
            finalTotal: total,
            paid: isPaid ? total : 0,
            isPaid,
            paymentMethod: isPaid ? payments[0].method : undefined,
            paidAt: isPaid ? createdAt : undefined,
            paymentDueAt: addDays(new Date(date), -14).toISOString(),
            payments: payments
        },
        notes: {
            dietary: randomBool(0.2) ? '1x Glutenvrij' : '',
            structuredDietary: randomBool(0.2) ? { 'Glutenvrij': 1 } : {},
            comments: '',
            isCelebrating: randomBool(0.1),
            celebrationText: 'Verjaardag',
            internal: 'Demo generated'
        },
        startTime: event.times.start,
        tableId
    };
}
