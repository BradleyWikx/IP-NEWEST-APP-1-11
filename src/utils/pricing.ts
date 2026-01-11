
import { 
  EventDate, 
  ShowDefinition, 
  AddonSelection, 
  MerchandiseSelection,
  Reservation,
  ReservationFinancials
} from '../types';
import { 
  MOCK_ADDONS, 
  MOCK_MERCHANDISE, 
} from '../mock/data';
import { getVouchers, getEvents, getShowDefinitions } from './storage';
import { calculatePromoDiscount, PricingContext } from '../logic/discountEngine';

// --- Interfaces ---

export interface LineItem {
  id: string;
  label: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: 'TICKET' | 'ADDON' | 'MERCH' | 'FEE' | 'DISCOUNT';
}

export interface PricingBreakdown {
  subtotal: number;
  discountAmount: number;
  priceAfterDiscount: number;
  voucherApplied: number;
  amountDue: number; // What the customer actually pays now
  voucherLost: number; // If voucher > total, this is the amount lost
  items: LineItem[];
  appliedPromo?: string;
  appliedVoucher?: string;
  promoError?: string; // Feedback for UI
}

export interface EffectivePricing {
  standard: number;
  premium: number;
  addonPreDrink: number;
  addonAfterDrink: number;
  // Fallback for other addons not explicitly in profile
  [key: string]: number;
}

// --- Core Functions ---

/**
 * Determines the final base prices for a specific event date.
 * Hierarchy: Event Date Override > Show Profile > Defaults
 */
export const getEffectivePricing = (
  event: EventDate, 
  show: ShowDefinition
): EffectivePricing => {
  // 1. Identify Profile
  const profileId = event.profileId;
  const profile = show.profiles.find(p => p.id === profileId) || show.profiles[0];

  if (!profile) {
    console.error(`No profile found for show ${show.name}`);
    return { standard: 0, premium: 0, addonPreDrink: 0, addonAfterDrink: 0 };
  }

  // 2. Base Prices from Profile
  let pricing: EffectivePricing = {
    standard: profile.pricing.standard,
    premium: profile.pricing.premium,
    addonPreDrink: profile.pricing.addonPreDrink,
    addonAfterDrink: profile.pricing.addonAfterDrink,
  };

  // 3. Apply Event Overrides (if any)
  if (event.pricing) {
    if (event.pricing.standard !== undefined) pricing.standard = event.pricing.standard;
    if (event.pricing.premium !== undefined) pricing.premium = event.pricing.premium;
    if (event.pricing.addonPreDrink !== undefined) pricing.addonPreDrink = event.pricing.addonPreDrink;
    if (event.pricing.addonAfterDrink !== undefined) pricing.addonAfterDrink = event.pricing.addonAfterDrink;
  }

  return pricing;
};

/**
 * Calculates the complete financial breakdown for a booking.
 */
export const calculateBookingTotals = (
  wizardState: {
    totalGuests: number;
    packageType: 'standard' | 'premium' | string;
    addons: AddonSelection[];
    merchandise: MerchandiseSelection[];
    promo?: string;
    voucherCode?: string;
    date?: string;   // Added for engine validation
    showId?: string; // Added for engine validation
  },
  effectivePricing: EffectivePricing
): PricingBreakdown => {
  const items: LineItem[] = [];
  let arrangementTotal = 0;
  let addonsTotal = 0;
  let merchTotal = 0;

  // 1. Tickets / Package
  const unitPrice = wizardState.packageType === 'premium' 
    ? effectivePricing.premium 
    : effectivePricing.standard;
  
  const ticketTotal = unitPrice * wizardState.totalGuests;
  items.push({
    id: 'ticket',
    label: `${wizardState.packageType === 'premium' ? 'Premium' : 'Standard'} Arrangement`,
    quantity: wizardState.totalGuests,
    unitPrice: unitPrice,
    total: ticketTotal,
    category: 'TICKET'
  });
  arrangementTotal += ticketTotal;

  // 2. Add-ons
  const ADDON_MAP: Record<string, keyof EffectivePricing> = {
    'pre-drinks': 'addonPreDrink',
    'after-drinks': 'addonAfterDrink'
  };

  wizardState.addons.forEach(addon => {
    const pricingKey = ADDON_MAP[addon.id];
    let price = 0;
    let name = addon.id;

    if (pricingKey && effectivePricing[pricingKey] !== undefined) {
      price = effectivePricing[pricingKey];
      const def = MOCK_ADDONS.find(a => a.id === addon.id);
      if (def) name = def.name;
    } else {
      const def = MOCK_ADDONS.find(a => a.id === addon.id);
      if (def) {
        price = def.price;
        name = def.name;
      }
    }

    if (addon.quantity > 0) {
      const total = price * addon.quantity;
      items.push({
        id: addon.id,
        label: name,
        quantity: addon.quantity,
        unitPrice: price,
        total: total,
        category: 'ADDON'
      });
      addonsTotal += total;
    }
  });

  // 3. Merchandise
  wizardState.merchandise.forEach(sel => {
    const def = MOCK_MERCHANDISE.find(m => m.id === sel.id);
    if (def && sel.quantity > 0) {
      const total = def.price * sel.quantity;
      items.push({
        id: sel.id,
        label: def.name,
        quantity: sel.quantity,
        unitPrice: def.price,
        total: total,
        category: 'MERCH'
      });
      merchTotal += total;
    }
  });

  let subtotal = arrangementTotal + addonsTotal + merchTotal;

  // 4. Promo Code (Using Discount Engine)
  let discountAmount = 0;
  let promoError = undefined;

  if (wizardState.promo) {
    const context: PricingContext = {
      partySize: wizardState.totalGuests,
      packageType: wizardState.packageType as 'standard' | 'premium',
      unitPrice,
      arrangementTotal,
      addonsTotal,
      merchTotal,
      date: wizardState.date,
      showId: wizardState.showId
    };

    const promoResult = calculatePromoDiscount(wizardState.promo, context);

    if (promoResult.isValid) {
      discountAmount = promoResult.totalDiscount;
      // Add breakdown lines for UI
      promoResult.lines.forEach((line, idx) => {
        items.push({
          id: `promo-${idx}`,
          label: line.label,
          quantity: 1,
          unitPrice: -line.amount,
          total: -line.amount,
          category: 'DISCOUNT'
        });
      });
    } else {
      // If invalid, we don't apply discount, but pass error message back
      promoError = promoResult.error;
    }
  }

  // Ensure discount doesn't exceed subtotal (Engine does this too, but safety first)
  discountAmount = Math.min(discountAmount, subtotal);
  const priceAfterDiscount = subtotal - discountAmount;

  // 5. Voucher (Applied to Remainder)
  let voucherApplied = 0;
  let voucherLost = 0;
  
  if (wizardState.voucherCode) {
    // Check stacking rule if a promo is present?
    // The engine's `rule.allowWithVoucher` could be checked here if we passed the rule object back.
    // For now, assuming if promo allowed it, it's fine.
    
    const allVouchers = getVouchers();
    const voucher = allVouchers.find(v => v.code === wizardState.voucherCode);
    
    if (voucher && voucher.isActive && voucher.currentBalance > 0) {
      const balance = voucher.currentBalance;
      if (balance >= priceAfterDiscount) {
        voucherApplied = priceAfterDiscount;
        voucherLost = balance - priceAfterDiscount; // "Use it or lose it" rule
      } else {
        voucherApplied = balance;
        voucherLost = 0;
      }
    }
  }

  const amountDue = Math.max(0, priceAfterDiscount - voucherApplied);

  return {
    subtotal,
    discountAmount,
    priceAfterDiscount,
    voucherApplied,
    amountDue,
    voucherLost,
    items,
    appliedPromo: wizardState.promo,
    appliedVoucher: wizardState.voucherCode,
    promoError
  };
};

/**
 * Re-calculates financials for an existing reservation, usually after a change request.
 * Handles re-evaluation of 'isPaid' status.
 */
export const recalculateReservationFinancials = (reservation: Reservation): ReservationFinancials => {
  const events = getEvents();
  const shows = getShowDefinitions();
  
  const event = events.find(e => e.date === reservation.date);
  const show = shows.find(s => s.id === reservation.showId);
  
  if (!event || !show) {
    console.error("Cannot recalculate pricing: Missing event or show data");
    return reservation.financials; // Return existing as fallback
  }

  const pricingProfile = getEffectivePricing(event, show);
  
  // Extract promo from financials if stored, or parse from voucherCode if it mimics a promo
  // Simplified assumption: reservation.financials.voucherCode might store the promo code if used
  // Or we might need a dedicated field in future schema.
  // For now, let's assume we re-calculate based on what's available.
  
  const totals = calculateBookingTotals({
    totalGuests: reservation.partySize,
    packageType: reservation.packageType,
    addons: reservation.addons,
    merchandise: reservation.merchandise,
    // If a reservation has a promo applied, it should ideally be stored in reservation.promoCode
    // Falling back to check if voucherCode looks like a known PROMO rule
    promo: reservation.financials.voucherCode, 
    voucherCode: undefined, // Re-applying voucher logic on top of paid amount is tricky in re-calc without full history
    date: reservation.date,
    showId: reservation.showId
  }, pricingProfile);

  // Check if fully paid based on previously paid amount
  const paidSoFar = reservation.financials.paid || 0;
  
  const isPaid = paidSoFar >= totals.amountDue;

  return {
    ...reservation.financials,
    total: totals.subtotal,
    subtotal: totals.subtotal,
    discount: totals.discountAmount,
    finalTotal: totals.amountDue,
    isPaid: isPaid,
    // paymentDueAt remains unchanged
  };
};
