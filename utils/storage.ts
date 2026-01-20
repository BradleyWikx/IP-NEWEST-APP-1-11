
import { 
  ShowDefinition, Reservation, Customer, 
  WaitlistEntry, Voucher, VoucherOrder, MerchandiseItem, 
  ChangeRequest, Subscriber, AuditLogEntry, VoucherSaleConfig,
  CalendarEvent, ShowEvent, EmailTemplate, EmailLog,
  AdminNotification, NotificationType, NotificationSeverity,
  Task, TaskType, TaskStatus, PromoCodeRule, AdminNote,
  BookingStatus, Invoice
} from '../types';
import { logAuditAction } from './auditLogger';

// --- Keys (LocalStorage) ---
export const KEYS = {
  SHOWS: 'grand_stage_shows',
  CALENDAR_EVENTS: 'grand_stage_events',
  RESERVATIONS: 'grand_stage_reservations',
  CUSTOMERS: 'grand_stage_customers',
  WAITLIST: 'grand_stage_waitlist',
  VOUCHERS: 'grand_stage_vouchers',
  VOUCHER_ORDERS: 'grand_stage_voucher_orders',
  MERCHANDISE: 'grand_stage_merchandise',
  REQUESTS: 'grand_stage_requests',
  SUBSCRIBERS: 'grand_stage_subscribers',
  AUDIT: 'grand_stage_audit_log',
  NOTIFICATIONS: 'grand_stage_notifications',
  TASKS: 'grand_stage_tasks',
  SETTINGS: 'grand_stage_settings', // Voucher config resides here too in local
  EMAIL_TEMPLATES: 'grand_stage_email_templates',
  EMAIL_LOGS: 'grand_stage_email_logs',
  PROMOS: 'grand_stage_promos', 
  ADMIN_NOTES: 'grand_stage_admin_notes',
  INVOICES: 'grand_stage_invoices' // NEW
};

// Helper to simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- LocalStorage Repository Class ---
class Repository<T extends { id?: string; code?: string } | any> {
  protected key: string;

  constructor(key: string) {
    this.key = key;
  }

  // --- Synchronous Methods (Legacy) ---
  getAll(includeArchived: boolean = false): T[] {
    try {
      const data = localStorage.getItem(this.key);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error(`Error reading ${this.key}`, e);
      return [];
    }
  }

  // Helper to get ID (handles 'code' vs 'id')
  protected getId(item: T): string {
    return (item as any).id || (item as any).code || '';
  }

  add(item: T): void {
    const items = this.getAll();
    items.push(item);
    this.saveAll(items);
  }

  update(id: string, updater: (item: T) => T): void {
    const items = this.getAll();
    const index = items.findIndex((i: any) => this.getId(i) === id);
    if (index !== -1) {
      items[index] = updater(items[index]);
      this.saveAll(items);
    }
  }

  getById(id: string): T | undefined {
    return this.getAll().find((i: any) => this.getId(i) === id);
  }
  
  delete(id: string): void {
    const items = this.getAll();
    const filtered = items.filter((i: any) => this.getId(i) !== id);
    this.saveAll(filtered);
  }

  saveAll(items: T[]): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(items));
      // Dispatch event to update React components
      window.dispatchEvent(new Event('storage-update'));
    } catch (e) {
      console.error(`Error saving ${this.key}`, e);
    }
  }

  // --- Async Methods (Optimized) ---
  // Delays removed for writes to prevent race conditions in this demo architecture

  async getAllAsync(includeArchived: boolean = false): Promise<T[]> {
    await delay(300 + Math.random() * 200); // Keep read delay for realism
    return this.getAll(includeArchived);
  }

  async getByIdAsync(id: string): Promise<T | undefined> {
    await delay(200);
    return this.getById(id);
  }

  async addAsync(item: T): Promise<void> {
    // No delay on write
    this.add(item);
  }

  async updateAsync(id: string, updater: (item: T) => T): Promise<void> {
    // No delay on write
    this.update(id, updater);
  }

  async deleteAsync(id: string): Promise<void> {
    // No delay on write
    this.delete(id);
  }
}

// --- Notifications Repository ---
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
    const all = this.getAll().map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() }));
    this.saveAll(all);
  }

  createFromEvent(type: NotificationType, entity: any, extraContext?: any) {
    let title = '', message = '', link = '', severity: NotificationSeverity = 'INFO';
    let entityType: AdminNotification['entityType'] = 'RESERVATION';
    
    // Simple mapping logic
    if (type === 'NEW_BOOKING') {
        title = 'Nieuwe Reservering';
        message = `${entity.customer?.firstName} ${entity.customer?.lastName} (${entity.partySize}p)`;
        link = '/admin/reservations';
        severity = 'INFO';
    } else if (type === 'NEW_WAITLIST') {
        title = 'Nieuwe Wachtlijst';
        message = `${entity.contactName} (${entity.partySize}p) voor ${new Date(entity.date).toLocaleDateString()}`;
        link = '/admin/waitlist';
        entityType = 'WAITLIST';
    } else if (type === 'NEW_CHANGE_REQUEST') {
        title = 'Wijzigingsverzoek';
        message = `${entity.customerName}: ${entity.message?.substring(0, 30)}...`;
        link = '/admin/inbox';
        entityType = 'CHANGE_REQUEST';
        severity = 'WARNING';
    } else if (type === 'NEW_VOUCHER_ORDER') {
        title = 'Voucher Bestelling';
        message = `Nieuwe bestelling van ${entity.buyer?.lastName}`;
        link = '/admin/vouchers';
        entityType = 'VOUCHER_ORDER';
    }

    const notification: AdminNotification = {
      id: `NOTIF-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      createdAt: new Date().toISOString(),
      type, title, message, link, entityType, entityId: (entity as any).id, severity
    };
    
    this.add(notification);
  }

  runComputedChecks() {
    // Local computed checks (e.g. expiry)
  }
}

export const notificationsRepo = new NotificationsRepository();

// --- Booking Repository (With Soft Delete) ---
class BookingRepository extends Repository<Reservation> {
  constructor() {
    super(KEYS.RESERVATIONS);
  }

  override getAll(includeArchived: boolean = false): Reservation[] {
    const all = super.getAll();
    // Filter out soft-deleted items unless specifically accessing trash via getTrash
    // But for general usage we hide them
    const active = all.filter(r => !r.deletedAt);
    
    if (includeArchived) return active;
    return active.filter(r => r.status !== BookingStatus.ARCHIVED);
  }

  // Override async method to respect soft-delete
  override async getAllAsync(includeArchived: boolean = false): Promise<Reservation[]> {
    await delay(400);
    return this.getAll(includeArchived);
  }

  getTrash(): Reservation[] {
    return super.getAll().filter(r => !!r.deletedAt);
  }

  override delete(id: string): void {
    // Soft delete
    this.update(id, r => ({ ...r, deletedAt: new Date().toISOString() }));
    logAuditAction('SOFT_DELETE', 'RESERVATION', id, { description: 'Moved to trash' });
  }

  async deleteAsync(id: string): Promise<void> {
    // No delay
    this.delete(id);
  }

  restore(id: string): void {
    this.update(id, r => ({ ...r, deletedAt: undefined }));
    logAuditAction('RESTORE', 'RESERVATION', id, { description: 'Restored from trash' });
  }

  hardDelete(id: string): void {
    super.delete(id); // Actual removal from LS
  }

  findByIdempotencyKey(key: string): Reservation | undefined {
    return super.getAll().find(r => r.idempotencyKey === key);
  }

  findRecentDuplicates(email: string, date: string, minutes: number = 30): Reservation | undefined {
    const now = new Date().getTime();
    const threshold = minutes * 60 * 1000;
    const normalizedEmail = email.trim().toLowerCase();
    
    return super.getAll().find(r => 
      r.status !== 'CANCELLED' && 
      r.customer.email.trim().toLowerCase() === normalizedEmail &&
      r.date === date &&
      (now - new Date(r.createdAt).getTime()) < threshold
    );
  }

  createRequest(reservation: Reservation): Reservation {
    if (reservation.idempotencyKey) {
      const existing = this.findByIdempotencyKey(reservation.idempotencyKey);
      if (existing) return existing;
    }
    this.add(reservation);
    return reservation;
  }
}

// --- Calendar Repository ---
class CalendarRepository extends Repository<CalendarEvent> {
  constructor() {
    super(KEYS.CALENDAR_EVENTS);
  }
}

// --- Settings Repository ---
class SettingsRepository {
  getVoucherSaleConfig(): VoucherSaleConfig {
    const saved = localStorage.getItem(KEYS.SETTINGS + '_voucher');
    if (saved) return JSON.parse(saved);
    // Default fallback
    return {
      isEnabled: true,
      products: [],
      freeAmount: { enabled: true, min: 50, max: 1000, step: 1 }, // UPDATED DEFAULT
      bundling: { allowCombinedIssuance: true },
      delivery: { pickup: { enabled: true }, shipping: { enabled: true, fee: 4.95 }, digitalFee: 2.50 }
    };
  }

  updateVoucherSaleConfig(config: VoucherSaleConfig): void {
    localStorage.setItem(KEYS.SETTINGS + '_voucher', JSON.stringify(config));
    window.dispatchEvent(new Event('storage-update'));
  }
}

// --- Tasks Repository ---
class TasksRepository extends Repository<Task> {
  constructor() {
    super(KEYS.TASKS);
  }
  markDone(id: string) {
    this.update(id, t => ({ ...t, status: 'DONE', completedAt: new Date().toISOString() }));
  }
  createAutoTask(task: Omit<Task, 'id' | 'createdAt' | 'status'>) {
    const exists = this.getAll().find(t => t.type === task.type && t.entityId === task.entityId && t.status === 'OPEN');
    if (exists) return;
    this.add({
      ...task,
      id: `TASK-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'OPEN'
    });
  }
  runComputedChecks() { /* ... */ }
}

// --- Instances ---
export const showRepo = new Repository<ShowDefinition>(KEYS.SHOWS);
export const calendarRepo = new CalendarRepository();
export const bookingRepo = new BookingRepository();
export const customerRepo = new Repository<Customer>(KEYS.CUSTOMERS);
export const waitlistRepo = new Repository<WaitlistEntry>(KEYS.WAITLIST);
export const voucherRepo = new Repository<Voucher>(KEYS.VOUCHERS);
export const voucherOrderRepo = new Repository<VoucherOrder>(KEYS.VOUCHER_ORDERS);
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
export const invoiceRepo = new Repository<Invoice>(KEYS.INVOICES); // NEW

// --- Exported Getters ---
export const getShowDefinitions = () => showRepo.getAll();
export const getCalendarEvents = () => calendarRepo.getAll();
export const getEvents = (): ShowEvent[] => calendarRepo.getAll().filter(e => e.type === 'SHOW') as ShowEvent[];
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
export const getInvoices = () => invoiceRepo.getAll(); // NEW
export const getShows = getShowDefinitions;

// --- Helpers ---
export const isSeeded = () => showRepo.getAll().length > 0;
export const setSeeded = (val: boolean) => {}; // No-op
export const clearAllData = async () => {
  localStorage.clear();
  window.dispatchEvent(new Event('storage-update'));
};

/**
 * Calculates the next sequential table number for a given date.
 * Strictly strictly incremental (Max existing + 1).
 */
export const getNextTableNumber = (date: string): number => {
    const all = bookingRepo.getAll();
    const forDate = all.filter(r => r.date === date && r.tableId && r.status !== 'CANCELLED');
    
    // Extract numbers from "TAB-1", "TAB-10" etc.
    const numbers = forDate.map(r => {
        if (!r.tableId) return 0;
        const num = parseInt(r.tableId.replace('TAB-', ''));
        return isNaN(num) ? 0 : num;
    });

    if (numbers.length === 0) return 1;
    return Math.max(...numbers) + 1;
};

// Legacy Load/Save wrappers to maintain compatibility
export const loadData = <T>(key: string, fallback: T): T => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch (e) {
    return fallback;
  }
};

export const saveData = <T>(key: string, data: T) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    window.dispatchEvent(new Event('storage-update'));
  } catch (e) {
    console.error('Save failed', e);
  }
};

export const STORAGE_KEYS = KEYS;
export const eventRepo = calendarRepo;
