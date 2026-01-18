
import { Invoice, InvoiceItem, Reservation, LineItem, VoucherOrder } from '../types';
import { invoiceRepo } from './storage';

// CONFIG: Split ratios for arrangements based on new rules
// Scenario B: Arrangement = 85% Low VAT (9%) + 15% High VAT (21%)
const ARRANGEMENT_SPLIT = {
  LOW_RATIO: 0.85,  // 85% van totaalprijs -> 9% BTW
  HIGH_RATIO: 0.15  // 15% van totaalprijs -> 21% BTW
};

/**
 * Generates a unique invoice number (e.g. 2024-0001)
 * Accepts an optional list of existing invoices to support batch generation without intermediate saves.
 */
export const generateInvoiceId = (existingInvoices?: Invoice[]): string => {
  const currentYear = new Date().getFullYear();
  const allInvoices = existingInvoices || invoiceRepo.getAll();
  
  // Filter invoices from this year
  const yearInvoices = allInvoices.filter(i => i.id.startsWith(currentYear.toString()));
  
  // Find max sequence
  let maxSeq = 0;
  yearInvoices.forEach(inv => {
    const parts = inv.id.split('-');
    if (parts.length >= 2) {
      const seq = parseInt(parts[1]);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  });

  const nextSeq = maxSeq + 1;
  return `${currentYear}-${nextSeq.toString().padStart(4, '0')}`;
};

/**
 * Calculates totals including detailed VAT breakdown by backing out VAT from inclusive prices.
 * Formula: VAT Amount = Total_Incl - (Total_Incl / (1 + Rate/100))
 */
export const calculateInvoiceTotals = (items: InvoiceItem[]) => {
  let subtotalExcl = 0;
  let vat9 = 0;
  let vat21 = 0;

  items.forEach(item => {
    // Terugrekenen vanuit inclusief prijs
    const vatMultiplier = 1 + (item.vatRate / 100);
    const netTotal = item.total / vatMultiplier; // Netto (Excl BTW)
    const vatAmount = item.total - netTotal;     // Het BTW bedrag

    subtotalExcl += netTotal;

    if (item.vatRate === 9) {
      vat9 += vatAmount;
    } else if (item.vatRate === 21) {
      vat21 += vatAmount;
    }
  });

  return {
    subtotalExcl,
    vat9,
    vat21,
    // Total inclusive should match the sum of item totals (rounding diffs handled by display formatters usually)
    totalIncl: subtotalExcl + vat9 + vat21 
  };
};

/**
 * Converts a Reservation Line Item into Invoice Items.
 * Handles the specific logic for Arrangements (Split) vs Merchandise (High VAT).
 */
export const convertToInvoiceItems = (lineItem: LineItem): InvoiceItem[] => {
  const items: InvoiceItem[] = [];
  
  // Scenario B: Arrangement (Ticket)
  if (lineItem.category === 'TICKET') {
    const total = lineItem.total;
    const unitPrice = lineItem.unitPrice;

    // 1. Splits de Totaal_Prijs_Inclusief
    const lowPartTotal = total * ARRANGEMENT_SPLIT.LOW_RATIO;   // 85%
    const highPartTotal = total * ARRANGEMENT_SPLIT.HIGH_RATIO; // 15%

    const lowPartUnit = unitPrice * ARRANGEMENT_SPLIT.LOW_RATIO;
    const highPartUnit = unitPrice * ARRANGEMENT_SPLIT.HIGH_RATIO;

    // Item 1: Deel_Laag (9% BTW)
    items.push({
      id: `INV-ITEM-${Date.now()}-1-${Math.random()}`,
      description: `${lineItem.label} (Diner & Show)`, // Naming for visual grouping
      quantity: lineItem.quantity,
      unitPrice: lowPartUnit,
      total: lowPartTotal,
      vatRate: 9, 
      category: 'ARRANGEMENT',
      originalReservationItemId: lineItem.id
    });

    // Item 2: Deel_Hoog (21% BTW)
    items.push({
      id: `INV-ITEM-${Date.now()}-2-${Math.random()}`,
      description: `${lineItem.label} (Drankencomponent)`, // Naming for visual grouping
      quantity: lineItem.quantity,
      unitPrice: highPartUnit,
      total: highPartTotal,
      vatRate: 21,
      category: 'DRINK',
      originalReservationItemId: lineItem.id
    });

  } 
  // Scenario A: Merchandise
  else if (lineItem.category === 'MERCH') {
    // 100% Hoog tarief (21%)
    items.push({
      id: `INV-ITEM-${Date.now()}-${Math.random()}`,
      description: lineItem.label,
      quantity: lineItem.quantity,
      unitPrice: lineItem.unitPrice,
      total: lineItem.total,
      vatRate: 21,
      category: 'MERCH',
      originalReservationItemId: lineItem.id
    });

  } 
  // Scenario C: Addons (Usually drinks) & Fees
  else if (lineItem.category === 'ADDON') {
    // Default to 21% for separate drink packages/addons
    items.push({
      id: `INV-ITEM-${Date.now()}-${Math.random()}`,
      description: lineItem.label,
      quantity: lineItem.quantity,
      unitPrice: lineItem.unitPrice,
      total: lineItem.total,
      vatRate: 21, 
      category: 'DRINK',
      originalReservationItemId: lineItem.id
    });

  } else {
    // Adjustments, Fees, Shipping - Default to 21%
    items.push({
      id: `INV-ITEM-${Date.now()}-${Math.random()}`,
      description: lineItem.label,
      quantity: lineItem.quantity,
      unitPrice: lineItem.unitPrice,
      total: lineItem.total,
      vatRate: 21,
      category: 'OTHER',
      originalReservationItemId: lineItem.id
    });
  }

  return items;
};

/**
 * Creates a draft invoice from a reservation
 */
export const createInvoiceFromReservation = (reservation: Reservation, contextList?: Invoice[]): Invoice => {
  const customer = reservation.customer;
  
  let breakdown = reservation.financials.priceBreakdown || [];
  
  if (breakdown.length === 0 && reservation.financials.finalTotal > 0) {
     breakdown = [{
        id: 'fallback-ticket',
        label: `Arrangement (${reservation.packageType}) - ${reservation.partySize}p`,
        quantity: 1, 
        unitPrice: reservation.financials.finalTotal,
        total: reservation.financials.finalTotal,
        category: 'TICKET' 
     }];
  }
  
  let allItems: InvoiceItem[] = [];
  breakdown.forEach(li => {
    allItems = [...allItems, ...convertToInvoiceItems(li)];
  });

  const totals = calculateInvoiceTotals(allItems);
  const now = new Date();
  const due = new Date();
  due.setDate(now.getDate() + 14);

  return {
    id: generateInvoiceId(contextList),
    reservationId: reservation.id,
    customerId: reservation.customerId,
    customerSnapshot: {
      name: `${customer.firstName} ${customer.lastName}`,
      companyName: customer.companyName,
      email: customer.email,
      address: `${customer.street} ${customer.houseNumber}`,
      zip: customer.zip || '',
      city: customer.city || '',
      vatNumber: customer.vatNumber
    },
    items: allItems,
    totals,
    status: 'DRAFT',
    dates: {
      created: now.toISOString(),
      due: due.toISOString()
    }
  };
};

/**
 * Creates an invoice from a Voucher Order
 */
export const createInvoiceFromVoucherOrder = (order: VoucherOrder): Invoice => {
  const now = new Date();
  const due = new Date();
  due.setDate(now.getDate() + 14);

  const items: InvoiceItem[] = [];

  // Vouchers usually 0% VAT (Multi-purpose voucher) in NL until redemption.
  // If single purpose, it follows the product rules. Assuming Multi-purpose (0%) for generic gift cards.
  order.items.forEach(item => {
    items.push({
        id: `INV-VOUCH-${item.id}-${Math.random()}`,
        description: `Voucher: ${item.label}`,
        quantity: item.quantity,
        unitPrice: item.price,
        total: item.price * item.quantity,
        vatRate: 0, 
        category: 'OTHER'
    });
  });

  // Shipping fees -> 21% VAT
  if (order.totals.shipping > 0) {
      items.push({
          id: `INV-SHIP-${order.id}`,
          description: 'Verzendkosten',
          quantity: 1,
          unitPrice: order.totals.shipping,
          total: order.totals.shipping,
          vatRate: 21,
          category: 'OTHER'
      });
  }

  // Fees -> 21% VAT
  if (order.totals.fee > 0) {
      items.push({
          id: `INV-FEE-${order.id}`,
          description: 'Administratiekosten',
          quantity: 1,
          unitPrice: order.totals.fee,
          total: order.totals.fee,
          vatRate: 21,
          category: 'OTHER'
      });
  }

  const totals = calculateInvoiceTotals(items);

  return {
    id: generateInvoiceId(),
    customerId: order.id,
    customerSnapshot: {
        name: `${order.buyer.firstName} ${order.buyer.lastName}`,
        email: order.customerEmail || '',
        address: order.recipient.address ? `${order.recipient.address.street}, ${order.recipient.address.city}` : 'Digitaal',
        zip: order.recipient.address?.zip || '',
        city: order.recipient.address?.city || '',
        companyName: ''
    },
    items,
    totals,
    status: 'DRAFT',
    dates: {
        created: now.toISOString(),
        due: due.toISOString()
    }
  };
};

/**
 * Creates an empty manual invoice
 */
export const createManualInvoice = (): Invoice => {
    const now = new Date();
    const due = new Date();
    due.setDate(now.getDate() + 14);

    return {
        id: generateInvoiceId(),
        customerId: `MANUAL-${Date.now()}`,
        customerSnapshot: {
            name: 'Nieuwe Klant',
            email: '',
            address: '',
            zip: '',
            city: ''
        },
        items: [],
        totals: { subtotalExcl: 0, vat9: 0, vat21: 0, totalIncl: 0 },
        status: 'DRAFT',
        dates: {
            created: now.toISOString(),
            due: due.toISOString()
        }
    };
};
