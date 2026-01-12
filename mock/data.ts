
import { ShowType, BookingStatus, Addon, MerchandiseItem } from '../types';

// --- CONFIGURATION DATA (KEPT) ---

export const MOCK_SHOW_TYPES: Record<string, ShowType> = {
  'matinee': { id: 'matinee', name: 'Zondag Matinee', color: 'pink', basePrice: 70, premiumPrice: 85, startTime: '14:00' },
  'weekday': { id: 'weekday', name: 'Alles in Wonderland (Week)', color: 'purple', basePrice: 70, premiumPrice: 85, startTime: '19:30' },
  'weekend': { id: 'weekend', name: 'Alles in Wonderland (Weekend)', color: 'fuchsia', basePrice: 80, premiumPrice: 95, startTime: '19:00' },
  'special': { id: 'special', name: 'Zorgzame Helden', color: 'teal', basePrice: 65, premiumPrice: 80, startTime: '19:00' },
};

export const MOCK_PROMO_CODES: Record<string, { discount: number, type: 'PERCENT' | 'FIXED' }> = {
  'EARLYBIRD': { discount: 10, type: 'PERCENT' },
};

export const MOCK_VOUCHERS: Record<string, { balance: number, isActive: boolean }> = {
  // Empty default vouchers
};

export const MOCK_ADDONS: Addon[] = [
  { 
    id: 'pre-drinks', 
    name: 'Borrel vooraf', 
    price: 15.00, 
    minGroupSize: 25, 
    description: 'Gezellige ruimte in besloten kring met drankarrangement en warme snacks.' 
  },
  { 
    id: 'after-drinks', 
    name: 'AfterParty', 
    price: 15.00, 
    minGroupSize: 25, 
    description: 'Nagenieten in bruin café of Sprookjes Salon incl. drankjes/hapjes/live muziek.' 
  }
];

export const MOCK_MERCHANDISE: (MerchandiseItem & { description: string, active: boolean })[] = [
  { 
    id: 'prog-book', 
    name: 'Luxe Programaboek', 
    price: 15.00, 
    description: 'Een glossy gids met 50 pagina\'s fotografie achter de schermen.', 
    active: true,
    category: 'Souvenir',
    stock: 100
  },
  { 
    id: 'glass-set', 
    name: 'Herinneringsglazen', 
    price: 34.50, 
    description: 'Set van 2 kristallen wijnglazen met het Inspiration Point logo.', 
    active: true,
    category: 'Home',
    stock: 50
  },
  { 
    id: 'theatre-mask', 
    name: 'Handgemaakt Masker', 
    price: 45.00, 
    description: 'Prachtig gedetailleerd masker voor de ultieme beleving.', 
    active: true,
    category: 'Apparel',
    stock: 25
  },
  { 
    id: 'signed-poster', 
    name: 'Gesigneerde Poster', 
    price: 20.00, 
    description: 'Gelimiteerde A2 poster gesigneerd door de cast.', 
    active: true,
    category: 'Art',
    stock: 10
  }
];

// --- TRANSACTIONAL MOCK DATA (REMOVED) ---

export type Availability = 'OPEN' | 'CLOSED' | 'WAITLIST';

export interface EventDate {
  date: string; 
  showId: string;
  availability: Availability;
  doorTime: string;
}

export const MOCK_EVENT_DATES: EventDate[] = [];
export const MOCK_RESERVATIONS = [];
