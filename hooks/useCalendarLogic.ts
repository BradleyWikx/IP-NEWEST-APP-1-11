
import { useState, useMemo, useEffect } from 'react';
import { calendarRepo, getShowDefinitions } from '../utils/storage';
import { ShowDefinition, Availability, CalendarEvent, ShowEvent } from '../types';
import { useIsMobile, useMediaQuery } from './useMediaQuery';

interface DayData {
  date: Date;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  event?: CalendarEvent;
  show?: ShowDefinition;
  status: Availability;
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
  }, []);

  const refreshData = () => {
    setAllEvents(calendarRepo.getAll());
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
      // Customer: Only Public Shows
      if (e.type !== 'SHOW') return false;
      if (e.visibility !== 'PUBLIC') return false;
      return true;
    });

    const days: DayData[] = [];
    
    const startDay = firstDay.getDay(); // 0 = Sun
    const padStart = startDay === 0 ? 6 : startDay - 1; // Mon start
    
    // Previous Month Padding
    for (let i = 0; i < padStart; i++) {
      const d = new Date(year, month, -((padStart - 1) - i));
      days.push(createDayData(d, false, visibleEvents, shows));
    }
    
    // Current Month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      days.push(createDayData(date, true, visibleEvents, shows));
    }
    
    // Next Month Padding
    const endDay = lastDay.getDay(); 
    const padEnd = endDay === 0 ? 0 : 7 - endDay;
    for (let i = 1; i <= padEnd; i++) {
      const d = new Date(year, month + 1, i);
      days.push(createDayData(d, false, visibleEvents, shows));
    }
    
    return days;
  }, [currentMonth, allEvents, shows, mode]);

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

// Helper to create day data
const createDayData = (date: Date, isCurrentMonth: boolean, events: CalendarEvent[], shows: ShowDefinition[]): DayData => {
  const dateStr = date.toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];
  const event = events.find(e => e.date === dateStr);
  
  let show = undefined;
  let theme = { bg: 'bg-slate-900', text: 'text-slate-500', border: 'border-slate-800', primary: 'slate' };
  let status: Availability = 'CLOSED';

  if (event) {
    if (event.type === 'SHOW') {
      const showEvent = event as ShowEvent;
      show = shows.find(s => s.id === showEvent.showId);
      const profile = show?.profiles.find(p => p.id === showEvent.profileId) || show?.profiles[0];
      status = showEvent.status;
      
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
      // Non-Show Events (Admin Only typically)
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
    theme
  };
};
