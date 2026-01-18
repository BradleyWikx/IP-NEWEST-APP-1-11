
import React, { useState, useEffect } from 'react';
import { useCalendarLogic } from '../hooks/useCalendarLogic';
import { 
  CalendarHeader, CalendarLegend, CalendarGrid, CalendarAgenda 
} from './calendar/CalendarComponents';
import { ResponsiveDrawer, Button, Badge } from './UI';
import { Availability } from '../types';
import { Clock, Star, AlertCircle, Calendar as CalIcon, ChevronRight, Lock, Hourglass, Info, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';

interface CalendarProps {
  onSelect?: (date: string, showId: string, availability: Availability) => void;
  selectedDate?: string;
}

export const CustomerCalendar = ({ onSelect, selectedDate }: CalendarProps) => {
  const { currentMonth, navigateMonth, calendarDays, viewMode, setViewMode, isDense, setIsDense } = useCalendarLogic(selectedDate, 'CUSTOMER');
  const [selectedDay, setSelectedDay] = useState<any>(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Force Agenda view on mobile initial load
  useEffect(() => {
    if (isMobile) setViewMode('AGENDA');
  }, [isMobile]);

  const handleDayClick = (day: any) => {
    if (day.event && day.event.type === 'SHOW') {
      setSelectedDay(day);
    }
  };

  const handleBookNow = () => {
    if (selectedDay && selectedDay.event) {
      // Prevent booking for closed events (waitlist IS allowed)
      if (selectedDay.status === 'CLOSED') return;
      
      // Prevent booking for today (Last Minute Call Only)
      if (selectedDay.isToday) return;

      if (onSelect) {
        onSelect(selectedDay.dateStr, selectedDay.event.showId, selectedDay.status);
      } else {
        // Navigate with state to trigger Wizard logic
        navigate('/book/wizard', { 
          state: { 
            date: selectedDay.dateStr, 
            showId: selectedDay.event.showId,
            availability: selectedDay.status 
          } 
        });
      }
      setSelectedDay(null);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-8 w-full max-w-7xl mx-auto animate-in fade-in duration-700">
      <div className="flex flex-col h-full">
        <div className="mb-8 text-center md:text-left">
          <h1 className="text-4xl font-serif text-white mb-2 tracking-wide">
            Agenda & Tickets
          </h1>
          <p className="text-slate-400 text-sm max-w-md">
            Selecteer een datum voor een onvergetelijke avond uit.
          </p>
        </div>

        <CalendarHeader 
          currentMonth={currentMonth} 
          onPrev={() => navigateMonth(-1)} 
          onNext={() => navigateMonth(1)}
          viewMode={viewMode}
          onViewChange={setViewMode}
          isDense={isDense}
          onToggleDense={() => setIsDense(!isDense)}
        />
        
        {!isMobile && <CalendarLegend />}

        <div className="flex-grow overflow-y-auto custom-scrollbar bg-slate-950/50 backdrop-blur-sm rounded-3xl border border-slate-800 shadow-2xl">
          {viewMode === 'GRID' ? (
            <CalendarGrid days={calendarDays} onDayClick={handleDayClick} isDense={isDense} />
          ) : (
            <CalendarAgenda days={calendarDays} onDayClick={handleDayClick} />
          )}
        </div>
      </div>

      {/* Detail Drawer (Enhanced Visuals) */}
      <ResponsiveDrawer
        isOpen={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        title={selectedDay?.show?.name || 'Voorstelling'}
      >
        {selectedDay && selectedDay.event && (
          <div className="space-y-6 pb-20 md:pb-0 relative">
            
            {/* Hero Banner with Status Overlay */}
            <div className="relative h-56 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl group">
               {selectedDay.show.posterImage ? (
                 <img 
                   src={selectedDay.show.posterImage} 
                   alt={selectedDay.show.name} 
                   className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                 />
               ) : (
                 <div className={`absolute inset-0 bg-gradient-to-br from-${selectedDay.theme.primary}-900 to-black opacity-80`} />
               )}
               
               {/* Gradient Overlay */}
               <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
               
               <div className="absolute bottom-6 left-6 right-6">
                 {/* Status Badge */}
                 <div className="flex items-center justify-between mb-3">
                    {selectedDay.isToday ? (
                        <span className="px-3 py-1 rounded-full bg-blue-600/90 backdrop-blur text-white text-[10px] font-bold uppercase tracking-widest shadow-lg flex items-center">
                        <Clock size={10} className="mr-1.5" /> Laatste Kaarten
                        </span>
                    ) : selectedDay.status === 'CLOSED' ? (
                        <span className="px-3 py-1 rounded-full bg-red-600/90 backdrop-blur text-white text-[10px] font-bold uppercase tracking-widest shadow-lg flex items-center">
                        <Lock size={10} className="mr-1.5" /> Volgeboekt
                        </span>
                    ) : selectedDay.status === 'WAITLIST' ? (
                        <span className="px-3 py-1 rounded-full bg-orange-500/90 backdrop-blur text-black text-[10px] font-bold uppercase tracking-widest shadow-lg flex items-center">
                        <Hourglass size={10} className="mr-1.5" /> Wachtlijst Open
                        </span>
                    ) : (
                        <span className="px-3 py-1 rounded-full bg-emerald-500/90 backdrop-blur text-black text-[10px] font-bold uppercase tracking-widest shadow-lg flex items-center">
                        <Star size={10} className="mr-1.5" /> Beschikbaar
                        </span>
                    )}
                 </div>
                 
                 <h2 className="text-3xl font-serif font-bold text-white leading-none shadow-black drop-shadow-lg">
                    {selectedDay.show.name}
                 </h2>
               </div>
            </div>

            {/* Event Info Grid */}
            <div className="grid grid-cols-2 gap-4">
               <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-center">
                 <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 flex items-center"><CalIcon size={10} className="mr-1"/> Datum</p>
                 <div className="text-white text-sm font-bold capitalize">
                   {selectedDay.date.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'long' })}
                 </div>
               </div>
               <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-center">
                 <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 flex items-center"><Clock size={10} className="mr-1"/> Aanvang</p>
                 <div className="text-white text-sm font-bold">
                   {selectedDay.event.times?.start || '19:30'} uur
                 </div>
               </div>
            </div>

            {/* Description Card */}
            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Star size={64} />
               </div>
               <h4 className="font-bold text-white text-sm mb-2">Over de show</h4>
               <p className="text-slate-400 text-sm leading-relaxed">
                 {selectedDay.show.description || 'Laat u meevoeren in een avond vol culinaire verrassingen en topentertainment.'}
               </p>
            </div>

            {/* Pricing Hint */}
            {selectedDay.status === 'OPEN' && !selectedDay.isToday && (
                <div className="flex justify-between items-end px-2">
                    <div className="text-xs text-slate-500">
                        Arrangementen vanaf
                    </div>
                    <div className="font-serif text-amber-500 text-2xl leading-none">
                        €{selectedDay.event.pricing?.standard || selectedDay.show.profiles[0].pricing.standard} 
                        <span className="text-xs text-slate-500 font-sans ml-1 font-bold">p.p.</span>
                    </div>
                </div>
            )}

            {/* Action Area */}
            <div className="pt-2">
               {selectedDay.isToday ? (
                  <div className="bg-blue-900/10 border border-blue-900/50 p-6 rounded-2xl flex flex-col items-center text-center space-y-4">
                     <div className="p-3 bg-blue-500/20 text-blue-400 rounded-full">
                       <Phone size={24} />
                     </div>
                     <div>
                       <h4 className="text-blue-400 font-bold text-lg mb-1">Online Reserveren Gesloten</h4>
                       <p className="text-blue-200/70 text-sm max-w-xs mx-auto">
                          Voor <strong>vandaag</strong> zijn de online boekingen gesloten. 
                          Neem telefonisch contact op voor de allerlaatste plekken.
                       </p>
                     </div>
                     <a 
                       href="tel:+3112345678" 
                       className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center shadow-lg shadow-blue-900/20 transition-all"
                     >
                        <Phone size={18} className="mr-2"/> Bel Direct
                     </a>
                  </div>
               ) : selectedDay.status === 'CLOSED' ? (
                 <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-2xl flex items-center space-x-4">
                    <div className="p-3 bg-red-900/20 rounded-full text-red-500"><Lock size={20} /></div>
                    <div>
                        <h4 className="text-red-400 font-bold text-sm">Helaas Volgeboekt</h4>
                        <p className="text-red-300/60 text-xs">De wachtlijst voor deze datum is ook vol.</p>
                    </div>
                 </div>
               ) : selectedDay.status === 'WAITLIST' ? (
                 <div className="space-y-4">
                   <div className="bg-amber-900/20 border border-amber-900/50 p-4 rounded-2xl flex items-start space-x-3">
                     <Info size={18} className="text-amber-500 mt-0.5 shrink-0" />
                     <p className="text-xs text-amber-200 leading-relaxed">
                        <strong>Deze datum is populair.</strong> Schrijf u in op de wachtlijst. 
                        Mochten er plaatsen vrijkomen, ontvangt u direct bericht.
                     </p>
                   </div>
                   <Button onClick={handleBookNow} className="w-full bg-amber-600 hover:bg-amber-700 text-black border-none shadow-lg shadow-amber-900/20 h-14 text-sm font-bold uppercase tracking-wider">
                     <Hourglass size={18} className="mr-2" /> Inschrijven Wachtlijst
                   </Button>
                 </div>
               ) : (
                 <Button onClick={handleBookNow} className="w-full h-14 text-lg bg-gradient-to-r from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 shadow-xl shadow-red-900/20 border border-red-500/30">
                   Start Reservering <ChevronRight size={20} className="ml-2" />
                 </Button>
               )}
            </div>
          </div>
        )}
      </ResponsiveDrawer>
    </div>
  );
};
