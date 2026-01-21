
import { 
  EmailTemplate, EmailLog, EmailTemplateKey, EmailCategory, 
  Reservation, VoucherOrder, WaitlistEntry, ShowDefinition, ShowEvent, Invoice
} from '../types';
import { emailTemplateRepo, emailLogRepo, showRepo, getEvents } from './storage';
import { logAuditAction } from './auditLogger';
import { db } from './firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';

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
  const events = getEvents(); // Returns ShowEvent[]
  const shows = showRepo.getAll();
  const event = events.find(e => e.date === booking.date);
  const show = shows.find(s => s.id === booking.showId);

  return {
    salutation: booking.customer.salutation || 'Beste',
    firstName: booking.customer.firstName,
    lastName: booking.customer.lastName,
    fullName: `${booking.customer.firstName} ${booking.customer.lastName}`,
    reservationId: booking.id,
    reservationNumber: booking.id, // Alias
    partySize: booking.partySize,
    showName: show?.name || 'Inspiration Point Show',
    showDate: new Date(booking.date).toLocaleDateString('nl-NL'),
    showDateLong: new Date(booking.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    showTime: event?.times.start || '19:30',
    doorTime: event?.times.doorsOpen || '18:30',
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

const getInvoiceContext = (invoice: Invoice) => {
  return {
    invoiceId: invoice.id,
    amountDue: invoice.totals.totalIncl.toFixed(2),
    dueDate: new Date(invoice.dates.due).toLocaleDateString('nl-NL'),
    customerName: invoice.customerSnapshot.name,
    companyName: invoice.customerSnapshot.companyName || '',
    invoiceDate: new Date(invoice.dates.created).toLocaleDateString('nl-NL')
  };
};

// --- Public API ---

/**
 * Creates an EmailLog entry and queues it for sending.
 */
export const triggerEmail = (
  key: EmailTemplateKey, 
  entity: { type: 'RESERVATION' | 'VOUCHER_ORDER' | 'WAITLIST' | 'CUSTOMER' | 'INVOICE', id: string, data: any },
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
    toEmail = v.customerEmail || '';
  } else if (entity.type === 'INVOICE') {
    const inv = entity.data as Invoice;
    context = getInvoiceContext(inv);
    toEmail = inv.customerSnapshot.email;
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
  
  // Trigger processing immediately
  processEmailLog(log.id); 
  
  console.log(`[EmailEngine] Queued email ${log.id} for ${toEmail} (${key})`);
  return log;
};

/**
 * Handles the actual sending of the email.
 * - If Firebase DB is active: Writes to 'mail' collection for Extension.
 * - If Offline: Simulates network delay and random success/fail.
 */
export const processEmailLog = async (logId: string) => {
  const log = emailLogRepo.getById(logId);
  if (!log) return;

  // 1. ONLINE MODE: Firebase Trigger Email Extension
  if (db) {
    try {
      // Write to 'mail' collection (default for Trigger Email extension)
      await addDoc(collection(db, 'mail'), {
        to: [log.to],
        message: {
          subject: log.subject,
          html: log.bodyHtml,
          text: log.bodyText || log.bodyHtml.replace(/<[^>]*>?/gm, '') // Plaintext fallback
        },
        metadata: {
          logId: log.id,
          entityType: log.entityType,
          entityId: log.entityId
        }
      });

      // Optimistic update to SENT
      // Real implementation would list to snapshot changes on the mail doc for 'delivery' status
      emailLogRepo.update(logId, (prev) => ({
        ...prev,
        status: 'SENT',
        sentAt: new Date().toISOString(),
        error: undefined
      }));
      
      logAuditAction('SEND_EMAIL_SMTP', 'SYSTEM', logId, { description: `Handed off to Firebase Mailer: ${log.to}` });

    } catch (error: any) {
      console.error("Firestore Mail Handoff Failed", error);
      emailLogRepo.update(logId, (prev) => ({
        ...prev,
        status: 'FAILED',
        error: `Firestore Error: ${error.message}`
      }));
      logAuditAction('EMAIL_FAILED', 'SYSTEM', logId, { description: `Firestore write failed: ${error.message}` });
    }
    return;
  }

  // 2. OFFLINE / SIMULATION MODE
  // Simulate network delay
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      // SIMULATE FAILURE: 10% chance of failure in demo mode
      const shouldFail = Math.random() < 0.10; 

      if (shouldFail) {
        emailLogRepo.update(logId, (prev) => ({
          ...prev,
          status: 'FAILED',
          error: 'Simulated SMTP Timeout (Offline Mode)'
        }));
        logAuditAction('EMAIL_FAILED', 'SYSTEM', logId, { description: `Simulated delivery failed for ${log.to}` });
      } else {
        emailLogRepo.update(logId, (prev) => ({
          ...prev,
          status: 'SENT',
          sentAt: new Date().toISOString(),
          error: undefined // Clear previous errors if retrying
        }));
        logAuditAction('SEND_EMAIL', 'SYSTEM', logId, { description: `Simulated sent to ${log.to}` });
      }
      resolve();
    }, 800);
  });
};

/**
 * Alias for backward compatibility if needed, but we use processEmailLog now.
 */
export const simulateSendEmail = processEmailLog;

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
  const common = ['{{salutation}}', '{{firstName}}', '{{lastName}}', '{{fullName}}'];
  
  switch(category) {
    case 'BOOKING':
      return [...common, '{{reservationNumber}}', '{{showName}}', '{{showDate}}', '{{showTime}}', '{{doorTime}}', '{{partySize}}', '{{packageName}}', '{{amountDue}}', '{{totalAmount}}', '{{optionExpiry}}'];
    case 'VOUCHER':
      return [...common, '{{orderId}}', '{{totalAmount}}', '{{itemCount}}', '{{deliveryMethod}}', '{{voucherCode}}', '{{voucherValue}}'];
    case 'WAITLIST':
      return [...common, '{{waitlistId}}', '{{date}}', '{{partySize}}'];
    case 'INVOICE':
      return ['{{invoiceId}}', '{{amountDue}}', '{{dueDate}}', '{{customerName}}', '{{companyName}}', '{{invoiceDate}}'];
    default:
      return common;
  }
};
