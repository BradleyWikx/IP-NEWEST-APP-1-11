import { PromoCodeRule, DiscountKind, PromoScope } from '../types';
import { getPromoRules } from '../utils/storage';

export interface PricingContext {
  partySize: number;
  packageType: 'standard' | 'premium';
  unitPrice: number;
  arrangementTotal: number;
  addonsTotal: number;
  merchTotal: number;
  date?: string;
  showId?: string;
}

export interface DiscountLine {
  label: string;
  amount: number; // Positive number representing the reduction
  scope: PromoScope;
}

export interface DiscountResult {
  isValid: boolean;
  error?: string;
  totalDiscount: number;
  lines: DiscountLine[];
  rule?: PromoCodeRule;
}

// --- Engine Logic ---

export const validateRule = (rule: PromoCodeRule, context: PricingContext): { valid: boolean; error?: string } => {
  if (!rule.enabled) return { valid: false, error: 'Deze code is niet meer geldig.' };

  const { constraints } = rule;
  if (constraints) {
    if (constraints.minPartySize && context.partySize < constraints.minPartySize) {
      return { valid: false, error: `Code vereist minimaal ${constraints.minPartySize} personen.` };
    }
    if (constraints.maxPartySize && context.partySize > constraints.maxPartySize) {
      return { valid: false, error: `Code geldig tot maximaal ${constraints.maxPartySize} personen.` };
    }
    if (constraints.eligibleShowIds && context.showId && !constraints.eligibleShowIds.includes(context.showId)) {
      return { valid: false, error: 'Code niet geldig voor deze show.' };
    }
    
    // Date checks
    const today = new Date().toISOString().split('T')[0];
    if (constraints.validFrom && today < constraints.validFrom) {
      return { valid: false, error: 'Code is nog niet geldig.' };
    }
    if (constraints.validUntil && today > constraints.validUntil) {
      return { valid: false, error: 'Code is verlopen.' };
    }
    
    // Show Date check (if context has date)
    if (context.date && constraints.blackoutDates && constraints.blackoutDates.includes(context.date)) {
      return { valid: false, error: 'Code niet geldig op deze datum.' };
    }
  }

  // Invited Config Check
  if (rule.kind === DiscountKind.INVITED_COMP && rule.invitedConfig) {
    const { eligibleArrangement } = rule.invitedConfig;
    if (eligibleArrangement !== 'ANY') {
      if (context.packageType.toUpperCase() !== eligibleArrangement) {
        return { valid: false, error: `Code alleen geldig voor ${eligibleArrangement} arrangementen.` };
      }
    }
  }

  return { valid: true };
};

export const calculatePromoDiscount = (code: string | undefined, context: PricingContext): DiscountResult => {
  if (!code) return { isValid: false, totalDiscount: 0, lines: [] };

  const rules = getPromoRules();
  const rule = rules.find(r => r.code.toUpperCase() === code.toUpperCase());

  if (!rule) {
    return { isValid: false, error: 'Onbekende code', totalDiscount: 0, lines: [] };
  }

  // Validation
  const validation = validateRule(rule, context);
  if (!validation.valid) {
    return { isValid: false, error: validation.error, totalDiscount: 0, lines: [] };
  }

  let discountAmount = 0;
  let lines: DiscountLine[] = [];

  // Determine Base for Percentage/Fixed Total
  // Default scope is ARRANGEMENT_ONLY
  let calculationBase = context.arrangementTotal;
  if (rule.scope === PromoScope.ENTIRE_BOOKING) {
    calculationBase = context.arrangementTotal + context.addonsTotal + context.merchTotal;
  }

  switch (rule.kind) {
    case DiscountKind.FIXED_PER_PERSON:
      if (rule.fixedAmountPerPerson) {
        const totalOff = rule.fixedAmountPerPerson * context.partySize;
        // Cap at the calculation base (cannot result in negative for that section)
        discountAmount = Math.min(totalOff, calculationBase);
        lines.push({
          label: `${rule.label} (${context.partySize}x €${rule.fixedAmountPerPerson})`,
          amount: discountAmount,
          scope: rule.scope
        });
      }
      break;

    case DiscountKind.PERCENTAGE:
      if (rule.percentage) {
        discountAmount = calculationBase * (rule.percentage / 100);
        lines.push({
          label: `${rule.label}`,
          amount: discountAmount,
          scope: rule.scope
        });
      }
      break;

    case DiscountKind.FIXED_TOTAL:
      if (rule.fixedAmountTotal) {
        discountAmount = Math.min(rule.fixedAmountTotal, calculationBase);
        lines.push({
          label: rule.label,
          amount: discountAmount,
          scope: rule.scope
        });
      }
      break;

    case DiscountKind.INVITED_COMP:
      if (rule.invitedConfig) {
        const { freeArrangementsMode, freeCount } = rule.invitedConfig;
        
        let freeTickets = 0;
        if (freeArrangementsMode === 'ALL') {
          freeTickets = context.partySize;
        } else if (freeArrangementsMode === 'COUNT' && freeCount) {
          freeTickets = Math.min(context.partySize, freeCount);
        }

        const ticketDiscount = freeTickets * context.unitPrice;
        // Cap at arrangement total (should be exact match unless logic drifts)
        discountAmount = Math.min(ticketDiscount, context.arrangementTotal);
        
        lines.push({
          label: `${rule.label} (${freeTickets}x Vrijkaart)`,
          amount: discountAmount,
          scope: PromoScope.ARRANGEMENT_ONLY
        });
      }
      break;
  }

  // Final Safety Cap against total booking value (though logically handled above per scope)
  const totalBookingValue = context.arrangementTotal + context.addonsTotal + context.merchTotal;
  discountAmount = Math.min(discountAmount, totalBookingValue);

  return {
    isValid: true,
    totalDiscount: discountAmount,
    lines,
    rule
  };
};