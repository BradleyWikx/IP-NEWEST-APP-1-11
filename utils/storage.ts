
import { 
  ShowDefinition, Reservation, Customer, 
  WaitlistEntry, Voucher, VoucherOrder, MerchandiseItem, 
  ChangeRequest, Subscriber, AuditLogEntry, VoucherSaleConfig,
  CalendarEvent, ShowEvent, EmailTemplate, EmailLog,
  AdminNotification, NotificationType, NotificationSeverity,
  Task, Invoice, AdminNote, PromoCodeRule, BookingStatus
} from '../types';
import { db } from './firebaseConfig';
import { 
  collection, doc, setDoc, deleteDoc, updateDoc, 
  onSnapshot, query, Unsubscribe 
} from 'firebase/firestore';

// --- KEYS CONSTANTS (Defined Top-Level) ---
export const KEYS = {
  SHOWS: 'grand_stage_shows',
  EVENTS: 'grand_stage_events',
  RESERVATIONS: 'grand_stage_reservations',
  CUSTOMERS: 'grand_stage_customers',
  WAITLIST: 'grand_stage_waitlist',
  VOUCHERS: 'grand_stage_vouchers',
  VOUCHER_ORDERS: 'grand_stage_voucher_orders',
  MERCHANDISE: 'grand_stage_merchandise',
  REQUESTS: 'grand_stage_requests',
  SUBSCRIBERS: 'grand_stage_subscribers',
  AUDIT_LOGS: 'grand_stage_audit_log',
  EMAIL_TEMPLATES: 'grand_stage_email_templates',
  EMAIL_LOGS: 'grand_stage_email_logs',
  PROMOS: 'grand_stage_promos',
  NOTES: 'grand_stage_admin_notes',
  INVOICES: 'grand_stage_invoices',
  NOTIFICATIONS: 'grand_stage_notifications',
  TASKS: 'grand_stage_tasks'
};

export const STORAGE_KEYS = KEYS;

// --- FIRESTORE REPOSITORY WITH LOCAL FALLBACK ---
// This class mimics the old synchronous getAll() by keeping a live local cache.
// It syncs via Firestore listeners if available, otherwise falls back to LocalStorage.

class FirestoreRepository<T extends { id?: string; code?: string }> {
  private collectionName: string;
  private storageKey: string;
  private localCache: T[] = [];
  private unsubscribe: Unsubscribe | null = null;
  private useLocalStorage: boolean = false;

  constructor(collectionName: string, storageKey: string) {
    this.collectionName = collectionName;
    this.storageKey = storageKey;
    this.init();
  }

  private init() {
    if (db) {
      // FIREBASE MODE
      try {
        const q = query(collection(db, this.collectionName));
        this.unsubscribe = onSnapshot(q, (snapshot) => {
          const data: T[] = [];
          snapshot.forEach((doc) => {
            const docData = doc.data() as T;
            // @ts-ignore
            if (!docData.id && !docData.code) {
               // @ts-ignore
               docData.id = doc.id;
            }
            data.push(docData);
          });
          
          this.localCache = data;
          // Also sync to local storage as backup
          try { localStorage.setItem(this.storageKey, JSON.stringify(data)); } catch(e){}
          
          window.dispatchEvent(new Event('storage-update'));
        }, (error) => {
          console.error(`Error listening to ${this.collectionName}, falling back to local.`, error);
          this.useLocalStorage = true;
          this.loadFromLocal();
        });
      } catch (e) {
        console.error(`Failed to init repository for ${this.collectionName}`, e);
        this.useLocalStorage = true;
        this.loadFromLocal();
      }
    } else {
      // FALLBACK MODE (No DB)
      this.useLocalStorage = true;
      this.loadFromLocal();
    }
  }

  private loadFromLocal() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.localCache = JSON.parse(data);
        window.dispatchEvent(new Event('storage-update'));
      }
    } catch (e) {
      console.error("Local load failed", e);
    }
  }

  private saveToLocal() {
    if (this.useLocalStorage) {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.localCache));
        window.dispatchEvent(new Event('storage-update'));
      } catch (e) {
        console.error("Local save failed", e);
      }
    }
  }

  // --- READS ---

  getAll(includeArchived: boolean = false): T[] {
    return this.localCache;
  }

  async getAllAsync(includeArchived: boolean = false): Promise<T[]> {
    return this.localCache;
  }

  getById(id: string): T | undefined {
    return this.localCache.find((i: any) => (i.id === id || i.code === id));
  }

  // --- WRITES ---

  protected getId(item: T): string {
    return (item as any).id || (item as any).code || '';
  }

  async add(item: T): Promise<void> {
    const id = this.getId(item);
    if (!id) return;

    // Optimistic Update
    this.localCache.push(item);
    window.dispatchEvent(new Event('storage-update'));
    this.saveToLocal();

    if (db && !this.useLocalStorage) {
      try {
        await setDoc(doc(db, this.collectionName, id), item);
      } catch (e) {
        console.error(`Error adding to ${this.collectionName}`, e);
      }
    }
  }

  async update(id: string, updater: (item: T) => T): Promise<void> {
    const idx = this.localCache.findIndex((i: any) => (i.id === id || i.code === id));
    if (idx === -1) return;

    const currentItem = this.localCache[idx];
    const updatedItem = updater(currentItem);

    // Optimistic Update
    this.localCache[idx] = updatedItem;
    window.dispatchEvent(new Event('storage-update'));
    this.saveToLocal();

    if (db && !this.useLocalStorage) {
      try {
        await setDoc(doc(db, this.collectionName, id), updatedItem);
      } catch (e) {
        console.error(`Error updating ${this.collectionName}/${id}`, e);
      }
    }
  }

  async delete(id: string): Promise<void> {
    // Optimistic
    this.localCache = this.localCache.filter((i: any) => (i.id !== id && i.code !== id));
    window.dispatchEvent(new Event('storage-update'));
    this.saveToLocal();

    if (db && !this.useLocalStorage) {
      try {
        await deleteDoc(doc(db, this.collectionName, id));
      } catch (e) {
        console.error(`Error deleting ${this.collectionName}/${id}`, e);
      }
    }
  }

  saveAll(items: T[]) {
    // Bulk overwrite behavior
    if (this.useLocalStorage) {
        this.localCache = items;
        this.saveToLocal();
    } else {
        items.forEach(item => this.add(item));
    }
  }
}

// --- SPECIALIZED REPOSITORIES ---

class BookingFirestoreRepository extends FirestoreRepository<Reservation> {
  // Specific methods for reservations
  findByIdempotencyKey(key: string): Reservation | undefined {
    return this.getAll().find(r => r.idempotencyKey === key);
  }

  findRecentDuplicates(email: string, date: string, minutes: number = 30): Reservation | undefined {
    const now = new Date().getTime();
    const threshold = minutes * 60 * 1000;
    const normalizedEmail = email.trim().toLowerCase();
    
    return this.getAll().find(r => 
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

  getTrash(): Reservation[] {
    return this.getAll(true).filter(r => !!r.deletedAt);
  }

  restore(id: string): void {
    this.update(id, r => ({ ...r, deletedAt: undefined }));
  }

  hardDelete(id: string): void {
    this.delete(id);
  }
  
  // Override getAll to filter out soft-deleted items by default
  getAll(includeArchived: boolean = false): Reservation[] {
    const all = super.getAll();
    if (includeArchived) return all;
    return all.filter(r => !r.deletedAt);
  }
}

class NotificationsFirestoreRepository extends FirestoreRepository<AdminNotification> {
  getUnreadCount(): number {
    return this.getAll().filter(n => !n.readAt).length;
  }

  markRead(id: string) {
    this.update(id, n => ({ ...n, readAt: new Date().toISOString() }));
  }

  markAllRead() {
    this.getAll().forEach(n => {
        if(!n.readAt) this.markRead(n.id);
    });
  }

  runComputedChecks() {}

  createFromEvent(type: NotificationType, entity: any) {
    let title = '', message = '', link = '', severity: NotificationSeverity = 'INFO';
    let entityType: AdminNotification['entityType'] = 'RESERVATION';
    
    if (type === 'NEW_BOOKING') {
        title = 'Nieuwe Reservering';
        message = `${entity.customer?.firstName} ${entity.customer?.lastName} (${entity.partySize}p)`;
        link = '/admin/reservations';
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
}

class TasksFirestoreRepository extends FirestoreRepository<Task> {
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
  runComputedChecks() {}
}

class SettingsFirestoreRepository {
  private cache: VoucherSaleConfig | null = null;
  private key = 'grand_stage_settings_voucher';

  constructor() {
    if (db) {
        try {
            onSnapshot(doc(db, 'settings', 'voucher_config'), (doc) => {
                if (doc.exists()) {
                    this.cache = doc.data() as VoucherSaleConfig;
                    window.dispatchEvent(new Event('storage-update'));
                }
            }, (err) => console.warn('Settings sync error', err));
        } catch(e) { console.warn('Settings init error', e); }
    }
    
    // Load local backup
    try {
        const local = localStorage.getItem(this.key);
        if (local && !this.cache) this.cache = JSON.parse(local);
    } catch(e){}
  }

  getVoucherSaleConfig(): VoucherSaleConfig {
    if (this.cache) return this.cache;
    return {
      isEnabled: true,
      products: [],
      freeAmount: { enabled: true, min: 50, max: 1000, step: 1 }, 
      bundling: { allowCombinedIssuance: true },
      delivery: { pickup: { enabled: true }, shipping: { enabled: true, fee: 4.95 }, digitalFee: 2.50 }
    };
  }

  updateVoucherSaleConfig(config: VoucherSaleConfig): void {
    this.cache = config;
    localStorage.setItem(this.key, JSON.stringify(config)); // Local backup
    window.dispatchEvent(new Event('storage-update'));
    
    if (db) {
        setDoc(doc(db, 'settings', 'voucher_config'), config).catch(console.error);
    }
  }
}

// --- INSTANTIATE REPOSITORIES ---
// All data now lives in Firestore collections with LocalStorage fallback

export const showRepo = new FirestoreRepository<ShowDefinition>('shows', KEYS.SHOWS);
export const calendarRepo = new FirestoreRepository<CalendarEvent>('events', KEYS.EVENTS);
export const bookingRepo = new BookingFirestoreRepository('reservations', KEYS.RESERVATIONS);
export const customerRepo = new FirestoreRepository<Customer>('customers', KEYS.CUSTOMERS);
export const waitlistRepo = new FirestoreRepository<WaitlistEntry>('waitlist', KEYS.WAITLIST);
export const voucherRepo = new FirestoreRepository<Voucher>('vouchers', KEYS.VOUCHERS);
export const voucherOrderRepo = new FirestoreRepository<VoucherOrder>('voucher_orders', KEYS.VOUCHER_ORDERS);
export const merchRepo = new FirestoreRepository<MerchandiseItem>('merchandise', KEYS.MERCHANDISE);
export const requestRepo = new FirestoreRepository<ChangeRequest>('change_requests', KEYS.REQUESTS);
export const subscriberRepo = new FirestoreRepository<Subscriber>('subscribers', KEYS.SUBSCRIBERS);
export const auditRepo = new FirestoreRepository<AuditLogEntry>('audit_logs', KEYS.AUDIT_LOGS);
export const emailTemplateRepo = new FirestoreRepository<EmailTemplate>('email_templates', KEYS.EMAIL_TEMPLATES);
export const emailLogRepo = new FirestoreRepository<EmailLog>('email_logs', KEYS.EMAIL_LOGS);
export const promoRepo = new FirestoreRepository<PromoCodeRule>('promos', KEYS.PROMOS);
export const notesRepo = new FirestoreRepository<AdminNote>('admin_notes', KEYS.NOTES);
export const invoiceRepo = new FirestoreRepository<Invoice>('invoices', KEYS.INVOICES);

// Specialized
export const notificationsRepo = new NotificationsFirestoreRepository('notifications', KEYS.NOTIFICATIONS);
export const tasksRepo = new TasksFirestoreRepository('tasks', KEYS.TASKS);
export const settingsRepo = new SettingsFirestoreRepository();

// --- EXPORTED GETTERS (Compatibility Wrappers) ---
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
export const getInvoices = () => invoiceRepo.getAll(); 
export const getShows = getShowDefinitions;

// --- HELPERS ---

export const isSeeded = () => showRepo.getAll().length > 0;
export const setSeeded = (val: boolean) => {}; 

export const clearAllData = async () => {
  localStorage.clear();
  window.dispatchEvent(new Event('storage-update'));
};

export const getNextTableNumber = (date: string): number => {
    const all = bookingRepo.getAll();
    const forDate = all.filter(r => r.date === date && r.tableId && r.status !== 'CANCELLED');
    
    const numbers = forDate.map(r => {
        if (!r.tableId) return 0;
        const num = parseInt(r.tableId.replace('TAB-', ''));
        return isNaN(num) ? 0 : num;
    });

    if (numbers.length === 0) return 1;
    return Math.max(...numbers) + 1;
};

// UI State (Local Only)
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

export const eventRepo = calendarRepo;
