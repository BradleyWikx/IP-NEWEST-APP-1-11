
import { useState, useMemo, useEffect } from 'react';
import { calendarRepo, getShowDefinitions, bookingRepo, waitlistRepo } from '../utils/storage';
import { ShowDefinition, Availability, CalendarEvent, ShowEvent } from '../types';
import { useIsMobile, useMediaQuery } from './useMediaQuery';
import { toLocalISOString } from '../utils/dateHelpers';
import { calculateEventStatus } from '../utils/status';

interface DayData {
  date: Date;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  event?: CalendarEvent;
  show?: ShowDefinition;
  status: Availability;
  waitlistCount: number; 
  theme: {
    bg: string;
    text: string;
    border: string;
    primary: string;
  };
}

export const useCalendarLogic = (initialDate?: string, mode: 'ADMIN' | 'CUSTOMER' = 'CUSTOMER') => {
  const [currentMonth, setCurrentMonth] = useState(initialDate ? new Date(initialDate) : new Date());
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [shows, setShows] = useState<ShowDefinition[]>([]);
  const [waitlistCounts, setWaitlistCounts] = useState<Record<string, number>>({});
  
  // View Mode defaults
  const isMobile = useIsMobile();
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1024px)');
  
  const [viewMode, setViewMode] = useState<'GRID' | 'AGENDA'>('GRID');
  const [isDense, setIsDense] = useState(false);

  useEffect(() => {
    if (isMobile) {
      setViewMode('AGENDA');
    } else {
      setViewMode('GRID');
      if (isTablet) setIsDense(true);
    }
  }, [isMobile, isTablet]);

  useEffect(() => {
    refreshData();
    window.addEventListener('storage-update', refreshData);
    return () => window.removeEventListener('storage-update', refreshData);
  }, []);

  const refreshData = () => {
    const rawEvents = calendarRepo.getAll();
    const allReservations = bookingRepo.getAll();
    const allWaitlist = waitlistRepo.getAll();
    
    // 1. Calculate Waitlist Counts per Date (Active entries only)
    const wlCounts: Record<string, number> = {};
    allWaitlist.forEach(w => {
      if (w.status === 'PENDING') {
        wlCounts[w.date] = (wlCounts[w.date] || 0) + 1; 
      }
    });
    setWaitlistCounts(wlCounts);

    // 2. Dynamically calculate booked count based on active reservations
    const enrichedEvents = rawEvents.map(event => {
      if (event.type === 'SHOW') {
        const bookingsForDate = allReservations.filter(r => 
          r.date === event.date && 
          r.status !== 'CANCELLED' && 
          r.status !== 'ARCHIVED' &&
          r.status !== 'NOSHOW' && 
          r.status !== 'WAITLIST'
        );
        
        // Sum total people
        const realBookedCount = bookingsForDate.reduce((sum, r) => sum + r.partySize, 0);
        
        return { 
          ...event, 
          bookedCount: realBookedCount
        };
      }
      return event;
    });

    setAllEvents(enrichedEvents);
    setShows(getShowDefinitions());
  };

  const navigateMonth = (delta: number) => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const calendarDays = useMemo<DayData[]>(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Filter Events based on Mode
    const visibleEvents = allEvents.filter(e => {
      if (mode === 'ADMIN') return true;
      if (e.type !== 'SHOW') return false;
      if (e.visibility !== 'PUBLIC') return false;
      return true;
    });

    const days: DayData[] = [];
    
    const startDay = firstDay.getDay(); 
    const europeanStartDay = (startDay + 6) % 7;
    
    for (let i = 0; i < europeanStartDay; i++) {
      const d = new Date(year, month, -(europeanStartDay - 1 - i));
      days.push(createDayData(d, false, visibleEvents, shows, waitlistCounts));
    }
    
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      days.push(createDayData(date, true, visibleEvents, shows, waitlistCounts));
    }
    
    const endDay = lastDay.getDay();
    const europeanEndDay = (endDay + 6) % 7;
    const padEnd = 6 - europeanEndDay;
    
    for (let i = 1; i <= padEnd; i++) {
      const d = new Date(year, month + 1, i);
      days.push(createDayData(d, false, visibleEvents, shows, waitlistCounts));
    }
    
    return days;
  }, [currentMonth, allEvents, shows, mode, waitlistCounts]);

  return {
    currentMonth,
    navigateMonth,
    calendarDays,
    viewMode,
    setViewMode,
    isDense,
    setIsDense,
    refreshData
  };
};

const createDayData = (
  date: Date, 
  isCurrentMonth: boolean, 
  events: CalendarEvent[], 
  shows: ShowDefinition[],
  waitlistCounts: Record<string, number>
): DayData => {
  const dateStr = toLocalISOString(date); 
  const todayStr = toLocalISOString(new Date());
  
  const event = events.find(e => e.date === dateStr);
  const wlCount = waitlistCounts[dateStr] || 0;
  
  let show = undefined;
  let theme = { bg: 'bg-slate-900', text: 'text-slate-500', border: 'border-slate-800', primary: 'slate' };
  let status: Availability = 'CLOSED';

  if (event) {
    if (event.type === 'SHOW') {
      const showEvent = event as ShowEvent;
      show = shows.find(s => s.id === showEvent.showId);
      const profile = show?.profiles.find(p => p.id === showEvent.profileId) || show?.profiles[0];
      
      // STRICT STATUS CALCULATION
      status = calculateEventStatus(
        showEvent.bookedCount, 
        showEvent.capacity, 
        wlCount, 
        showEvent.status
      );
      
      if (profile) {
        const c = profile.color || 'slate';
        theme = {
          bg: `bg-${c}-900/10`,
          text: `text-${c}-400`,
          border: `border-${c}-500/30`,
          primary: c
        };
      }
    } else {
      status = 'CLOSED';
      theme = {
        bg: event.type === 'BLACKOUT' ? 'bg-red-950/30' : 'bg-slate-800/30',
        text: event.type === 'BLACKOUT' ? 'text-red-500' : 'text-slate-400',
        border: event.type === 'BLACKOUT' ? 'border-red-900/30' : 'border-slate-700',
        primary: 'slate'
      };
    }
  }

  return {
    date,
    dateStr,
    isCurrentMonth,
    isToday: dateStr === todayStr,
    event,
    show,
    status,
    waitlistCount: wlCount,
    theme
  };
};
