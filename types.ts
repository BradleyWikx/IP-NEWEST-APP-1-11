
export type AdminRole = 'ADMIN' | 'EDITOR' | 'HOST';

export enum BookingStatus {
  REQUEST = 'REQUEST',
  OPTION = 'OPTION',
  CONFIRMED = 'CONFIRMED',
  ARRIVED = 'ARRIVED', // NEW: Guest is physically in the building
  CANCELLED = 'CANCELLED',
  WAITLIST = 'WAITLIST',
  INVITED = 'INVITED',
  ARCHIVED = 'ARCHIVED',
  NOSHOW = 'NOSHOW'
}

export interface ShowType {
  id: string;
  name: string;
  color: string;
  basePrice: number;
  premiumPrice: number;
  startTime: string;
  description?: string;
}

export interface Addon {
  id: string;
  name: string;
  price: number;
  minGroupSize?: number;
  description?: string;
}

export interface MerchandiseItem {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  active: boolean;
  description?: string;
  image?: string;
}

export type Availability = 'OPEN' | 'CLOSED' | 'WAITLIST';

export interface ShowProfile {
  id: string;
  name: string;
  color: string;
  timing: {
    doorTime: string;
    startTime: string;
    endTime: string;
  };
  pricing: {
    standard: number;
    premium: number;
    addonPreDrink: number;
    addonAfterDrink: number;
    [key: string]: number;
  };
}

export interface ShowDefinition {
  id: string;
  name: string;
  description: string;
  posterImage?: string;
  activeFrom: string;
  activeTo: string;
  isActive: boolean;
  tags: string[];
  profiles: ShowProfile[];
}

export interface EventDate {
  date: string;
  showId: string;
  profileId?: string;
  availability: Availability;
  doorTime: string;
  startTime?: string;
  endTime?: string;
  capacity?: number;
  bookedCount?: number;
  pricing?: {
    standard?: number;
    premium?: number;
    addonPreDrink?: number;
    addonAfterDrink?: number;
  };
  _rawEvent?: any; // Helper for V2 compatibility
}

export interface AddonSelection {
  id: string;
  quantity: number;
}

export interface MerchandiseSelection {
  id: string;
  quantity: number;
}

export interface Address {
  street: string;
  houseNumber: string;
  zip: string; 
  city: string;
  country: string; // 'NL' | 'BE' | 'OTHER'
}

export interface Customer {
  id: string;
  salutation?: string; // NEW: Aanhef
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string; // Legacy string
  street?: string; 
  houseNumber?: string;
  zip?: string;
  city?: string;    
  country?: string; 
  companyName?: string;
  vatNumber?: string;
  billingAddress?: Address;
  billingInstructions?: string; 
  isBusiness?: boolean;
  notes?: string; // NEW: Internal CRM notes
  noShowCount?: number; // NEW: Risk tracking
}

export interface LineItem {
  id: string;
  label: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: 'TICKET' | 'ADDON' | 'MERCH' | 'FEE' | 'DISCOUNT' | 'ADJUSTMENT';
}

export interface ReservationFinancials {
  total: number;
  subtotal?: number;
  discount?: number;
  finalTotal: number;
  paid: number;
  isPaid: boolean;
  paymentDueAt?: string;
  paidAt?: string;
  paymentMethod?: string; // New field for Invoice, Ideal, Cash, etc.
  payOnNightAllowed?: boolean;
  voucherCode?: string;
  voucherUsed?: number;
  priceBreakdown?: LineItem[]; // NEW: Stored receipt lines
}

export interface ReservationNotes {
  dietary?: string; // Human readable summary
  structuredDietary?: Record<string, number>; // Specific counts e.g. { "Vegan": 2 }
  isCelebrating?: boolean;
  celebrationText?: string;
  internal?: string;
  comments?: string; // Extra user comments separate from dietary
}

export interface AdminPriceOverride {
  unitPrice?: number; // Replaces standard/premium profile price per person
  discount?: {
    type: 'FIXED' | 'PERCENT' | 'PER_PERSON';
    amount: number;
    label: string;
  };
  reason?: string;
  updatedAt?: string;
}

export interface Reservation {
  id: string;
  createdAt: string;
  customerId: string;
  customer: Customer;
  date: string;
  showId: string;
  status: BookingStatus;
  partySize: number;
  packageType: 'standard' | 'premium';
  addons: AddonSelection[];
  merchandise: MerchandiseSelection[];
  financials: ReservationFinancials;
  notes: ReservationNotes;
  idempotencyKey?: string;
  voucherCode?: string;
  optionExpiresAt?: string;
  startTime?: string;
  adminPriceOverride?: AdminPriceOverride;
  tags?: string[]; // NEW: Manual tags like "Mooie Plaatsen", "VIP"
  deletedAt?: string; // NEW: Soft delete timestamp
}

export interface WaitlistEntry {
  id: string;
  date: string;
  customerId: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  partySize: number;
  requestDate: string;
  status: 'PENDING' | 'CONVERTED' | 'ARCHIVED';
  notes?: string;
}

export interface Voucher {
  code: string;
  originalBalance: number;
  currentBalance: number;
  isActive: boolean;
  createdAt?: string;
  issuedTo?: string;
  orderId?: string;
  label?: string;
}

export interface VoucherOrderItem {
  id: string;
  label: string;
  price: number;
  quantity: number;
}

export interface VoucherOrder {
  id: string;
  createdAt: string;
  status: 'REQUESTED' | 'INVOICED' | 'PAID' | 'COMPLETED' | 'ARCHIVED';
  buyer: {
    firstName: string;
    lastName: string;
  };
  items: VoucherOrderItem[];
  amount: number;
  totals: {
    subtotal: number;
    shipping: number;
    fee: number;
    grandTotal: number;
  };
  deliveryMethod: 'DIGITAL' | 'PICKUP' | 'POST';
  recipient: {
    name: string;
    address?: {
      street: string;
      city: string;
      zip: string;
    };
  };
  issuanceMode: 'INDIVIDUAL' | 'COMBINED';
  customerName?: string;
  customerEmail?: string;
  generatedCodes?: string[];
}

export type ChangeRequestType = 'MODIFICATION' | 'CANCELLATION' | 'OPTION';

export interface ChangeRequest {
  id: string;
  reservationId: string;
  customerName: string;
  type: ChangeRequestType;
  status: 'NEW' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
  payload: any;
  message?: string;
  details?: { message?: string };
  adminNotes?: string;
  createdAt: string;
}

export interface Subscriber {
  id: string;
  name: string;
  email: string;
  preferences: string[];
  createdAt: string;
  status: 'PENDING' | 'SUBSCRIBED' | 'UNSUBSCRIBED';
}

export interface VoucherProductDef {
  id: string;
  label: string;
  description: string;
  price: number;
  active: boolean;
}

export interface VoucherSaleConfig {
  isEnabled: boolean;
  products: VoucherProductDef[];
  freeAmount: {
    enabled: boolean;
    min: number;
    max: number;
    step: number;
  };
  bundling: {
    allowCombinedIssuance: boolean;
  };
  delivery: {
    pickup: { enabled: boolean };
    shipping: { enabled: boolean; fee: number };
    digitalFee: number;
  };
}

export type EventType = 'SHOW' | 'REHEARSAL' | 'PRIVATE_EVENT' | 'BLACKOUT';

export interface BaseEvent {
  id: string;
  date: string;
  type: EventType;
  title: string;
  visibility: 'PUBLIC' | 'INTERNAL';
  bookingEnabled: boolean;
  times: {
    doorsOpen?: string;
    start: string;
    end?: string;
  };
  colorKey?: string;
}

export interface ShowEvent extends BaseEvent {
  type: 'SHOW';
  showId: string;
  profileId: string;
  status: Availability;
  capacity: number;
  bookedCount: number;
  pricing?: {
    standard?: number;
    premium?: number;
    addonPreDrink?: number;
    addonAfterDrink?: number;
  };
}

export interface PrivateEventPreferences {
  occasionType: 'COMPANY' | 'BIRTHDAY' | 'WEDDING' | 'OTHER';
  occasionDetails?: string;
  barType: 'STANDARD' | 'PREMIUM' | 'NON_ALCOHOLIC' | 'CASH' | 'NONE';
  barNotes?: string;
  dietary?: string;
  scheduleNotes?: string;
  setupNotes?: string;
  techConfig: {
    mic: boolean;
    music: boolean;
    lights: boolean;
    projector: boolean;
  };
  techNotes?: string;
  internalNotes?: string;
}

export interface PrivateEvent extends BaseEvent {
  type: 'PRIVATE_EVENT';
  companyName?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  pricingModel: 'FIXED_TOTAL' | 'PER_HEAD';
  financials: {
    expectedGuests: number;
    priceTotal?: number;
    invoiceStatus: 'DRAFT' | 'SENT' | 'PAID';
  };
  preferences: PrivateEventPreferences;
}

export interface RehearsalEvent extends BaseEvent {
  type: 'REHEARSAL';
  team: string[];
  location: string;
  notes?: string;
}

export interface BlackoutEvent extends BaseEvent {
  type: 'BLACKOUT';
  reason?: string;
}

export type CalendarEvent = ShowEvent | PrivateEvent | RehearsalEvent | BlackoutEvent;

export type EmailCategory = 'BOOKING' | 'VOUCHER' | 'WAITLIST' | 'SYSTEM';
export type EmailTemplateKey = 
  | 'BOOKING_REQUEST_RECEIVED' 
  | 'BOOKING_CONFIRMED' 
  | 'BOOKING_CANCELLED' 
  | 'BOOKING_PAYMENT_REMINDER'
  | 'BOOKING_CHANGE_REQUEST_RECEIVED'
  | 'BOOKING_CHANGE_APPROVED'
  | 'BOOKING_CHANGE_REJECTED'
  | 'BOOKING_OPTION_EXPIRING'
  | 'WAITLIST_JOINED'
  | 'WAITLIST_CONVERTED_TO_REQUEST'
  | 'VOUCHER_ORDER_REQUEST_RECEIVED'
  | 'VOUCHER_ORDER_INVOICED'
  | 'VOUCHER_ORDER_PAID_VOUCHER_CREATED'
  | 'VOUCHER_DELIVERY_DIGITAL'
  | 'VOUCHER_DELIVERY_PHYSICAL_PICKUP_READY'
  | 'VOUCHER_DELIVERY_PHYSICAL_SHIPPED';

export interface EmailTemplate {
  id: string;
  key: EmailTemplateKey;
  name: string;
  category: EmailCategory;
  enabled: boolean;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  updatedAt: string;
}

export interface EmailLog {
  id: string;
  templateKey: string;
  entityType: string;
  entityId: string;
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  createdAt: string;
  sentAt?: string;
  error?: string;
}

export type NotificationType = 
  | 'NEW_BOOKING' 
  | 'NEW_CHANGE_REQUEST' 
  | 'NEW_WAITLIST' 
  | 'NEW_VOUCHER_ORDER' 
  | 'OPTION_EXPIRING' 
  | 'PAYMENT_OVERDUE';

export type NotificationSeverity = 'INFO' | 'WARNING' | 'URGENT';

export interface AdminNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
  entityType: 'RESERVATION' | 'CHANGE_REQUEST' | 'WAITLIST' | 'VOUCHER_ORDER' | 'SYSTEM';
  entityId: string;
  severity: NotificationSeverity;
  createdAt: string;
  readAt?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: { name: string; role: string };
  action: string;
  entityType: string;
  entityId: string;
  changes?: { description?: string; before?: any; after?: any };
}

export type TaskType = 
  | 'CALL_OPTION_EXPIRING' 
  | 'SEND_PAYMENT_REMINDER' 
  | 'CONFIRM_WAITLIST' 
  | 'GENERAL_FOLLOW_UP' 
  | 'CHANGE_REQUEST_FOLLOW_UP';

export type TaskStatus = 'OPEN' | 'DONE' | 'SKIPPED';

export interface Task {
  id: string;
  type: TaskType;
  title: string;
  notes?: string;
  dueAt: string;
  status: TaskStatus;
  entityType: 'RESERVATION' | 'WAITLIST' | 'CUSTOMER' | 'SYSTEM' | 'CHANGE_REQUEST';
  entityId: string;
  createdAt: string;
  completedAt?: string;
  assignedTo?: string;
}

// --- UNDO SYSTEM ---
export interface UndoRecord {
  id: string;
  actionType: string;
  entityType: 'RESERVATION' | 'WAITLIST' | 'VOUCHER_ORDER' | 'VOUCHER' | 'CUSTOMER';
  entityId: string;
  beforeSnapshot: any;
  // If the action created new entities (e.g. converting waitlist creates reservation), track them here to delete on undo
  createdEntities?: { type: 'RESERVATION' | 'VOUCHER'; id: string }[];
  expiresAt: number;
}

// --- DISCOUNT & PROMO ENGINE TYPES ---

export enum DiscountKind {
  FIXED_PER_PERSON = 'FIXED_PER_PERSON', // e.g. €10 off per ticket
  PERCENTAGE = 'PERCENTAGE',             // e.g. 10% off total arrangement cost
  INVITED_COMP = 'INVITED_COMP',         // e.g. Free tickets (Specific count or all)
  FIXED_TOTAL = 'FIXED_TOTAL'            // e.g. €50 off the whole bill (Legacy support)
}

export enum PromoScope {
  ARRANGEMENT_ONLY = 'ARRANGEMENT_ONLY',
  ENTIRE_BOOKING = 'ENTIRE_BOOKING'
}

export interface InvitedConfig {
  freeArrangementsMode: 'ALL' | 'COUNT';
  freeCount?: number; // If mode is COUNT
  eligibleArrangement: 'STANDARD' | 'PREMIUM' | 'ANY';
}

export interface PromoConstraints {
  minPartySize?: number;
  maxPartySize?: number;
  validFrom?: string; // ISO Date
  validUntil?: string; // ISO Date
  eligibleShowIds?: string[];
  blackoutDates?: string[];
}

export interface PromoCodeRule {
  id: string;
  code: string;
  label: string;
  enabled: boolean;
  kind: DiscountKind;
  scope: PromoScope;
  
  // Values
  fixedAmountPerPerson?: number;
  percentage?: number; // 0-100
  fixedAmountTotal?: number;
  
  // Logic Configs
  invitedConfig?: InvitedConfig;
  
  // Rules
  constraints?: PromoConstraints;
  allowWithVoucher: boolean; // Can use voucher to pay remainder?
  allowStacking: boolean;    // Can use with other promos? (Default false)
}

// --- PRODUCTIVITY TOOLS ---
export interface AdminNote {
  id: string;
  text: string;
  authorRole: AdminRole;
  createdAt: string;
}
