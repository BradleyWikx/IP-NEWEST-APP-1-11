
import { Reservation } from '../types';

export interface CustomerMetrics {
  totalSpend: number;
  bookingCount: number;
  lastBookingDate: Date | null;
  firstBookingDate: Date | null;
  averageSpend: number;
}

export type CustomerSegment = 'BIG_SPENDER' | 'REGULAR' | 'SLEEPING' | 'NEW' | 'VIP' | 'ONE_TIMER';

export const calculateCustomerMetrics = (history: Reservation[]): CustomerMetrics => {
  const activeBookings = history.filter(r => r.status !== 'CANCELLED' && r.status !== 'REQUEST');
  
  const totalSpend = activeBookings.reduce((sum, r) => sum + (r.financials.finalTotal || r.financials.total || 0), 0);
  const bookingCount = activeBookings.length;
  const averageSpend = bookingCount > 0 ? totalSpend / bookingCount : 0;
  
  let lastBookingDate: Date | null = null;
  let firstBookingDate: Date | null = null;

  if (activeBookings.length > 0) {
    // Sorteer op datum
    const sorted = [...activeBookings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    firstBookingDate = new Date(sorted[0].date);
    lastBookingDate = new Date(sorted[sorted.length - 1].date);
  }

  return { totalSpend, bookingCount, lastBookingDate, firstBookingDate, averageSpend };
};

export const getCustomerSegments = (metrics: CustomerMetrics, manualTags: string[] = []): CustomerSegment[] => {
  const segments: CustomerSegment[] = [];
  const now = new Date();

  // Legacy manual override
  if (manualTags.includes('VIP')) segments.push('VIP');

  // Big Spender (> 1000 EUR totaal of > 150 EUR gemiddeld)
  if (metrics.totalSpend > 1000 || metrics.averageSpend > 150) {
    segments.push('BIG_SPENDER');
  }

  // Regular (> 3 bookings)
  if (metrics.bookingCount >= 3) {
    segments.push('REGULAR');
  }

  // One Timer (1 booking, in verleden)
  if (metrics.bookingCount === 1 && metrics.lastBookingDate && metrics.lastBookingDate < now) {
    segments.push('ONE_TIMER');
  }

  // Sleeping (Last booking > 1 year ago)
  if (metrics.lastBookingDate) {
    const diffTime = Math.abs(now.getTime() - metrics.lastBookingDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    if (diffDays > 365) {
      segments.push('SLEEPING');
    }
  }

  // New (First booking < 30 days ago)
  if (metrics.firstBookingDate) {
    const diffTime = Math.abs(now.getTime() - metrics.firstBookingDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 30) {
      segments.push('NEW');
    }
  }

  return segments;
};

export const getSegmentStyle = (segment: CustomerSegment): string => {
  switch (segment) {
    case 'BIG_SPENDER': return 'bg-emerald-900/30 text-emerald-400 border-emerald-900/50';
    case 'REGULAR': return 'bg-blue-900/30 text-blue-400 border-blue-900/50';
    case 'VIP': return 'bg-amber-900/30 text-amber-400 border-amber-900/50';
    case 'SLEEPING': return 'bg-slate-800 text-slate-500 border-slate-700';
    case 'NEW': return 'bg-purple-900/30 text-purple-400 border-purple-900/50';
    case 'ONE_TIMER': return 'bg-slate-900 text-slate-600 border-slate-800';
    default: return 'bg-slate-900 text-slate-400';
  }
};

export const getSegmentLabel = (segment: CustomerSegment): string => {
  switch (segment) {
    case 'BIG_SPENDER': return 'Big Spender';
    case 'REGULAR': return 'Stamgast';
    case 'VIP': return 'VIP';
    case 'SLEEPING': return 'Slapend';
    case 'NEW': return 'Nieuw';
    case 'ONE_TIMER': return 'Eenmalig';
    default: return segment;
  }
};
