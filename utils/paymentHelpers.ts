
import { Reservation, BookingStatus } from '../types';

export type PaymentStatus = 'PAID' | 'PAY_ON_NIGHT' | 'OVERDUE' | 'DUE_SOON' | 'UNPAID' | 'INVITED' | 'CANCELLED';

export const getPaymentStatus = (reservation: Reservation): PaymentStatus => {
  if (reservation.status === BookingStatus.CANCELLED) return 'CANCELLED';
  if (reservation.status === BookingStatus.INVITED) return 'INVITED';
  
  const { isPaid, paidAt, payOnNightAllowed, paymentDueAt } = reservation.financials;

  if (isPaid || paidAt) return 'PAID';
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
    case 'OVERDUE': return 'red';
    case 'DUE_SOON': return 'orange';
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
    const { paymentDueAt, isPaid } = r.financials;
    if (isPaid || !paymentDueAt) return false;
    const due = new Date(paymentDueAt);
    return due >= now && due <= nextWeek;
  });

  const paidToday = activeReservations.filter(r => {
    const { paidAt } = r.financials;
    return paidAt && paidAt.startsWith(todayStr);
  });

  const paidTodayAmount = paidToday.reduce((sum, r) => sum + (r.financials.finalTotal || r.financials.total), 0);

  return {
    overdueCount: overdue.length,
    overdueAmount: overdue.reduce((sum, r) => sum + (r.financials.finalTotal || r.financials.total), 0),
    dueNext7DaysCount: dueNext7Days.length,
    dueNext7DaysAmount: dueNext7Days.reduce((sum, r) => sum + (r.financials.finalTotal || r.financials.total), 0),
    paidTodayCount: paidToday.length,
    paidTodayAmount
  };
};
