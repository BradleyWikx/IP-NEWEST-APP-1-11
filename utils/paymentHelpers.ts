
import { Reservation, BookingStatus } from '../types';

export type PaymentStatus = 'PAID' | 'PAY_ON_NIGHT' | 'OVERDUE' | 'DUE_SOON' | 'UNPAID' | 'INVITED' | 'CANCELLED' | 'PARTIAL';

/**
 * Robustly checks if a reservation is fully paid based on amounts.
 * Uses a small epsilon (0.01) to handle floating point inaccuracies.
 * This replaces reliance on the stored 'isPaid' boolean.
 */
export const isReservationPaid = (reservation: Reservation): boolean => {
  if (reservation.status === BookingStatus.INVITED) return true;
  // If total is 0 or less, it's considered paid
  if (reservation.financials.finalTotal <= 0.01) return true;
  
  return reservation.financials.paid >= (reservation.financials.finalTotal - 0.01);
};

export const getPaymentStatus = (reservation: Reservation): PaymentStatus => {
  if (reservation.status === BookingStatus.CANCELLED) return 'CANCELLED';
  if (reservation.status === BookingStatus.INVITED) return 'INVITED';
  
  const { paidAt, payOnNightAllowed, paymentDueAt, paid, finalTotal } = reservation.financials;

  // Runtime calculation instead of relying on r.financials.isPaid
  const isFullyPaid = isReservationPaid(reservation);

  if (isFullyPaid) return 'PAID';
  
  // Check for Partial Payment (Paid > 0 but not fully paid)
  if (paid > 0.01 && paid < finalTotal) return 'PARTIAL';

  if (payOnNightAllowed) return 'PAY_ON_NIGHT';

  if (!paymentDueAt) return 'UNPAID';

  const due = new Date(paymentDueAt).getTime();
  const now = new Date().getTime();
  const diffDays = (due - now) / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return 'OVERDUE';
  if (diffDays <= 3) return 'DUE_SOON';

  return 'UNPAID';
};

export const getPaymentColor = (status: PaymentStatus): string => {
  switch (status) {
    case 'PAID': return 'emerald';
    case 'PAY_ON_NIGHT': return 'purple';
    case 'PARTIAL': return 'orange';
    case 'OVERDUE': return 'red';
    case 'DUE_SOON': return 'amber';
    case 'INVITED': return 'blue';
    case 'CANCELLED': return 'slate';
    default: return 'slate';
  }
};

export const getPaymentStats = (reservations: Reservation[]) => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const activeReservations = reservations.filter(r => 
    r.status !== BookingStatus.CANCELLED && 
    r.status !== BookingStatus.ARCHIVED &&
    r.status !== BookingStatus.INVITED
  );

  const overdue = activeReservations.filter(r => {
    const status = getPaymentStatus(r);
    return status === 'OVERDUE';
  });

  const dueNext7Days = activeReservations.filter(r => {
    const { paymentDueAt } = r.financials;
    const isPaid = isReservationPaid(r);
    if (isPaid || !paymentDueAt) return false;
    const due = new Date(paymentDueAt);
    return due >= now && due <= nextWeek;
  });

  const paidToday = activeReservations.filter(r => {
    const { paidAt } = r.financials;
    return paidAt && paidAt.startsWith(todayStr);
  });

  return {
    overdueCount: overdue.length,
    overdueAmount: overdue.reduce((sum, r) => sum + (r.financials.finalTotal - r.financials.paid), 0),
    dueNext7DaysCount: dueNext7Days.length,
    dueNext7DaysAmount: dueNext7Days.reduce((sum, r) => sum + (r.financials.finalTotal - r.financials.paid), 0),
    paidTodayCount: paidToday.length,
    paidTodayAmount: paidToday.reduce((sum, r) => sum + (r.financials.finalTotal || r.financials.total), 0)
  };
};
