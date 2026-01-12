
import { BookingStatus, Availability, ShowEvent } from '../types';

export const getStatusColor = (status: BookingStatus | string): string => {
  switch (status) {
    case BookingStatus.REQUEST: return 'blue';
    case BookingStatus.OPTION: return 'amber';
    case BookingStatus.CONFIRMED: return 'emerald';
    case BookingStatus.CANCELLED: return 'red';
    case BookingStatus.NOSHOW: return 'red';
    case BookingStatus.WAITLIST: return 'orange';
    case BookingStatus.INVITED: return 'purple';
    case BookingStatus.ARCHIVED: return 'slate';
    default: return 'slate';
  }
};

export const getStatusLabel = (status: BookingStatus | string): string => {
  switch (status) {
    case BookingStatus.REQUEST: return 'Aanvraag';
    case BookingStatus.OPTION: return 'Optie';
    case BookingStatus.CONFIRMED: return 'Bevestigd';
    case BookingStatus.CANCELLED: return 'Geannuleerd';
    case BookingStatus.NOSHOW: return 'No Show';
    case BookingStatus.WAITLIST: return 'Wachtlijst';
    case BookingStatus.INVITED: return 'Genodigde';
    case BookingStatus.ARCHIVED: return 'Archief';
    default: return status;
  }
};

export const getStatusStyles = (status: BookingStatus | string) => {
  const color = getStatusColor(status);
  // Special style for No Show to distinguish from Cancelled
  if (status === BookingStatus.NOSHOW) {
    return 'bg-black text-red-500 border-red-900 border-2 font-black';
  }
  return `bg-${color}-900/20 text-${color}-500 border-${color}-900/50 border`;
};

/**
 * Calculates the dynamic status of an event.
 * Rules:
 * 1. Booked < Capacity -> OPEN
 * 2. Booked >= Capacity -> Check Waitlist
 *    - Waitlist < 10 -> WAITLIST
 *    - Waitlist >= 10 -> CLOSED
 */
export const calculateEventStatus = (
  bookedCount: number, 
  capacity: number, 
  waitlistCount: number,
  manualStatus: Availability // Respect manual override if set to CLOSED explicitly by admin
): Availability => {
  if (manualStatus === 'CLOSED') return 'CLOSED';

  if (bookedCount < capacity) {
    return 'OPEN';
  }

  // Full, check waitlist buffer
  if (waitlistCount >= 10) {
    return 'CLOSED'; // Waitlist full
  }

  return 'WAITLIST';
};
