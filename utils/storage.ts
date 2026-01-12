
import { 
  ShowDefinition, EventDate, Reservation, Customer, 
  WaitlistEntry, Voucher, VoucherOrder, MerchandiseItem, 
  ChangeRequest, Subscriber, AuditLogEntry, VoucherSaleConfig,
  CalendarEvent, ShowEvent, EmailTemplate, EmailLog,
  AdminNotification, NotificationType, NotificationSeverity,
  Task, TaskType, TaskStatus, PromoCodeRule, AdminNote,
  BookingStatus
} from '../types';
import { logAuditAction } from './auditLogger';

// --- Keys ---
export const KEYS = {
  SHOWS: 'grand_stage_shows_definitions',
  EVENTS_LEGACY: 'grand_stage_event_dates', // Deprecated but checked for migration
  CALENDAR_EVENTS: 'grand_stage_calendar_events_v2', // New Unified Store
  RESERVATIONS: 'grand_stage_reservations',
  CUSTOMERS: 'grand_stage_customers',
  WAITLIST: 'grand_stage_waitlist',
  VOUCHERS: 'grand_stage_vouchers',
  VOUCHER_ORDERS: 'grand_stage_voucher_orders',
  MERCHANDISE: 'grand_stage_merch_catalog',
  REQUESTS: 'grand_stage_change_requests',
  SUBSCRIBERS: 'grand_stage_subscribers',
  AUDIT: 'grand_stage_audit_log',
  NOTIFICATIONS: 'grand_stage_admin_notifications',
  TASKS: 'grand_stage_admin_tasks',
  SETTINGS: 'grand_stage_global_settings',
  VOUCHER_CONFIG: 'grand_stage_voucher_sales_config',
  EMAIL_TEMPLATES: 'grand_stage_email_templates_v2',
  EMAIL_LOGS: 'grand_stage_email_logs_v2',
  PROMOS: 'grand_stage_promo_rules', 
  ADMIN_NOTES: 'grand_stage_admin_notes', // New
  META: 'grand_stage_meta'
};

// ... existing Repository class ...
class Repository<T extends { id?: string } | any> {
  constructor(protected key: string) {}

  getAll(): T[] {
    if (typeof window === 'undefined') return [];
    try {
      const item = localStorage.getItem(this.key);
      return item ? JSON.parse(item) : [];
    } catch (e) {
      console.error(`Error reading ${this.key}`, e);
      return [];
    }
  }

  saveAll(items: T[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.key, JSON.stringify(items));
      window.dispatchEvent(new Event('storage-update')); // Reactivity hook
    } catch (e) {
      console.error(`Error saving ${this.key}`, e);
    }
  }

  add(item: T): void {
    const items = this.getAll();
    this.saveAll([...items, item]);
  }

  update(id: string, updater: (item: T) => T): void {
    const items = this.getAll();
    const updated = items.map((i: any) => i.id === id || i.code === id ? updater(i) : i);
    this.saveAll(updated);
  }

  getById(id: string): T | undefined {
    return this.getAll().find((i: any) => i.id === id || i.code === id);
  }
  
  delete(id: string): void {
    const items = this.getAll();
    this.saveAll(items.filter((i: any) => i.id !== id && i.code !== id));
  }
}

// --- Notifications Repository (Defined early for use in others) ---
class NotificationsRepository extends Repository<AdminNotification> {
  constructor() {
    super(KEYS.NOTIFICATIONS);
  }

  getUnreadCount(): number {
    return this.getAll().filter(n => !n.readAt).length;
  }

  markRead(id: string) {
    this.update(id, n => ({ ...n, readAt: new Date().toISOString() }));
  }

  markAllRead() {
    const all = this.getAll();
    const updated = all.map(n => n.readAt ? n : ({ ...n, readAt: new Date().toISOString() }));
    this.saveAll(updated);
  }

  create(partial: Omit<AdminNotification, 'id' | 'createdAt'>) {
    const all = this.getAll();
    
    // Dedupe: Check if similar notification exists created in last 10 minutes
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).getTime();
    const duplicate = all.find(n => 
      n.entityType === partial.entityType && 
      n.entityId === partial.entityId && 
      n.type === partial.type &&
      new Date(n.createdAt).getTime() > tenMinsAgo
    );

    if (duplicate) return;

    const notification: AdminNotification = {
      id: `NOTIF-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      createdAt: new Date().toISOString(),
      ...partial
    };

    // Add to start
    this.saveAll([notification, ...all].slice(0, 200)); // Keep last 200
  }

  createFromEvent(
    type: NotificationType, 
    entity: any, 
    extraContext?: any
  ) {
    let title = '';
    let message = '';
    let link = '';
    let severity: NotificationSeverity = 'INFO';
    let entityType: AdminNotification['entityType'] = 'RESERVATION';
    let entityId = entity.id;

    switch (type) {
      case 'NEW_BOOKING':
        entityType = 'RESERVATION';
        title = 'Nieuwe Reservering';
        message = `${entity.customer.firstName} ${entity.customer.lastName} (${entity.partySize}p) voor ${new Date(entity.date).toLocaleDateString()}.`;
        link = '/admin/reservations';
        severity = 'INFO';
        break;
      case 'NEW_CHANGE_REQUEST':
        entityType = 'CHANGE_REQUEST';
        entityId = entity.id;
        title = 'Wijzigingsverzoek';
        message = `${entity.customerName} wil een wijziging doorgeven.`;
        link = '/admin/inbox';
        severity = 'WARNING';
        break;
      case 'NEW_WAITLIST':
        entityType = 'WAITLIST';
        title = 'Wachtlijst Inschrijving';
        message = `${entity.contactName} (${entity.partySize}p) voor ${new Date(entity.date).toLocaleDateString()}.`;
        link = '/admin/waitlist';
        break;
      case 'NEW_VOUCHER_ORDER':
        entityType = 'VOUCHER_ORDER';
        title = 'Theaterbon Bestelling';
        message = `Nieuwe bestelling van ${entity.buyer.lastName} (€${entity.amount}).`;
        link = '/admin/vouchers';
        break;
      case 'OPTION_EXPIRING':
        entityType = 'RESERVATION';
        title = 'Optie Verloopt Bijna';
        message = `Optie van ${entity.customer.lastName} verloopt binnenkort.`;
        link = '/admin/reservations';
        severity = 'WARNING';
        break;
      case 'PAYMENT_OVERDUE':
        entityType = 'RESERVATION';
        title = 'Betaling Te Laat';
        message = `Betaling voor ${entity.customer.lastName} (${entity.id}) is te laat.`;
        link = '/admin/reservations';
        severity = 'URGENT';
        break;
    }

    this.create({ type, title, message, link, entityType, entityId, severity });
  }

  runComputedChecks() {
    const reservations = bookingRepo.getAll();
    const now = new Date();
    
    reservations.forEach(res => {
      // 1. Check Overdue
      if (res.status !== 'CANCELLED' && res.status !== 'ARCHIVED' && res.status !== 'INVITED') {
        const { isPaid, paymentDueAt } = res.financials;
        if (!isPaid && paymentDueAt) {
          const due = new Date(paymentDueAt);
          if (due < now) {
            this.createFromEvent('PAYMENT_OVERDUE', res);
          }
        }
      }

      // 2. Check Option Expiry (within 48 hours)
      if (res.status === 'OPTION' && res.optionExpiresAt) {
        const expires = new Date(res.optionExpiresAt);
        const diffHours = (expires.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (diffHours > 0 && diffHours < 48) {
          this.createFromEvent('OPTION_EXPIRING', res);
        }
      }
    });
  }
}

export const notificationsRepo = new NotificationsRepository();

// ... existing BookingRepository ...
class BookingRepository extends Repository<Reservation> {
  constructor() {
    super(KEYS.RESERVATIONS);
    this.archivePastReservations();
  }

  // Override ADD to trigger notification automatically
  add(item: Reservation): void {
    super.add(item);
    // Auto-notify admins
    notificationsRepo.createFromEvent('NEW_BOOKING', item);
  }

  // "De Nachtwacht": Auto-archive old reservations
  private archivePastReservations() {
    const all = super.getAll();
    const today = new Date().toISOString().split('T')[0];
    let changed = false;

    const updated = all.map(r => {
      if (r.date < today && 
         (r.status === BookingStatus.CONFIRMED || r.status === BookingStatus.NOSHOW || r.status === BookingStatus.CANCELLED)
      ) {
        changed = true;
        return { ...r, status: BookingStatus.ARCHIVED };
      }
      return r;
    });

    if (changed) {
      console.log('🌙 De Nachtwacht: Cleaning up past reservations...');
      this.saveAll(updated);
    }
  }

  // OVERRIDE: Default excludes ARCHIVED for performance
  getAll(includeArchived: boolean = false): Reservation[] {
    const all = super.getAll();
    // 1. Filter out soft-deleted items (Trash)
    const active = all.filter(r => !r.deletedAt);
    
    // 2. Filter out ARCHIVED unless requested
    if (includeArchived) {
      return active;
    }
    return active.filter(r => r.status !== BookingStatus.ARCHIVED);
  }

  // NEW: Get soft deleted items
  getTrash(): Reservation[] {
    const all = super.getAll();
    return all.filter(r => !!r.deletedAt);
  }

  // OVERRIDE: Perform Soft Delete
  delete(id: string): void {
    const items = super.getAll();
    const updated = items.map(r => r.id === id ? { ...r, deletedAt: new Date().toISOString() } : r);
    this.saveAll(updated);
    
    logAuditAction('SOFT_DELETE', 'RESERVATION', id, { 
      description: 'Item moved to trash'
    });
  }

  // NEW: Restore from Trash
  restore(id: string): void {
    const items = super.getAll();
    const updated = items.map(r => r.id === id ? { ...r, deletedAt: undefined } : r);
    this.saveAll(updated);

    logAuditAction('RESTORE', 'RESERVATION', id, { 
      description: 'Item restored from trash'
    });
  }

  // NEW: Hard Delete
  hardDelete(id: string): void {
    const items = super.getAll();
    this.saveAll(items.filter((i: any) => i.id !== id));
    logAuditAction('HARD_DELETE', 'RESERVATION', id, { 
      description: 'Item permanently deleted'
    });
  }

  // NEW: Auto Cleanup ( > 30 days)
  runCleanup() {
    const all = super.getAll();
    const now = new Date();
    const threshold = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
    
    let deletedCount = 0;
    const kept = all.filter(r => {
      if (!r.deletedAt) return true;
      const deletedDate = new Date(r.deletedAt);
      if ((now.getTime() - deletedDate.getTime()) > threshold) {
        deletedCount++;
        return false; // Remove
      }
      return true; // Keep
    });

    if (deletedCount > 0) {
      console.log(`[Trash] Auto-cleaned ${deletedCount} items.`);
      this.saveAll(kept);
      logAuditAction('AUTO_CLEANUP', 'SYSTEM', 'TRASH', { description: `Removed ${deletedCount} old items from trash` });
    }
  }

  findByIdempotencyKey(key: string): Reservation | undefined {
    if (!key) return undefined;
    return this.getAll(true).find(r => r.idempotencyKey === key); // Check archives too for idempotency
  }

  findRecentDuplicates(email: string, date: string, minutes: number = 30): Reservation | undefined {
    const now = new Date().getTime();
    const threshold = minutes * 60 * 1000;
    const normalizedEmail = email.trim().toLowerCase();
    
    // Check all records including archived just in case
    return this.getAll(true).find(r => 
      r.status !== 'CANCELLED' && 
      r.customer.email.trim().toLowerCase() === normalizedEmail &&
      r.date === date &&
      (now - new Date(r.createdAt).getTime()) < threshold
    );
  }

  createRequest(reservation: Reservation): Reservation {
    if (reservation.idempotencyKey) {
      const existing = this.findByIdempotencyKey(reservation.idempotencyKey);
      if (existing) {
        console.log(`[BookingRepo] Idempotency hit: returning existing reservation ${existing.id}`);
        return existing;
      }
    }
    this.add(reservation);
    return reservation;
  }
}

// ... existing CalendarRepository ...
class CalendarRepository extends Repository<CalendarEvent> {
  constructor() {
    super(KEYS.CALENDAR_EVENTS);
    this.migrate();
  }

  migrate() {
    const legacyEvents = localStorage.getItem(KEYS.EVENTS_LEGACY);
    const newEvents = localStorage.getItem(KEYS.CALENDAR_EVENTS);

    if (legacyEvents && !newEvents) {
      console.log("Migrating legacy events to V2 Calendar...");
      try {
        const parsedLegacy: EventDate[] = JSON.parse(legacyEvents);
        const migrated: ShowEvent[] = parsedLegacy.map((e, idx) => ({
          id: `EVT-${e.date}`,
          date: e.date,
          type: 'SHOW',
          title: 'Migrated Show', 
          visibility: 'PUBLIC',
          times: {
            start: e.startTime || '19:30',
            doorsOpen: e.doorTime || '18:30',
            end: e.endTime || undefined
          },
          bookingEnabled: e.availability === 'OPEN' || e.availability === 'WAITLIST',
          showId: e.showId,
          profileId: e.profileId,
          status: e.availability,
          capacity: e.capacity,
          bookedCount: e.bookedCount,
          pricing: e.pricing
        }));
        
        this.saveAll(migrated);
        localStorage.removeItem(KEYS.EVENTS_LEGACY); 
      } catch (err) {
        console.error("Migration failed", err);
      }
    }
  }

  getLegacyEvents(): EventDate[] {
    const all = this.getAll();
    return all
      .filter(e => e.type === 'SHOW')
      .map(e => {
        const s = e as ShowEvent;
        return {
          date: s.date,
          showId: s.showId,
          profileId: s.profileId,
          availability: s.status,
          doorTime: s.times?.doorsOpen || '18:00',
          startTime: s.times?.start || '',
          endTime: s.times?.end,
          capacity: s.capacity,
          bookedCount: s.bookedCount,
          pricing: s.pricing,
          _rawEvent: s
        };
      });
  }
}

// ... existing SettingsRepository ...
class SettingsRepository {
  getVoucherSaleConfig(): VoucherSaleConfig {
    const defaults: VoucherSaleConfig = {
      isEnabled: true,
      products: [],
      freeAmount: { enabled: true, min: 10, max: 500, step: 5 },
      bundling: { allowCombinedIssuance: true },
      delivery: {
        pickup: { enabled: true },
        shipping: { enabled: true, fee: 4.95 },
        digitalFee: 2.50
      }
    };
    return loadData<VoucherSaleConfig>(KEYS.VOUCHER_CONFIG, defaults);
  }

  updateVoucherSaleConfig(config: VoucherSaleConfig): void {
    saveData(KEYS.VOUCHER_CONFIG, config);
  }
}

// --- Specialized Voucher Order Repository ---
class VoucherOrderRepository extends Repository<VoucherOrder> {
  constructor() {
    super(KEYS.VOUCHER_ORDERS);
  }

  add(item: VoucherOrder) {
    super.add(item);
    notificationsRepo.createFromEvent('NEW_VOUCHER_ORDER', item);
  }
}

// --- Tasks Repository ---
class TasksRepository extends Repository<Task> {
  constructor() {
    super(KEYS.TASKS);
  }

  findOpenTask(type: TaskType, entityId: string): Task | undefined {
    return this.getAll().find(t => t.type === type && t.entityId === entityId && t.status === 'OPEN');
  }

  createAutoTask(task: Omit<Task, 'id' | 'createdAt' | 'status'>) {
    // Deduplication: Don't create if an open task of same type exists for entity
    if (this.findOpenTask(task.type, task.entityId)) return;

    this.add({
      ...task,
      id: `TASK-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      createdAt: new Date().toISOString(),
      status: 'OPEN'
    });
  }

  markDone(id: string) {
    this.update(id, t => ({ ...t, status: 'DONE', completedAt: new Date().toISOString() }));
  }

  runComputedChecks() {
    // Generate tasks based on reservation state
    const reservations = bookingRepo.getAll();
    const now = new Date();

    reservations.forEach(r => {
      // 1. Payment Reminder Task
      if (r.status !== 'CANCELLED' && r.status !== 'ARCHIVED' && r.status !== 'INVITED' && !r.financials.isPaid && r.financials.paymentDueAt) {
        const due = new Date(r.financials.paymentDueAt);
        if (due < now) {
          this.createAutoTask({
            type: 'SEND_PAYMENT_REMINDER',
            title: `Betalingsherinnering: ${r.customer.lastName}`,
            notes: `Betaling (€${r.financials.finalTotal}) vervallen op ${due.toLocaleDateString()}.`,
            dueAt: new Date().toISOString(), // Action needed now
            entityType: 'RESERVATION',
            entityId: r.id
          });
        }
      }
    });
  }
}

// --- Instances ---
export const showRepo = new Repository<ShowDefinition>(KEYS.SHOWS);
export const calendarRepo = new CalendarRepository();
export const bookingRepo = new BookingRepository();
export const customerRepo = new Repository<Customer>(KEYS.CUSTOMERS);
export const waitlistRepo = new Repository<WaitlistEntry>(KEYS.WAITLIST);
export const voucherRepo = new Repository<Voucher>(KEYS.VOUCHERS);
export const voucherOrderRepo = new VoucherOrderRepository(); // Use new specialized class
export const merchRepo = new Repository<MerchandiseItem>(KEYS.MERCHANDISE);
export const requestRepo = new Repository<ChangeRequest>(KEYS.REQUESTS);
export const subscriberRepo = new Repository<Subscriber>(KEYS.SUBSCRIBERS);
export const auditRepo = new Repository<AuditLogEntry>(KEYS.AUDIT);
export const emailTemplateRepo = new Repository<EmailTemplate>(KEYS.EMAIL_TEMPLATES);
export const emailLogRepo = new Repository<EmailLog>(KEYS.EMAIL_LOGS);
export const promoRepo = new Repository<PromoCodeRule>(KEYS.PROMOS);
export const notesRepo = new Repository<AdminNote>(KEYS.ADMIN_NOTES);
export const tasksRepo = new TasksRepository();
export const settingsRepo = new SettingsRepository();

// --- Exported Getters ---
export const getShowDefinitions = () => showRepo.getAll();
export const getCalendarEvents = () => calendarRepo.getAll();
export const getEvents = () => calendarRepo.getLegacyEvents(); // Compatibility alias
export const getReservations = () => bookingRepo.getAll();
export const getCustomers = () => customerRepo.getAll();
export const getWaitlist = () => waitlistRepo.getAll();
export const getVouchers = () => voucherRepo.getAll();
export const getVoucherOrders = () => voucherOrderRepo.getAll();
export const getMerchandise = () => merchRepo.getAll();
export const getChangeRequests = () => requestRepo.getAll();
export const getSubscribers = () => subscriberRepo.getAll();
export const getAuditLogs = () => auditRepo.getAll();
export const getEmailTemplates = () => emailTemplateRepo.getAll();
export const getEmailLogs = () => emailLogRepo.getAll();
export const getPromoRules = () => promoRepo.getAll();
export const getNotifications = () => notificationsRepo.getAll();
export const getTasks = () => tasksRepo.getAll();
export const getNotes = () => notesRepo.getAll();

// Alias
export const getShows = getShowDefinitions;

// ... existing Seeding/Helpers ...
export const isSeeded = () => !!localStorage.getItem(KEYS.SHOWS);
export const setSeeded = (val: boolean) => { 
  if (val) localStorage.setItem('grand_stage_seeded', 'true');
  else localStorage.removeItem('grand_stage_seeded');
};
export const clearAllData = () => localStorage.clear();

export const loadData = <T>(key: string, fallback: T): T => {
  const item = localStorage.getItem(key);
  return item ? JSON.parse(item) : fallback;
};

export const saveData = <T>(key: string, data: T) => {
  localStorage.setItem(key, JSON.stringify(data));
  window.dispatchEvent(new Event('storage-update'));
};

export const STORAGE_KEYS = KEYS;
export const eventRepo = calendarRepo;
