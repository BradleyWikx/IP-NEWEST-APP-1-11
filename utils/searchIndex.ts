
import { 
  bookingRepo,
  getCustomers, 
  getVouchers, 
  getWaitlist, 
  getEvents, 
  getShowDefinitions 
} from './storage';
import { BookingStatus } from '../types';

export type SearchCategory = 'RESERVATION' | 'CUSTOMER' | 'VOUCHER' | 'WAITLIST' | 'EVENT';

export interface SearchItem {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle: string;
  keywords: string[]; // text to match against
  link: string; // route to navigate to
  actionId?: string; // id to open in drawer
  status?: string; // for visual badges
}

export const buildSearchIndex = (): SearchItem[] => {
  const index: SearchItem[] = [];
  
  try {
    // 1. Reservations (Fetch ALL including ARCHIVED)
    const reservations = bookingRepo.getAll(true);
    const shows = getShowDefinitions();
    
    reservations.forEach(res => {
      const show = shows.find(s => s.id === res.showId);
      const isArchived = res.status === BookingStatus.ARCHIVED;
      
      index.push({
        id: `res-${res.id}`,
        category: 'RESERVATION',
        title: `${res.customer.firstName} ${res.customer.lastName}`,
        subtitle: `${new Date(res.date).toLocaleDateString()} • ${res.id} • ${res.partySize}p ${isArchived ? '(Archief)' : ''}`,
        keywords: [
          res.id, 
          res.customer.firstName, 
          res.customer.lastName, 
          res.customer.email, 
          res.status,
          res.date,
          show?.name || ''
        ],
        link: '/admin/reservations',
        actionId: res.id,
        status: res.status
      });
    });

    // 2. Customers
    const customers = getCustomers();
    customers.forEach(c => {
      index.push({
        id: `cust-${c.id}`,
        category: 'CUSTOMER',
        title: `${c.firstName} ${c.lastName}`,
        subtitle: c.email,
        keywords: [
          c.firstName, 
          c.lastName, 
          c.email, 
          c.phone, 
          c.companyName || ''
        ],
        link: '/admin/customers',
        actionId: c.id
      });
    });

    // 3. Vouchers
    const vouchers = getVouchers();
    vouchers.forEach(v => {
      index.push({
        id: `vouch-${v.code}`,
        category: 'VOUCHER',
        title: `Voucher ${v.code}`,
        subtitle: `Saldo: €${v.currentBalance.toFixed(2)} • ${v.issuedTo || 'Onbekend'}`,
        keywords: [v.code, v.issuedTo || '', 'voucher', v.isActive ? 'active' : 'inactive'],
        link: '/admin/vouchers',
        actionId: v.code,
        status: v.isActive && v.currentBalance > 0 ? 'ACTIVE' : 'USED'
      });
    });

    // 4. Waitlist
    const waitlist = getWaitlist();
    waitlist.forEach(w => {
      index.push({
        id: `wl-${w.id}`,
        category: 'WAITLIST',
        title: w.contactName,
        subtitle: `Wachtlijst: ${new Date(w.date).toLocaleDateString()} (${w.partySize}p)`,
        keywords: [w.contactName, w.contactEmail, w.date, 'waitlist', w.status],
        link: '/admin/waitlist',
        actionId: w.id,
        status: w.status
      });
    });

    // 5. Events (Calendar)
    const events = getEvents();
    events.forEach(e => {
      const show = shows.find(s => s.id === e.showId);
      if (!show) return;
      
      const dateStr = new Date(e.date).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'long' });
      
      index.push({
        id: `evt-${e.date}`,
        category: 'EVENT',
        title: show.name,
        subtitle: `${dateStr} • ${e.startTime}`,
        keywords: [e.date, show.name, e.availability, 'show', 'event'],
        link: '/admin/calendar',
        actionId: e.date, // Calendar uses dateStr to find event
        status: e.availability
      });
    });

  } catch (err) {
    console.error("Failed to build search index", err);
  }

  return index;
};

export const filterSearch = (items: SearchItem[], query: string): SearchItem[] => {
  if (!query || query.length < 2) return [];
  
  const lowerQuery = query.toLowerCase().trim();
  const queryParts = lowerQuery.split(' ');

  // Performance optimization: Limit results
  let matches = 0;
  const maxResults = 20;
  const results: SearchItem[] = [];

  for (const item of items) {
    if (matches >= maxResults) break;

    // Check if ALL query parts are found in ANY of the keywords
    // This allows searching "Jan 12" to find "Jan Jansen 2025-05-12"
    const allPartsMatch = queryParts.every(part => 
      item.keywords.some(k => k.toLowerCase().includes(part))
    );

    if (allPartsMatch) {
      results.push(item);
      matches++;
    }
  }

  return results;
};
