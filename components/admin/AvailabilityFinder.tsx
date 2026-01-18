
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Calendar, Users, Filter, ChevronRight, AlertTriangle, Clock } from 'lucide-react';
import { Card, Button, Badge } from '../UI';
import { calendarRepo, getShowDefinitions, bookingRepo } from '../../utils/storage';
import { ShowDefinition, Availability, CalendarEvent } from '../../types';

interface AvailabilityFinderProps {
  onSelect: (date: string, showId: string, event: CalendarEvent) => void;
  initialGuests?: number;
}

export const AvailabilityFinder: React.FC<AvailabilityFinderProps> = ({ onSelect, initialGuests = 2 }) => {
  const [partySize, setPartySize] = useState(initialGuests);
  const [dateRange, setDateRange] = useState<'30' | '60' | '90'>('30');
  const [showTypeFilter, setShowTypeFilter] = useState('ALL');
  const [dayFilter, setDayFilter] = useState<number | 'ALL'>('ALL'); // 0-6 or ALL
  
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [shows, setShows] = useState<ShowDefinition[]>([]);
  // Use reservations directly to calc occupancy
  const [reservations, setReservations] = useState<any[]>([]);

  useEffect(() => {
    setEvents(calendarRepo.getAll());
    setShows(getShowDefinitions());
    setReservations(bookingRepo.getAll());
  }, []);

  const results = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    // Calculate End Date
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + parseInt(dateRange));
    const endDateStr = endDate.toISOString().split('T')[0];

    // Pre-calc map for faster lookup in loop
    const occupancyMap: Record<string, number> = {};
    reservations.forEach(r => {
        if (r.status !== 'CANCELLED' && r.status !== 'ARCHIVED' && r.status !== 'WAITLIST') {
            occupancyMap[r.date] = (occupancyMap[r.date] || 0) + r.partySize;
        }
    });

    return events
      .filter(e => {
        // 1. Date Range & Type
        if (e.date < todayStr || e.date > endDateStr) return false;
        if (e.type !== 'SHOW') return false; // Only shows
        
        // 2. Show Type Filter
        if (showTypeFilter !== 'ALL' && (e as any).showId !== showTypeFilter) return false;

        // 3. Day of Week
        if (dayFilter !== 'ALL') {
          const d = new Date(e.date);
          if (d.getDay() !== dayFilter) return false;
        }

        return true;
      })
      .map(e => {
        const show = shows.find(s => s.id === (e as any).showId);
        // Calculate Occupancy Live
        const occupancy = occupancyMap[e.date] || 0;
        const capacity = (e as any).capacity || 230;
        const remaining = Math.max(0, capacity - occupancy);
        
        // Score: Closer dates higher, Open status higher
        let score = 0;
        if ((e as any).status === 'OPEN') score += 100;
        if ((e as any).status === 'WAITLIST') score += 50;
        // Subtract days from now (closer is better)
        const daysDiff = (new Date(e.date).getTime() - now.getTime()) / (1000 * 3600 * 24);
        score -= daysDiff;

        return {
          event: e,
          show,
          occupancy,
          capacity,
          remaining,
          isTight: partySize > remaining,
          score
        };
      })
      .sort((a, b) => b.score - a.score); // Best fit first
  }, [events, shows, partySize, dateRange, showTypeFilter, dayFilter, reservations]);

  return (
    <div className="space-y-6">
      {/* Search Panel */}
      <Card className="p-5 bg-slate-900 border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          
          {/* Party Size */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Aantal Personen</label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input 
                type="number" 
                min="1"
                className="w-full bg-black/40 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-white focus:border-amber-500 outline-none"
                value={partySize}
                onChange={(e) => setPartySize(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Show Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Show Type</label>
            <select 
              className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:border-amber-500 outline-none appearance-none"
              value={showTypeFilter}
              onChange={(e) => setShowTypeFilter(e.target.value)}
            >
              <option value="ALL">Alle Shows</option>
              {shows.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Date Range */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Periode</label>
            <div className="flex bg-black/40 p-1 rounded-xl border border-slate-800">
              {['30', '60', '90'].map((r) => (
                <button 
                  key={r}
                  onClick={() => setDateRange(r as any)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${dateRange === r ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {r}d
                </button>
              ))}
            </div>
          </div>

          {/* Day Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Dag</label>
            <select 
              className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:border-amber-500 outline-none appearance-none"
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value))}
            >
              <option value="ALL">Elke Dag</option>
              <option value="5">Vrijdag</option>
              <option value="6">Zaterdag</option>
              <option value="0">Zondag</option>
              <option value="1">Maandag</option>
              <option value="2">Dinsdag</option>
              <option value="3">Woensdag</option>
              <option value="4">Donderdag</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Results List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
        {results.length === 0 ? (
          <div className="text-center p-8 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
            Geen geschikte data gevonden. Probeer een ruimere zoekopdracht.
          </div>
        ) : (
          results.map(({ event, show, occupancy, capacity, remaining, isTight }, idx) => (
            <div 
              key={event.id}
              onClick={() => onSelect(event.date, (event as any).showId, event)}
              className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-amber-500 cursor-pointer group transition-all"
            >
              <div className="flex items-center space-x-4">
                <div className="flex flex-col items-center justify-center w-14 h-14 bg-black rounded-lg border border-slate-800 group-hover:border-slate-600">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">{new Date(event.date).toLocaleDateString('nl-NL', { weekday: 'short' })}</span>
                  <span className="text-xl font-serif text-white font-bold">{new Date(event.date).getDate()}</span>
                  <span className="text-[10px] text-slate-500 uppercase">{new Date(event.date).toLocaleDateString('nl-NL', { month: 'short' })}</span>
                </div>
                <div>
                  <h4 className="font-bold text-white text-lg">{show?.name}</h4>
                  <div className="flex items-center text-xs text-slate-400 space-x-3">
                    <span className="flex items-center"><Clock size={12} className="mr-1"/> {event.times?.start || '19:30'}</span>
                    
                    {/* Capacity Indicator in Result */}
                    <span className={`flex items-center font-bold ${remaining < 20 ? 'text-amber-500' : 'text-emerald-500'}`}>
                       <Users size={12} className="mr-1"/> 
                       {remaining} plekken vrij
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {isTight && (
                  <div className="flex items-center text-amber-500 text-xs font-bold px-3 py-1 bg-amber-900/20 rounded-full border border-amber-900/50">
                    <AlertTriangle size={12} className="mr-1.5" />
                    Krap
                  </div>
                )}
                {/* Visualizing Occupancy Bar */}
                <div className="hidden md:block w-24">
                   <div className="text-[9px] text-slate-500 text-right mb-1">{occupancy} / {capacity}</div>
                   <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div 
                        className={`h-full ${occupancy > capacity ? 'bg-purple-500' : remaining < 20 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${Math.min(100, (occupancy/capacity)*100)}%` }}
                      />
                   </div>
                </div>

                <Badge status={(event as any).status}>{(event as any).status}</Badge>
                <ChevronRight className="text-slate-600 group-hover:text-white transition-colors" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
