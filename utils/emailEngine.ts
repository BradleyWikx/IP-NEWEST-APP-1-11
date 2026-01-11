
import { 
  EmailTemplate, EmailLog, EmailTemplateKey, EmailCategory, 
  Reservation, VoucherOrder, WaitlistEntry, ShowDefinition, EventDate
} from '../types';
import { emailTemplateRepo, emailLogRepo, showRepo, calendarRepo } from './storage';
import { logAuditAction } from './auditLogger';

// --- Rendering Logic ---

export const renderTemplate = (
  template: EmailTemplate, 
  data: Record<string, any>
): { subject: string; bodyHtml: string; bodyText: string } => {
  let subject = template.subject;
  let bodyHtml = template.bodyHtml;
  let bodyText = template.bodyText;

  // Simple interpolation {{key}}
  Object.keys(data).forEach(key => {
    const val = data[key] !== undefined && data[key] !== null ? String(data[key]) : '';
    const regex = new RegExp(`{{${key}}}`, 'g');
    
    subject = subject.replace(regex, val);
    bodyHtml = bodyHtml.replace(regex, val);
    bodyText = bodyText.replace(regex, val);
  });

  return { subject, bodyHtml, bodyText };
};

// --- Context Building Helpers ---

const getBookingContext = (booking: Reservation) => {
  const events = calendarRepo.getLegacyEvents();
  const shows = showRepo.getAll();
  const event = events.find(e => e.date === booking.date);
  const show = shows.find(s => s.id === booking.showId);

  return {
    firstName: booking.customer.firstName,
    lastName: booking.customer.lastName,
    fullName: `${booking.customer.firstName} ${booking.customer.lastName}`,
    reservationId: booking.id,
    reservationNumber: booking.id, // Alias
    partySize: booking.partySize,
    showName: show?.name || 'Inspiration Point Show',
    showDate: new Date(booking.date).toLocaleDateString('nl-NL'),
    showDateLong: new Date(booking.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    showTime: event?.startTime || '19:30',
    doorTime: event?.doorTime || '18:30',
    amountDue: (booking.financials.finalTotal || 0).toFixed(2),
    totalAmount: (booking.financials.total || 0).toFixed(2),
    packageName: booking.packageType === 'premium' ? 'Premium' : 'Standard',
    status: booking.status,
    optionExpiry: booking.optionExpiresAt ? new Date(booking.optionExpiresAt).toLocaleDateString() : 'N/A'
  };
};

const getWaitlistContext = (entry: WaitlistEntry) => {
  return {
    firstName: entry.contactName.split(' ')[0],
    fullName: entry.contactName,
    waitlistId: entry.id,
    date: new Date(entry.date).toLocaleDateString('nl-NL'),
    partySize: entry.partySize
  };
};

const getVoucherOrderContext = (order: VoucherOrder) => {
  return {
    orderId: order.id,
    firstName: order.buyer.firstName,
    lastName: order.buyer.lastName,
    fullName: `${order.buyer.firstName} ${order.buyer.lastName}`,
    totalAmount: order.totals.grandTotal.toFixed(2),
    itemCount: order.items.reduce((s,i) => s + i.quantity, 0),
    deliveryMethod: order.deliveryMethod,
    recipientName: order.recipient.name
  };
};

// --- Public API ---

/**
 * Creates an EmailLog entry based on a trigger.
 * Does NOT send immediately unless configured, but for this mock we just create the log.
 * The Admin UI or a background job would handle 'sending'.
 */
export const triggerEmail = (
  key: EmailTemplateKey, 
  entity: { type: 'RESERVATION' | 'VOUCHER_ORDER' | 'WAITLIST' | 'CUSTOMER', id: string, data: any },
  extraContext: Record<string, any> = {}
): EmailLog | null => {
  const template = emailTemplateRepo.getAll().find(t => t.key === key);
  
  if (!template) {
    console.warn(`[EmailEngine] Template not found: ${key}`);
    return null;
  }

  if (!template.enabled) {
    console.log(`[EmailEngine] Template disabled: ${key}`);
    return null;
  }

  let context: Record<string, any> = {};
  let toEmail = '';

  // Hydrate Context
  if (entity.type === 'RESERVATION') {
    const r = entity.data as Reservation;
    context = getBookingContext(r);
    toEmail = r.customer.email;
  } else if (entity.type === 'WAITLIST') {
    const w = entity.data as WaitlistEntry;
    context = getWaitlistContext(w);
    toEmail = w.contactEmail;
  } else if (entity.type === 'VOUCHER_ORDER') {
    const v = entity.data as VoucherOrder;
    context = getVoucherOrderContext(v);
    toEmail = v.buyer.email;
  }

  // Merge extra context (e.g. voucher codes)
  context = { ...context, ...extraContext };

  const rendered = renderTemplate(template, context);

  const log: EmailLog = {
    id: `MAIL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    templateKey: key,
    entityType: entity.type,
    entityId: entity.id,
    to: toEmail,
    subject: rendered.subject,
    bodyHtml: rendered.bodyHtml,
    bodyText: rendered.bodyText,
    status: 'QUEUED',
    createdAt: new Date().toISOString()
  };

  emailLogRepo.add(log);
  console.log(`[EmailEngine] Created log ${log.id} for ${toEmail} (${key})`);
  return log;
};

/**
 * Simulates sending an email by updating the log status.
 */
export const simulateSendEmail = (logId: string) => {
  const log = emailLogRepo.getById(logId);
  if (!log) return;

  // Simulate network delay
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      emailLogRepo.update(logId, (prev) => ({
        ...prev,
        status: 'SENT',
        sentAt: new Date().toISOString()
      }));
      logAuditAction('SEND_EMAIL', 'SYSTEM', logId, { description: `Email sent to ${log.to}` });
      resolve();
    }, 800);
  });
};

/**
 * Get all emails for a specific entity ID
 */
export const getEmailsForEntity = (entityId: string): EmailLog[] => {
  return emailLogRepo.getAll()
    .filter(log => log.entityId === entityId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

/**
 * Helper to get variable suggestions for the UI
 */
export const getAvailableVariables = (category: EmailCategory): string[] => {
  const common = ['{{firstName}}', '{{lastName}}', '{{fullName}}'];
  
  switch(category) {
    case 'BOOKING':
      return [...common, '{{reservationNumber}}', '{{showName}}', '{{showDate}}', '{{showTime}}', '{{doorTime}}', '{{partySize}}', '{{packageName}}', '{{amountDue}}', '{{totalAmount}}', '{{optionExpiry}}'];
    case 'VOUCHER':
      return [...common, '{{orderId}}', '{{totalAmount}}', '{{itemCount}}', '{{deliveryMethod}}', '{{voucherCode}}', '{{voucherValue}}'];
    case 'WAITLIST':
      return [...common, '{{waitlistId}}', '{{date}}', '{{partySize}}'];
    default:
      return common;
  }
};
