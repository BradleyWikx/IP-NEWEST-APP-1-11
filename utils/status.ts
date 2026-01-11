
import { BookingStatus } from '../types';

export const getStatusColor = (status: BookingStatus | string): string => {
  switch (status) {
    case BookingStatus.REQUEST: return 'blue';
    case BookingStatus.OPTION: return 'amber';
    case BookingStatus.CONFIRMED: return 'emerald';
    case BookingStatus.CANCELLED: return 'red';
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
    case BookingStatus.WAITLIST: return 'Wachtlijst';
    case BookingStatus.INVITED: return 'Genodigde';
    case BookingStatus.ARCHIVED: return 'Archief';
    default: return status;
  }
};

export const getStatusStyles = (status: BookingStatus | string) => {
  const color = getStatusColor(status);
  return `bg-${color}-900/20 text-${color}-500 border-${color}-900/50 border`;
};
