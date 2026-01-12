
import { 
  ShowDefinition, CalendarEvent, Reservation, Customer, 
  BookingStatus, WaitlistEntry, Voucher, VoucherOrder,
  LineItem, Task, AdminNotification, ShowProfile
} from '../types';
import { 
  showRepo, calendarRepo, customerRepo, bookingRepo, 
  waitlistRepo, voucherRepo, voucherOrderRepo, 
  tasksRepo, notificationsRepo, merchRepo
} from './storage';
import { MOCK_ADDONS, MOCK_MERCHANDISE } from '../mock/data';

// --- CONSTANTS ---

const FIRST_NAMES = ['Daan', 'Sophie', 'Lucas', 'Julia', 'Sem', 'Mila', 'Noah', 'Emma', 'Levi', 'Tess', 'Bram', 'Zoë', 'Luuk', 'Sara', 'Milan', 'Eva', 'Jesse', 'Nora', 'Thijs', 'Fleur', 'Jan', 'Sanne', 'Willem', 'Lotte', 'Hendrik', 'Anne'];
const LAST_NAMES = ['de Vries', 'Jansen', 'Bakker', 'Visser', 'Smit', 'Meijer', 'de Jong', 'Mulder', 'Groot', 'Bos', 'Vos', 'Peters', 'Hendriks', 'van Dijk', 'Dekker', 'Brouwer', 'de Ruiter', 'Janssen', 'de Boer', 'Vermeulen'];
const COMPANIES = ['Shell', 'Philips', 'Rabobank', 'KPN', 'Bol.com', 'Coolblue', 'ASML', 'Unilever', 'Heineken', 'ING', 'Gemeente Amsterdam', 'Ziggo'];
const CITIES = ['Amsterdam', 'Rotterdam', 'Utrecht', 'Eindhoven', 'Haarlem', 'Den Haag', 'Leiden', 'Zwolle'];
const DIETARY_OPTS = ['Glutenvrij', 'Lactosevrij', 'Notenallergie', 'Vegetarisch', 'Veganistisch', 'Geen Vis', 'Halal'];

// --- GENERATORS ---

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomBool = (chance: number = 0.5) => Math.random() < chance;
const addDays = (date: Date, days: number) => { const d = new Date(date); d.setDate(d.getDate() + days); return d; };
const yieldToUI = () => new Promise(resolve => setTimeout(resolve, 10)); // Short pause to let UI render

const SHOW_DEFS: ShowDefinition[] = [
  {
    id: 'show-disco',
    name: 'Saturday Night Fever',
    description: 'Een swingende avond terug naar de jaren 70.',
    activeFrom: '2024-01-01',
    activeTo: '2026-12-31',
    isActive: true,
    tags: ['Disco', 'Dans', 'Party'],
    profiles: [
        { id: 'prof-disco', name: 'Disco Night', color: 'purple', timing: { doorTime: '19:00', startTime: '20:00', endTime: '23:00' }, pricing: { standard: 75, premium: 95, addonPreDrink: 12.5, addonAfterDrink: 15 } }
    ]
  },
  {
    id: 'show-brunch',
    name: 'Sunday Soul Brunch',
    description: 'Heerlijk brunchen met live soul muziek.',
    activeFrom: '2024-01-01',
    activeTo: '2026-12-31',
    isActive: true,
    tags: ['Brunch', 'Muziek', 'Relaxed'],
    profiles: [
        { id: 'prof-brunch', name: 'Brunch', color: 'amber', timing: { doorTime: '11:00', startTime: '11:30', endTime: '14:30' }, pricing: { standard: 55, premium: 70, addonPreDrink: 10, addonAfterDrink: 10 } }
    ]
  },
  {
    id: 'show-comedy',
    name: 'Comedy Special',
    description: 'Lachen, gieren, brullen met top comedians.',
    activeFrom: '2024-01-01',
    activeTo: '2026-12-31',
    isActive: true,
    tags: ['Humor', 'Cabaret'],
    profiles: [
        { id: 'prof-comedy', name: 'Comedy Night', color: 'emerald', timing: { doorTime: '19:30', startTime: '20:30', endTime: '22:30' }, pricing: { standard: 60, premium: 80, addonPreDrink: 12.5, addonAfterDrink: 15 } }
    ]
  }
];

// --- MAIN FUNCTION ---

export const seedFullDatabase = async (onProgress?: (msg: string, progress: number) => void) => {
  console.log("🚀 Starting Universe Generation...");
  if (onProgress) onProgress("Cleaning database...", 5);
  
  // Wipe everything
  localStorage.clear();
  await yieldToUI();

  // 1. SAVE SHOWS
  if (onProgress) onProgress("Setting up shows...", 10);
  showRepo.saveAll(SHOW_DEFS);
  merchRepo.saveAll(MOCK_MERCHANDISE);
  await yieldToUI();

  // 2. GENERATE CUSTOMERS
  if (onProgress) onProgress("Generating 60+ customers...", 15);
  const customers: Customer[] = [];
  for (let i = 0; i < 60; i++) {
    const isBusiness = randomBool(0.15);
    const firstName = randomItem(FIRST_NAMES);
    const lastName = randomItem(LAST_NAMES);
    const company = isBusiness ? randomItem(COMPANIES) : undefined;
    
    customers.push({
        id: `CUST-${i + 1000}`,
        salutation: randomItem(['Dhr.', 'Mevr.']),
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s/g, '')}@${isBusiness ? company?.toLowerCase().replace(/\s/g, '') + '.nl' : 'gmail.com'}`,
        phone: `06-${randomInt(10000000, 99999999)}`,
        companyName: company,
        isBusiness,
        street: 'Dorpsstraat',
        houseNumber: `${randomInt(1, 100)}`,
        zip: `${randomInt(1000, 9999)} AA`,
        city: randomItem(CITIES),
        country: 'NL',
        notes: randomBool(0.1) ? 'VIP Gast, altijd tafel bij raam.' : undefined
    });
  }
  customerRepo.saveAll(customers);
  await yieldToUI();

  // 3. GENERATE CALENDAR & RESERVATIONS
  if (onProgress) onProgress("Generating calendar events...", 20);
  const events: CalendarEvent[] = [];
  const reservations: Reservation[] = [];
  const waitlist: WaitlistEntry[] = [];
  
  const today = new Date();
  const startDate = addDays(today, -90);
  const endDate = addDays(today, 180);
  const totalDays = 270;

  let currentDate = startDate;
  let dayCount = 0;

  while (currentDate <= endDate) {
    dayCount++;
    const day = currentDate.getDay(); // 0-6
    const dateStr = currentDate.toISOString().split('T')[0];
    const isPast = currentDate < today;
    const isToday = dateStr === today.toISOString().split('T')[0];
    const isTomorrow = dateStr === addDays(today, 1).toISOString().split('T')[0];

    // Report progress periodically
    if (dayCount % 15 === 0) {
       const pct = 20 + Math.floor((dayCount / totalDays) * 60); // 20% to 80%
       if (onProgress) onProgress(`Scheduling: ${dateStr}`, pct);
       await yieldToUI();
    }

    // Schedule: Fri (Disco), Sat (Comedy), Sun (Brunch)
    let showDef: ShowDefinition | undefined;
    
    // FORCE SHOWS ON TODAY AND TOMORROW (Regardless of day of week)
    if (isToday) {
        showDef = SHOW_DEFS[0]; // Disco on Today
    } else if (isTomorrow) {
        showDef = SHOW_DEFS[2]; // Comedy on Tomorrow
    } else {
        // Normal Schedule
        if (day === 5) showDef = SHOW_DEFS[0]; // Fri
        if (day === 6) showDef = SHOW_DEFS[2]; // Sat
        if (day === 0) showDef = SHOW_DEFS[1]; // Sun
    }

    if (showDef) {
        const profile = showDef.profiles[0];
        
        // Event Object
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

        // Determine Occupancy
        let occupancy = 0;
        let targetOccupancy = 0;
        
        if (isToday) targetOccupancy = 180; // Busy today
        else if (isPast) targetOccupancy = randomInt(50, 230); // Random history
        else if (isTomorrow) targetOccupancy = 150; // Busy tomorrow
        else targetOccupancy = randomInt(0, 230); // Future scatter

        // Force some sold out in future
        if (!isPast && !isToday && randomBool(0.1)) targetOccupancy = 230;

        // Generate Reservations for this event
        while (occupancy < targetOccupancy) {
            // Stop if we are about to overflow 230 hard limit
            if (occupancy >= 230) break;

            const customer = randomItem(customers);
            // Party size: mostly 2 or 4, occasionally larger
            const partySize = randomBool(0.6) ? 2 : (randomBool(0.7) ? 4 : randomInt(3, 8));
            
            // Check if this reservation fits
            if (occupancy + partySize > 230) break;

            const isPremium = randomBool(0.3);
            
            // Status Logic
            let status = BookingStatus.CONFIRMED;
            if (isPast) {
                status = randomBool(0.95) ? BookingStatus.CONFIRMED : BookingStatus.NOSHOW;
            } else if (isToday) {
                // Today: mix of Arrived and Confirmed
                status = randomBool(0.4) ? BookingStatus.ARRIVED : BookingStatus.CONFIRMED;
            } else {
                // Future
                status = randomBool(0.7) ? BookingStatus.CONFIRMED : (randomBool(0.5) ? BookingStatus.OPTION : BookingStatus.REQUEST);
            }

            const unitPrice = isPremium ? profile.pricing.premium : profile.pricing.standard;
            let total = partySize * unitPrice;
            const items: LineItem[] = [{ id: 'ticket', label: 'Ticket', quantity: partySize, unitPrice, total, category: 'TICKET' }];

            // Extras (20% chance)
            const addons = [];
            const merch = [];
            if (randomBool(0.2)) {
                const drink = MOCK_ADDONS[0]; // Pre-drinks
                addons.push({ id: drink.id, quantity: partySize });
                total += (partySize * drink.price);
                items.push({ id: drink.id, label: drink.name, quantity: partySize, unitPrice: drink.price, total: partySize * drink.price, category: 'ADDON' });
            }
            
            // Dietary (15% chance)
            const notes = { dietary: '', structuredDietary: {} as any, isCelebrating: false, celebrationText: '', internal: '' };
            if (randomBool(0.15)) {
                const diet = randomItem(DIETARY_OPTS);
                notes.structuredDietary[diet] = randomInt(1, partySize);
                notes.dietary = `${notes.structuredDietary[diet]}x ${diet}`;
            }
            if (randomBool(0.05)) {
                notes.isCelebrating = true;
                notes.celebrationText = 'Verjaardag';
            }

            const res: Reservation = {
                id: `RES-${Date.now()}-${randomInt(10000, 99999)}`,
                createdAt: new Date().toISOString(),
                customerId: customer.id,
                customer: { ...customer }, // Snapshot
                date: dateStr,
                showId: showDef.id,
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
                    paid: (status === 'CONFIRMED' || status === 'ARRIVED') ? total : 0,
                    isPaid: (status === 'CONFIRMED' || status === 'ARRIVED'),
                    priceBreakdown: items,
                    paymentDueAt: status === 'CONFIRMED' ? undefined : addDays(new Date(), 7).toISOString()
                },
                notes,
                startTime: event.times.start
            };

            // Host view specifics for today
            if (isToday) {
               (res as any).tableNumber = randomInt(1, 50);
            }

            reservations.push(res);
            occupancy += partySize;
        }

        // Close event if full
        event.bookedCount = occupancy;
        
        if (occupancy >= 230) {
            (event as any).status = 'CLOSED';
            
            // Waitlist generation for future full events
            if (!isPast) {
                for(let w=0; w < randomInt(3, 8); w++) {
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
        } else if (occupancy >= 200) {
            (event as any).status = 'WAITLIST';
        }

        events.push(event);
    }
    currentDate = addDays(currentDate, 1);
  }

  calendarRepo.saveAll(events);
  bookingRepo.saveAll(reservations);
  waitlistRepo.saveAll(waitlist);
  
  await yieldToUI();

  // 4. GENERATE VOUCHERS
  if (onProgress) onProgress("Creating vouchers...", 90);
  const vouchers: Voucher[] = [];
  const orders: VoucherOrder[] = [];
  
  for(let i=0; i<30; i++) {
      const cust = randomItem(customers);
      const amount = randomItem([50, 75, 100, 150]);
      const isActive = i < 10; // 10 Active
      const isUsed = i >= 10 && i < 20; // 10 Used
      // Rest expired/inactive implicitly
      
      const code = `VOUCH-${randomInt(1000,9999)}-${randomItem(['X','Y','Z'])}`;
      
      vouchers.push({
          code,
          originalBalance: amount,
          currentBalance: isActive ? amount : 0,
          isActive: isActive,
          issuedTo: `${cust.firstName} ${cust.lastName}`,
          createdAt: addDays(new Date(), -randomInt(10, 100)).toISOString()
      });

      if (i < 20) {
          orders.push({
              id: `ORD-${randomInt(10000, 99999)}`,
              createdAt: addDays(new Date(), -randomInt(1, 60)).toISOString(),
              status: 'PAID',
              buyer: { firstName: cust.firstName, lastName: cust.lastName },
              items: [{ id: 'custom', label: 'Cadeaubon', price: amount, quantity: 1 }],
              amount,
              totals: { subtotal: amount, shipping: 0, fee: 0, grandTotal: amount },
              deliveryMethod: 'DIGITAL',
              recipient: { name: 'Vriend' },
              issuanceMode: 'INDIVIDUAL',
              customerEmail: cust.email
          });
      }
  }
  voucherRepo.saveAll(vouchers);
  voucherOrderRepo.saveAll(orders);
  await yieldToUI();

  // 5. GENERATE TASKS & NOTIFICATIONS
  if (onProgress) onProgress("Finalizing notifications...", 95);
  const tasks: Task[] = [];
  const notifs: AdminNotification[] = [];

  // Create some tasks
  tasks.push({
      id: `TASK-1`, type: 'CALL_OPTION_EXPIRING', title: 'Bel optie Jansen', notes: 'Optie verloopt morgen', 
      dueAt: new Date().toISOString(), status: 'OPEN', entityType: 'RESERVATION', entityId: 'RES-MOCK', createdAt: new Date().toISOString()
  });
  tasks.push({
      id: `TASK-2`, type: 'SEND_PAYMENT_REMINDER', title: 'Betaling Bakker', notes: 'Nog €150 open', 
      dueAt: new Date().toISOString(), status: 'OPEN', entityType: 'RESERVATION', entityId: 'RES-MOCK-2', createdAt: new Date().toISOString()
  });

  tasksRepo.saveAll(tasks);

  // Create notifications
  notifs.push({
      id: 'NOTIF-1', type: 'NEW_BOOKING', title: 'Nieuwe Boeking', message: 'Jan de Vries (4p) voor zaterdag.', 
      link: '/admin/reservations', entityType: 'RESERVATION', entityId: 'x', severity: 'INFO', createdAt: new Date().toISOString()
  });
  notifs.push({
      id: 'NOTIF-2', type: 'PAYMENT_OVERDUE', title: 'Betaling Te Laat', message: 'Reservering Pieters is verlopen.', 
      link: '/admin/reservations', entityType: 'RESERVATION', entityId: 'y', severity: 'URGENT', createdAt: new Date().toISOString()
  });

  notificationsRepo.saveAll(notifs);

  if (onProgress) onProgress("Done!", 100);
  await yieldToUI();
  
  console.log(`✅ Universe Generated: ${events.length} Events, ${reservations.length} Reservations, ${customers.length} Customers.`);
};
