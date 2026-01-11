
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, Printer, ChevronLeft, ChevronRight, 
  Clock, Users, MapPin, Phone, Mail, FileText, CheckCircle2, 
  AlertCircle, Briefcase, Mic, Lock, Layout, List, Grid
} from 'lucide-react';
import { Button, Card, Input, Badge } from '../UI';
import { calendarRepo, bookingRepo } from '../../utils/storage';
import { CalendarEvent, Reservation, ShowEvent, PrivateEvent, RehearsalEvent, BlackoutEvent } from '../../types';
import { PreferencesSummary } from './PreferencesSummary';

type ViewMode = 'DAY' | 'WEEK' | 'MONTH' | 'SHEET';

// Helper to aggregate booking data for an event
const enrichEvent = (event: CalendarEvent, allReservations: Reservation[]) => {
  const dateStr = event.date;
  
  if (event.type === 'SHOW') {
    const showRes = allReservations.filter(r => r.date === dateStr && r.status !== 'CANCELLED');
    const totalGuests = showRes.reduce((sum, r) => sum + r.partySize, 0);
    
    // Summaries
    const dietary = showRes
      .filter(r => r.notes?.dietary)
      .map(r => `${r.partySize}x ${r.notes.dietary} (${r.customer.lastName})`);
    
    const merch = showRes
      .filter(r => r.merchandise && r.merchandise.length > 0)
      .reduce((acc, r) => acc + r.merchandise.length, 0);

    return { ...event, _stats: { totalGuests, dietary, merchCount: merch } };
  }
  
  if (event.type === 'PRIVATE_EVENT') {
    const pEvent = event as PrivateEvent;
    return { 
      ...event, 
      _stats: { 
        totalGuests: pEvent.financials.expectedGuests,
        dietary: pEvent.preferences.dietary ? [pEvent.preferences.dietary] : [] 
      } 
    };
  }

  return { ...event, _stats: { totalGuests: 0, dietary: [] } };
};

export const PlanningManager = () => {
  const [view, setView] = useState<ViewMode>('DAY');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  // Load Data
  useEffect(() => {
    const allEvents = calendarRepo.getAll();
    const allReservations = bookingRepo.getAll();
    
    // Enrich events
    const enriched = allEvents.map(e => enrichEvent(e, allReservations));
    // Sort by time, guarding against undefined times
    enriched.sort((a, b) => (a.times?.start || '00:00').localeCompare(b.times?.start || '00:00'));
    
    setEvents(enriched);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const navigateDate = (days: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
  };

  // --- VIEWS ---

  const DayView = () => {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayEvents = events.filter(e => e.date === dateStr);

    return (
      <div className="space-y-6">
        <div className="print:hidden flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
           <div className="flex items-center space-x-4">
             <button onClick={() => navigateDate(-1)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><ChevronLeft size={20}/></button>
             <h2 className="text-xl font-serif text-white font-bold capitalize w-48 text-center">
               {currentDate.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
             </h2>
             <button onClick={() => navigateDate(1)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><ChevronRight size={20}/></button>
           </div>
           <div className="text-sm text-slate-500 font-mono">{dateStr}</div>
        </div>

        {/* Printable Area */}
        <div className="bg-white text-black min-h-[297mm] p-8 shadow-2xl print:shadow-none print:w-full print:h-auto print:min-h-0 print:p-0">
           <div className="border-b-2 border-black pb-4 mb-8 flex justify-between items-end">
             <div>
               <h1 className="text-4xl font-serif font-bold uppercase tracking-tight">Dagplanning</h1>
               <p className="text-xl mt-1 capitalize">{currentDate.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
             </div>
             <div className="text-right">
               <p className="font-bold">Inspiration Point</p>
               <p className="text-sm text-gray-600">Gegenereerd: {new Date().toLocaleTimeString()}</p>
             </div>
           </div>

           {dayEvents.length === 0 ? (
             <div className="text-center py-20 text-gray-400 italic text-xl">Geen activiteiten gepland voor vandaag.</div>
           ) : (
             <div className="space-y-6">
               {dayEvents.map((event, idx) => {
                 const typeColor = 
                   event.type === 'SHOW' ? 'border-l-8 border-l-amber-500' :
                   event.type === 'PRIVATE_EVENT' ? 'border-l-8 border-l-purple-500' :
                   event.type === 'REHEARSAL' ? 'border-l-8 border-l-blue-500' : 'border-l-8 border-l-gray-500';

                 return (
                   <div key={event.id} className={`flex gap-6 p-4 border border-gray-200 bg-gray-50 ${typeColor} break-inside-avoid`}>
                      {/* Time Column */}
                      <div className="w-32 shrink-0 border-r border-gray-300 pr-6 text-right">
                        <div className="font-mono text-2xl font-bold">{event.times?.start || '-'}</div>
                        {event.times?.end && <div className="text-gray-500 text-sm font-mono">- {event.times.end}</div>}
                        {event.type === 'SHOW' && <div className="mt-2 text-xs font-bold uppercase text-amber-600">Deur: {event.times?.doorsOpen}</div>}
                      </div>

                      {/* Content Column */}
                      <div className="flex-grow">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-black text-white mb-1">
                              {event.type.replace('_', ' ')}
                            </span>
                            <h3 className="text-2xl font-bold">{event.title}</h3>
                          </div>
                          {event.type !== 'REHEARSAL' && (
                            <div className="text-right">
                              <span className="block text-2xl font-bold">{event._stats.totalGuests}</span>
                              <span className="text-xs uppercase font-bold text-gray-500">Gasten</span>
                            </div>
                          )}
                        </div>

                        {/* Specific Details */}
                        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                           {/* Left details */}
                           <div>
                             {event.type === 'SHOW' && (
                               <div className="space-y-1">
                                 <p><strong>Status:</strong> {event.status}</p>
                                 <p><strong>Capaciteit:</strong> {event.capacity}</p>
                                 {event._stats.merchCount > 0 && <p className="text-blue-600 font-bold">Merchandise Sales: {event._stats.merchCount} items</p>}
                               </div>
                             )}
                             {event.type === 'PRIVATE_EVENT' && (
                               <div className="space-y-1">
                                 <p><strong>Klant:</strong> {(event as PrivateEvent).companyName || (event as PrivateEvent).contactName}</p>
                                 <p><strong>Contact:</strong> {(event as PrivateEvent).contactPhone}</p>
                                 <p><strong>Model:</strong> {(event as PrivateEvent).pricingModel}</p>
                               </div>
                             )}
                             {event.type === 'REHEARSAL' && (
                               <div className="space-y-1">
                                 <p><strong>Locatie:</strong> {(event as RehearsalEvent).location || 'Main Hall'}</p>
                                 <p><strong>Teams:</strong> {(event as RehearsalEvent).team.join(', ')}</p>
                               </div>
                             )}
                           </div>

                           {/* Right details (Notes) */}
                           <div className="bg-white p-3 border border-gray-200 rounded">
                             <p className="text-xs font-bold uppercase text-gray-400 mb-1">Notities / Bijzonderheden</p>
                             
                             {event.type === 'PRIVATE_EVENT' ? (
                               <PreferencesSummary data={(event as PrivateEvent).preferences} variant="compact" />
                             ) : (
                               <>
                                 {event._stats.dietary && event._stats.dietary.length > 0 ? (
                                   <ul className="list-disc pl-4 text-xs space-y-0.5">
                                     {event._stats.dietary.map((d: string, i: number) => <li key={i}>{d}</li>)}
                                   </ul>
                                 ) : (
                                   <p className="text-xs italic text-gray-400">Geen bijzonderheden.</p>
                                 )}
                                 {event.type === 'REHEARSAL' && (event as RehearsalEvent).notes && (
                                   <p className="text-xs mt-2 italic">"{(event as RehearsalEvent).notes}"</p>
                                 )}
                               </>
                             )}
                           </div>
                        </div>
                      </div>
                   </div>
                 );
               })}
             </div>
           )}
        </div>
      </div>
    );
  };

  const WeekView = () => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    startOfWeek.setDate(diff);

    const weekDates = Array.from({length: 7}, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      return d;
    });

    return (
      <div className="space-y-6">
        <div className="print:hidden flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
           <div className="flex items-center space-x-4">
             <button onClick={() => navigateDate(-7)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><ChevronLeft size={20}/></button>
             <h2 className="text-xl font-serif text-white font-bold capitalize w-48 text-center">
               Week {getWeekNumber(currentDate)}
             </h2>
             <button onClick={() => navigateDate(7)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><ChevronRight size={20}/></button>
           </div>
        </div>

        {/* Printable Week */}
        <div className="bg-white text-black min-h-[297mm] p-4 shadow-2xl print:shadow-none print:w-full print:h-auto print:min-h-0 print:p-0 print:landscape:w-full">
           <div className="text-center border-b-2 border-black pb-4 mb-4">
             <h1 className="text-3xl font-serif font-bold uppercase">Weekplanning</h1>
             <p className="text-lg">Week {getWeekNumber(currentDate)} • {weekDates[0].toLocaleDateString()} - {weekDates[6].toLocaleDateString()}</p>
           </div>

           <div className="grid grid-cols-7 border-l border-t border-black">
             {weekDates.map(date => {
               const dateStr = date.toISOString().split('T')[0];
               const dayEvents = events.filter(e => e.date === dateStr);
               
               return (
                 <div key={dateStr} className="border-r border-b border-black min-h-[200px] flex flex-col">
                   <div className="bg-gray-100 p-2 text-center border-b border-gray-300">
                     <div className="font-bold uppercase text-xs">{date.toLocaleDateString('nl-NL', { weekday: 'short' })}</div>
                     <div className="text-xl font-bold">{date.getDate()}</div>
                   </div>
                   <div className="p-2 space-y-2 flex-grow">
                     {dayEvents.map(e => (
                       <div key={e.id} className={`p-1.5 rounded text-xs border ${
                         e.type === 'SHOW' ? 'bg-amber-100 border-amber-300' : 
                         e.type === 'PRIVATE_EVENT' ? 'bg-purple-100 border-purple-300' :
                         e.type === 'REHEARSAL' ? 'bg-blue-100 border-blue-300' : 'bg-gray-100 border-gray-300'
                       }`}>
                         <div className="font-bold">{e.times?.start || '-'}</div>
                         <div className="truncate font-medium">{e.title}</div>
                         {e._stats.totalGuests > 0 && <div className="mt-1 font-bold text-gray-600">{e._stats.totalGuests}p</div>}
                       </div>
                     ))}
                   </div>
                 </div>
               );
             })}
           </div>
        </div>
      </div>
    );
  };

  const MonthView = () => {
    // Simplified month grid logic
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Mon start

    const cells = [];
    for(let i=0; i<startOffset; i++) cells.push(null);
    for(let i=1; i<=daysInMonth; i++) cells.push(new Date(year, month, i));

    return (
      <div className="space-y-6">
        <div className="print:hidden flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
           <div className="flex items-center space-x-4">
             <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><ChevronLeft size={20}/></button>
             <h2 className="text-xl font-serif text-white font-bold capitalize w-48 text-center">
               {currentDate.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}
             </h2>
             <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><ChevronRight size={20}/></button>
           </div>
        </div>

        <div className="bg-white text-black min-h-[297mm] p-8 shadow-2xl print:shadow-none print:w-full print:h-auto print:min-h-0 print:p-0">
           <h1 className="text-4xl font-serif font-bold uppercase mb-6 text-center border-b-2 border-black pb-4">
             {currentDate.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}
           </h1>

           <div className="grid grid-cols-7 border-t border-l border-black text-sm">
             {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map(d => (
               <div key={d} className="p-2 font-bold bg-gray-100 text-center border-r border-b border-black uppercase">{d}</div>
             ))}
             
             {cells.map((date, idx) => {
               if (!date) return <div key={`empty-${idx}`} className="border-r border-b border-black bg-gray-50"></div>;
               
               const dateStr = date.toISOString().split('T')[0];
               const dayEvents = events.filter(e => e.date === dateStr);

               return (
                 <div key={dateStr} className="border-r border-b border-black h-32 p-1 relative">
                   <span className="absolute top-1 right-2 font-bold text-lg">{date.getDate()}</span>
                   <div className="mt-6 space-y-1">
                     {dayEvents.map(e => (
                       <div key={e.id} className={`text-[10px] px-1 rounded truncate font-bold ${
                         e.type === 'SHOW' ? 'text-amber-800 bg-amber-100' :
                         e.type === 'PRIVATE_EVENT' ? 'text-purple-800 bg-purple-100' :
                         e.type === 'REHEARSAL' ? 'text-blue-800 bg-blue-100' : 'text-gray-600 bg-gray-200'
                       }`}>
                         {e.times?.start} {e.title}
                       </div>
                     ))}
                   </div>
                 </div>
               );
             })}
           </div>
        </div>
      </div>
    );
  };

  const CallSheetView = () => {
    if (!selectedEvent) return (
      <div className="p-12 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
        <FileText size={32} className="mx-auto mb-4 opacity-50"/>
        <p>Selecteer eerst een event om de call sheet te bekijken.</p>
        <Button variant="secondary" onClick={() => setView('DAY')} className="mt-4">Terug naar Agenda</Button>
      </div>
    );

    const e = selectedEvent;

    return (
      <div>
        <div className="print:hidden mb-4">
          <Button variant="ghost" onClick={() => { setSelectedEvent(null); setView('DAY'); }} className="flex items-center text-slate-400 hover:text-white">
            <ChevronLeft size={16} className="mr-2"/> Terug
          </Button>
        </div>

        <div className="bg-white text-black max-w-[210mm] mx-auto min-h-[297mm] p-12 shadow-2xl print:shadow-none print:w-full print:h-auto print:min-h-0 print:p-0 print:m-0">
           {/* Header */}
           <div className="flex justify-between items-start border-b-4 border-black pb-6 mb-8">
             <div>
               <h1 className="text-5xl font-serif font-black uppercase tracking-tight mb-2">{e.title}</h1>
               <div className="flex items-center space-x-4 text-xl">
                 <span className="font-bold">{new Date(e.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                 <span className="px-3 py-0.5 bg-black text-white text-sm font-bold uppercase rounded-full">{e.type}</span>
               </div>
             </div>
             <div className="text-right">
               <div className="text-6xl font-black font-mono">{e.times?.start || 'N/A'}</div>
               <div className="text-sm font-bold uppercase tracking-widest text-gray-500">Aanvang</div>
             </div>
           </div>

           {/* Grid Layout */}
           <div className="grid grid-cols-2 gap-12">
             
             {/* Left Column: Schedule & Operations */}
             <div className="space-y-8">
               <section>
                 <h3 className="text-lg font-bold uppercase border-b-2 border-gray-200 pb-2 mb-4 flex items-center"><Clock size={20} className="mr-2"/> Tijdschema</h3>
                 <div className="space-y-0 text-sm">
                   {e.times?.doorsOpen && (
                     <div className="flex justify-between py-2 border-b border-gray-100">
                       <span className="font-bold text-gray-600">Deuren Open</span>
                       <span className="font-mono font-bold text-lg">{e.times.doorsOpen}</span>
                     </div>
                   )}
                   <div className="flex justify-between py-2 border-b border-gray-100 bg-gray-50 px-2 -mx-2">
                     <span className="font-bold text-black">START PROGRAMMA</span>
                     <span className="font-mono font-bold text-lg">{e.times?.start}</span>
                   </div>
                   {e.times?.end && (
                     <div className="flex justify-between py-2 border-b border-gray-100">
                       <span className="font-bold text-gray-600">Einde</span>
                       <span className="font-mono font-bold text-lg">{e.times.end}</span>
                     </div>
                   )}
                 </div>
               </section>

               <section>
                 <h3 className="text-lg font-bold uppercase border-b-2 border-gray-200 pb-2 mb-4 flex items-center"><Briefcase size={20} className="mr-2"/> Operationeel</h3>
                 <div className="text-sm space-y-4">
                   {e.type === 'REHEARSAL' && (
                     <div>
                       <p className="font-bold text-gray-500 text-xs uppercase">Team</p>
                       <p className="font-medium">{(e as RehearsalEvent).team.join(', ') || 'Alle'}</p>
                     </div>
                   )}
                   {e.type === 'PRIVATE_EVENT' && (
                     <div>
                       <p className="font-bold text-gray-500 text-xs uppercase">Klant Contact</p>
                       <p className="font-bold">{(e as PrivateEvent).contactName}</p>
                       <p>{(e as PrivateEvent).contactPhone}</p>
                       <p>{(e as PrivateEvent).contactEmail}</p>
                     </div>
                   )}
                   <div>
                     <p className="font-bold text-gray-500 text-xs uppercase">Locatie / Zaal</p>
                     <p className="font-medium">{(e as any).location || 'Main Theater Hall'}</p>
                   </div>
                 </div>
               </section>
             </div>

             {/* Right Column: Guests & F&B */}
             <div className="space-y-8">
               <section>
                 <h3 className="text-lg font-bold uppercase border-b-2 border-gray-200 pb-2 mb-4 flex items-center"><Users size={20} className="mr-2"/> Gasten & Capaciteit</h3>
                 <div className="flex items-center justify-between bg-black text-white p-4 rounded-lg mb-4">
                    <span className="font-bold uppercase text-sm">Verwacht Aantal</span>
                    <span className="text-4xl font-black">{e._stats.totalGuests}</span>
                 </div>
                 {e.type === 'SHOW' && (
                   <div className="grid grid-cols-2 gap-4 text-center">
                     <div className="p-3 bg-gray-100 rounded">
                       <span className="block text-2xl font-bold">{e.capacity}</span>
                       <span className="text-[10px] uppercase font-bold text-gray-500">Capaciteit</span>
                     </div>
                     <div className="p-3 bg-gray-100 rounded">
                       <span className="block text-2xl font-bold">{Math.round((e._stats.totalGuests / e.capacity)*100)}%</span>
                       <span className="text-[10px] uppercase font-bold text-gray-500">Bezetting</span>
                     </div>
                   </div>
                 )}
               </section>

               <section>
                 <h3 className="text-lg font-bold uppercase border-b-2 border-gray-200 pb-2 mb-4 flex items-center"><AlertCircle size={20} className="mr-2"/> Bijzonderheden</h3>
                 
                 {e.type === 'PRIVATE_EVENT' ? (
                   <PreferencesSummary data={(e as PrivateEvent).preferences} variant="full" />
                 ) : (
                   <>
                     {e._stats.dietary.length > 0 ? (
                       <div className="bg-red-50 border-l-4 border-red-500 p-4">
                         <p className="font-bold text-red-700 text-xs uppercase mb-2">Dieetwensen & Allergieën</p>
                         <ul className="list-disc pl-4 space-y-1 text-sm font-medium">
                           {e._stats.dietary.map((d: string, i: number) => <li key={i}>{d}</li>)}
                         </ul>
                       </div>
                     ) : (
                       <p className="text-gray-400 italic text-sm">Geen dieetwensen geregistreerd.</p>
                     )}

                     {(e as any).notes && (
                       <div className="mt-4 p-4 bg-gray-100 rounded text-sm italic">
                         "{(e as any).notes}"
                       </div>
                     )}
                   </>
                 )}
               </section>
             </div>
           </div>

           {/* Footer Area for Notes */}
           <div className="mt-12 pt-8 border-t-2 border-dashed border-gray-300">
             <h4 className="font-bold text-gray-400 uppercase text-xs mb-12">Ruimte voor notities</h4>
             <div className="h-px bg-gray-200 mb-8"></div>
             <div className="h-px bg-gray-200 mb-8"></div>
             <div className="h-px bg-gray-200 mb-8"></div>
           </div>
        </div>
      </div>
    );
  };

  // --- HELPER ---
  const getWeekNumber = (d: Date) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil(( ( (d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Top Control Bar */}
      <div className="print:hidden flex justify-between items-end bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-3xl font-serif text-white">Planning & Print</h2>
          <p className="text-slate-500 text-sm">Genereer dagstaten, weekschema's en call sheets.</p>
        </div>
        <div className="flex space-x-3 items-center">
           <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
             <button onClick={() => setView('DAY')} className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all ${view === 'DAY' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>Dag</button>
             <button onClick={() => setView('WEEK')} className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all ${view === 'WEEK' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>Week</button>
             <button onClick={() => setView('MONTH')} className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all ${view === 'MONTH' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>Maand</button>
           </div>
           <Input 
             type="date" 
             value={currentDate.toISOString().split('T')[0]} 
             onChange={(e: any) => setCurrentDate(new Date(e.target.value))} 
             className="bg-slate-950 border-slate-800 text-white h-[42px]"
           />
           <Button onClick={handlePrint} className="flex items-center"><Printer size={18} className="mr-2"/> Afdrukken</Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow overflow-y-auto custom-scrollbar">
        {view === 'DAY' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:block">
            {/* Sidebar List for Selection (Screen Only) */}
            <div className="lg:col-span-1 space-y-4 print:hidden">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Selecteer Event voor Call Sheet</h3>
              <div className="space-y-3">
                {events.filter(e => e.date === currentDate.toISOString().split('T')[0]).length === 0 && (
                  <p className="text-slate-500 italic text-sm">Geen events vandaag.</p>
                )}
                {events.filter(e => e.date === currentDate.toISOString().split('T')[0]).map(e => (
                  <div 
                    key={e.id} 
                    onClick={() => { setSelectedEvent(e); setView('SHEET'); }}
                    className="p-4 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-amber-500 transition-colors group"
                  >
                    <div className="flex justify-between items-start">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        e.type === 'SHOW' ? 'bg-amber-900/20 text-amber-500' : 
                        e.type === 'PRIVATE_EVENT' ? 'bg-purple-900/20 text-purple-500' : 'bg-blue-900/20 text-blue-500'
                      }`}>
                        {e.type}
                      </span>
                      <ChevronRight size={16} className="text-slate-600 group-hover:text-white"/>
                    </div>
                    <h4 className="font-bold text-white mt-2">{e.title}</h4>
                    <p className="text-xs text-slate-400 font-mono mt-1">{e.times?.start || '-'} - {e.times?.end || '?'}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Main Preview */}
            <div className="lg:col-span-2 print:w-full">
              <DayView />
            </div>
          </div>
        )}

        {view === 'WEEK' && <WeekView />}
        {view === 'MONTH' && <MonthView />}
        {view === 'SHEET' && <CallSheetView />}
      </div>
    </div>
  );
};
