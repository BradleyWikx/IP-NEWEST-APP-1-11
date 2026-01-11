
import { ShowType, BookingStatus, Addon, MerchandiseItem } from '../types';

export const MOCK_SHOW_TYPES: Record<string, ShowType> = {
  'matinee': { id: 'matinee', name: 'Sunday Matinee', color: 'emerald', basePrice: 45, premiumPrice: 65, startTime: '13:00' },
  'weekday': { id: 'weekday', name: 'Evening Performance', color: 'indigo', basePrice: 55, premiumPrice: 85, startTime: '19:30' },
  'weekend': { id: 'weekend', name: 'Weekend Gala', color: 'amber', basePrice: 75, premiumPrice: 110, startTime: '19:00' },
  'special': { id: 'special', name: 'Charity Gala Night', color: 'rose', basePrice: 90, premiumPrice: 150, startTime: '18:30' },
};

export const MOCK_PROMO_CODES: Record<string, { discount: number, type: 'PERCENT' | 'FIXED' }> = {
  'EARLYBIRD': { discount: 10, type: 'PERCENT' },
  'THEATER25': { discount: 25, type: 'FIXED' },
};

export const MOCK_VOUCHERS: Record<string, { balance: number, isActive: boolean }> = {
  'GS-V100': { balance: 100, isActive: true },
  'GS-V250': { balance: 250, isActive: true },
  'GS-V50': { balance: 50, isActive: true },
  'GS-GOLD': { balance: 500, isActive: true }, // High value for testing overage
  'GS-USED': { balance: 100, isActive: false }, // Inactive for testing errors
};

export const MOCK_ADDONS: Addon[] = [
  { 
    id: 'pre-drinks', 
    name: 'Exclusieve Pre-Drink', 
    price: 12.50, 
    minGroupSize: 25, 
    description: 'Een feestelijk ontvangst met bubbels en amuse in een gereserveerde area.' 
  },
  { 
    id: 'after-drinks', 
    name: 'After-Show Borrel', 
    price: 15.00, 
    minGroupSize: 25, 
    description: 'Nagenieten met een selectie hapjes en onbeperkt drankjes gedurende 45 min.' 
  }
];

export const MOCK_MERCHANDISE: (MerchandiseItem & { description: string, active: boolean })[] = [
  { 
    id: 'prog-book', 
    name: 'Luxury Program Book', 
    price: 15.00, 
    description: 'A glossy 50-page guide with behind-the-scenes photography.', 
    active: true,
    category: 'Souvenir',
    stock: 100
  },
  { 
    id: 'glass-set', 
    name: 'Commemorative Glass Set', 
    price: 34.50, 
    description: 'Set of 2 crystal wine glasses with the Grand Stage logo.', 
    active: true,
    category: 'Home',
    stock: 50
  },
  { 
    id: 'theatre-mask', 
    name: 'Handcrafted Masquerade Mask', 
    price: 45.00, 
    description: 'Beautifully detailed mask for the ultimate gala experience.', 
    active: true,
    category: 'Apparel',
    stock: 25
  },
  { 
    id: 'signed-poster', 
    name: 'Signed Cast Poster', 
    price: 20.00, 
    description: 'Limited edition A2 poster signed by the lead performers.', 
    active: true,
    category: 'Art',
    stock: 10
  }
];

export type Availability = 'OPEN' | 'CLOSED' | 'WAITLIST';

export interface EventDate {
  date: string; // ISO format YYYY-MM-DD
  showId: string;
  availability: Availability;
  doorTime: string;
}

export const MOCK_EVENT_DATES: EventDate[] = [
  { date: '2025-05-01', showId: 'weekday', availability: 'OPEN', doorTime: '18:30' },
  { date: '2025-05-02', showId: 'weekend', availability: 'OPEN', doorTime: '18:00' },
  { date: '2025-05-03', showId: 'weekend', availability: 'CLOSED', doorTime: '18:00' },
  { date: '2025-05-04', showId: 'matinee', availability: 'OPEN', doorTime: '12:00' },
  { date: '2025-05-08', showId: 'weekday', availability: 'WAITLIST', doorTime: '18:30' },
  { date: '2025-05-15', showId: 'special', availability: 'OPEN', doorTime: '17:30' },
  ...Array.from({ length: 15 }, (_, i) => ({
    date: `2025-05-${(i + 10).toString().padStart(2, '0')}`,
    showId: i % 3 === 0 ? 'matinee' : i % 3 === 1 ? 'weekday' : 'weekend',
    availability: 'OPEN' as Availability,
    doorTime: '18:00'
  }))
];

export const MOCK_RESERVATIONS = [
  {
    id: 'RES-8821',
    lastName: 'Hampton',
    firstName: 'David',
    status: BookingStatus.CONFIRMED,
    date: '2025-05-12',
    showId: 'weekday',
    partySize: 4,
    packageId: 'premium',
    totalAmount: 340,
    paid: true,
    tableNumber: '12'
  }
];
