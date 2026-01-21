
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  Clock, MapPin, Ticket, Lock, Mic, Music, AlertCircle, 
  Info, Briefcase, Printer
} from 'lucide-react';
import { Card, Badge, Button } from '../UI';
import { toLocalISOString } from '../../utils/dateHelpers';
import { calendarRepo, getShowDefinitions } from '../../utils/storage';
import { CalendarEvent, ShowDefinition } from '../../types';

export const StaffScheduler = () => {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [shows, setShows] = useState<ShowDefinition[]>([]);

  useEffect(() => {
    // Load all calendar events (Shows, Rehearsals, Blackouts, etc.)
    setEvents(calendarRepo.getAll());
    setShows(getShowDefinitions());
  }, []);

  // --- HELPER: Get Event Color/Icon ---
  const getEventStyle = (event: CalendarEvent) => {
    switch (event.type) {
        case 'SHOW':
            return { color: 'blue', icon: Ticket, label: 'Voorstelling' };
        case 'REHEARSAL':
            return { color: 'amber', icon: Mic, label: 'Repetitie' };
        case 'PRIVATE_EVENT':
            return { color: 'emerald', icon: Briefcase, label: 'Besloten' };
        case 'BLACKOUT':
            return { color: 'red', icon: Lock, label: 'Gesloten' };
        default:
            return { color: 'slate', icon: Info, label: 'Overig' };
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // --- CALENDAR GRID CALCULATION ---
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Start Monday
    const startDay = firstDay.getDay(); 
    const europeanStartDay = (startDay + 6) % 7;
    
    const days = [];
    for (let i = 0; i < europeanStartDay; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
        days.push(new Date(year, month, d));
    }
    return days;
  }, [viewDate]);

  // --- FILTERED EVENTS FOR SELECTED DAY ---
  const selectedDateStr = toLocalISOString(selectedDate);
  const dailyEvents = events
    .filter(e => e.date === selectedDateStr)
    .sort((a, b) => (a.times?.start || '00:00').localeCompare(b.times?.start || '00:00'));

  // --- FILTERED EVENTS FOR PRINT LIST (ENTIRE MONTH) ---
  const monthlyEvents = useMemo(() => {
    const startMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const endMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    const startStr = toLocalISOString(startMonth);
    const endStr = toLocalISOString(endMonth);

    return events
      .filter(e => e.date >= startStr && e.date <= endStr)
      .sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return (a.times?.start || '').localeCompare(b.times?.start || '');
      });
  }, [events, viewDate]);

  return (
    <div className="h-full flex flex-col space-y-6">
       
       {/* HEADER (Screen Only) */}
       <div className="flex justify-between items-end print:hidden">
         <div>
            <h2 className="text-3xl font-serif text-white">Productie Planning</h2>
            <p className="text-slate-500 text-sm">Overzicht van alle geplande activiteiten in de zaal.</p>
         </div>
         <Button onClick={handlePrint} variant="secondary" className="flex items-center">
            <Printer size={18} className="mr-2"/> Print Maandoverzicht
         </Button>
       </div>

       {/* INTERACTIVE DASHBOARD (Hidden on Print) */}
       <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full print:hidden">
          
          {/* LEFT: CALENDAR */}
          <div className="lg:col-span-5 flex flex-col">
             <Card className="bg-slate-900 border-slate-800 p-6 flex flex-col h-full">
                <div className="flex justify-between items-center mb-6">
                   <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth()-1)))} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white"><ChevronLeft/></button>
                   <h3 className="text-lg font-bold text-white capitalize">{viewDate.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}</h3>
                   <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth()+1)))} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white"><ChevronRight/></button>
                </div>

                <div className="grid grid-cols-7 mb-2">
                   {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map(d => (
                       <div key={d} className="text-center text-[10px] font-bold text-slate-500 uppercase">{d}</div>
                   ))}
                </div>
                
                <div className="grid grid-cols-7 gap-1">
                   {calendarDays.map((date, i) => {
                       if (!date) return <div key={`empty-${i}`} className="aspect-square" />;
                       
                       const dStr = toLocalISOString(date);
                       const dayEvents = events.filter(e => e.date === dStr);
                       const isSelected = dStr === selectedDateStr;
                       const isToday = dStr === toLocalISOString(new Date());

                       return (
                           <button 
                              key={dStr}
                              onClick={() => setSelectedDate(date)}
                              className={`
                                relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all
                                ${isSelected ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-slate-800/30 text-slate-300 hover:bg-slate-800'}
                                ${isToday && !isSelected ? 'border border-amber-500/50' : 'border border-transparent'}
                              `}
                           >
                              <span className="text-sm font-bold">{date.getDate()}</span>
                              
                              {/* Event Dots */}
                              <div className="flex space-x-1 mt-1">
                                {dayEvents.slice(0, 3).map((ev, idx) => {
                                    const style = getEventStyle(ev);
                                    return (
                                        <div key={idx} className={`w-1.5 h-1.5 rounded-full bg-${style.color}-500 ${isSelected ? 'border border-black' : ''}`} />
                                    );
                                })}
                                {dayEvents.length > 3 && <div className={`w-1.5 h-1.5 rounded-full bg-slate-500`} />}
                              </div>
                           </button>
                       );
                   })}
                </div>
             </Card>
          </div>

          {/* RIGHT: DAILY AGENDA */}
          <div className="lg:col-span-7 flex flex-col">
             <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden h-full flex flex-col">
                <div className="p-6 border-b border-slate-800 bg-slate-950/50">
                    <h3 className="text-xl font-bold text-white capitalize flex items-center">
                        <CalendarIcon size={20} className="mr-3 text-amber-500" />
                        {selectedDate.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h3>
                </div>
                
                <div className="p-6 flex-grow overflow-y-auto space-y-4">
                    {dailyEvents.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <p>Geen activiteiten gepland voor deze dag.</p>
                        </div>
                    ) : (
                        dailyEvents.map(event => {
                            const style = getEventStyle(event);
                            const Icon = style.icon;
                            const showInfo = event.type === 'SHOW' ? shows.find(s => s.id === (event as any).showId) : null;
                            const title = showInfo ? showInfo.name : event.title;

                            return (
                                <div key={event.id} className={`p-4 rounded-xl border bg-${style.color}-900/10 border-${style.color}-900/30 flex items-start space-x-4`}>
                                    <div className={`p-3 rounded-lg bg-${style.color}-500/20 text-${style.color}-500`}>
                                        <Icon size={24} />
                                    </div>
                                    <div className="flex-grow">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-white text-lg">{title}</h4>
                                            <Badge status="CUSTOM" className={`bg-${style.color}-500/20 text-${style.color}-400 border-${style.color}-500/30`}>
                                                {style.label}
                                            </Badge>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4 mt-3">
                                            <div className="flex items-center text-sm text-slate-400">
                                                <Clock size={16} className="mr-2 opacity-70" />
                                                <span>{event.times.start} - {event.times.end || '???'}</span>
                                            </div>
                                            {event.times.doorsOpen && (
                                                <div className="flex items-center text-sm text-slate-400">
                                                    <Lock size={16} className="mr-2 opacity-70" />
                                                    <span>Deur open: {event.times.doorsOpen}</span>
                                                </div>
                                            )}
                                        </div>

                                        {(event as any).notes && (
                                            <div className="mt-3 text-sm text-slate-500 italic border-t border-white/5 pt-2">
                                                "{(event as any).notes}"
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
             </div>
          </div>
       </div>

       {/* PRINT VIEW (Visible Only on Print) */}
       <div className="hidden print:block bg-white text-black p-8 min-h-screen">
          <div className="border-b-4 border-black pb-4 mb-8 flex justify-between items-end">
             <div>
                <h1 className="text-4xl font-black uppercase tracking-tighter">Productie Planning</h1>
                <p className="text-xl mt-2 capitalize">{viewDate.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}</p>
             </div>
             <div className="text-right">
                <p className="text-sm font-bold">Inspiration Point</p>
                <p className="text-xs">Gegenereerd op {new Date().toLocaleDateString()}</p>
             </div>
          </div>

          <table className="w-full text-left border-collapse">
             <thead className="bg-black text-white uppercase text-xs font-bold">
                <tr>
                   <th className="p-3 w-32">Datum</th>
                   <th className="p-3 w-32">Tijd</th>
                   <th className="p-3 w-40">Type</th>
                   <th className="p-3">Evenement</th>
                   <th className="p-3">Bijzonderheden</th>
                </tr>
             </thead>
             <tbody className="text-sm">
                {monthlyEvents.length === 0 ? (
                   <tr><td colSpan={5} className="p-8 text-center italic text-gray-500">Geen evenementen deze maand.</td></tr>
                ) : (
                   monthlyEvents.map((event, idx) => {
                      const showInfo = event.type === 'SHOW' ? shows.find(s => s.id === (event as any).showId) : null;
                      const title = showInfo ? showInfo.name : event.title;
                      const dateObj = new Date(event.date);
                      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                      
                      return (
                         <tr key={event.id} className={`border-b border-gray-300 ${isWeekend ? 'bg-gray-100' : ''}`}>
                            <td className="p-3 font-bold">
                               {dateObj.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'numeric' })}
                            </td>
                            <td className="p-3">
                               {event.times.start} {event.times.end ? `- ${event.times.end}` : ''}
                            </td>
                            <td className="p-3 text-xs uppercase font-bold text-gray-600">
                               {getEventStyle(event).label}
                            </td>
                            <td className="p-3 font-bold">
                               {title}
                            </td>
                            <td className="p-3 text-xs italic text-gray-600">
                               {event.times.doorsOpen && `Deur: ${event.times.doorsOpen}. `}
                               {(event as any).notes || ''}
                            </td>
                         </tr>
                      );
                   })
                )}
             </tbody>
          </table>
       </div>

    </div>
  );
};
