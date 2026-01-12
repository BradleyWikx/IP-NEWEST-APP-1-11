
import React, { useState, useEffect } from 'react';
import { useCalendarLogic } from '../hooks/useCalendarLogic';
import { 
  CalendarHeader, CalendarLegend, CalendarGrid, CalendarAgenda 
} from './calendar/CalendarComponents';
import { ResponsiveDrawer, Button, Badge } from './UI';
import { Availability } from '../types';
import { Clock, Star, AlertCircle, Calendar as CalIcon, ChevronRight, Lock, Hourglass } from 'lucide-react';
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
      // Prevent booking if closed
      if (selectedDay.status === 'CLOSED') return;

      if (onSelect) {
        onSelect(selectedDay.dateStr, selectedDay.event.showId, selectedDay.status);
      } else {
        // Navigate with state to trigger Wizard logic
        navigate('/book/wizard', { 
          state: { 
            date: selectedDay.dateStr, 
            showId: selectedDay.event.showId,
            availability: selectedDay.status // Pass calculated status (OPEN or WAITLIST)
          } 
        });
      }
      setSelectedDay(null);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-8 w-full max-w-7xl mx-auto">
      <div className="flex flex-col h-full">
        <div className="mb-6">
          <h1 className="text-3xl font-serif text-white mb-2">Reserveren</h1>
          <p className="text-slate-400 text-sm">Selecteer een datum voor uw avond uit.</p>
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

        <div className="flex-grow overflow-y-auto custom-scrollbar bg-slate-900/50 rounded-2xl border border-slate-800">
          {viewMode === 'GRID' ? (
            <CalendarGrid days={calendarDays} onDayClick={handleDayClick} isDense={isDense} />
          ) : (
            <CalendarAgenda days={calendarDays} onDayClick={handleDayClick} />
          )}
        </div>
      </div>

      {/* Detail Drawer (Mobile Bottom Sheet / Desktop Drawer) */}
      <ResponsiveDrawer
        isOpen={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        title={selectedDay?.show?.name || 'Voorstelling'}
      >
        {selectedDay && selectedDay.event && (
          <div className="space-y-6 pb-20 md:pb-0">
            {/* Hero Image */}
            <div className="relative h-48 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl group">
               {selectedDay.show.posterImage ? (
                 <img 
                   src={selectedDay.show.posterImage} 
                   alt={selectedDay.show.name} 
                   className="absolute inset-0 w-full h-full object-cover"
                 />
               ) : (
                 <div className={`absolute inset-0 bg-gradient-to-br from-${selectedDay.theme.primary}-900 to-black opacity-80`} />
               )}
               <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
               <div className="absolute bottom-4 left-6">
                 {/* Status Badge inside Image */}
                 {selectedDay.status === 'CLOSED' && (
                    <span className="px-3 py-1 rounded-full bg-red-600 text-white text-xs font-bold uppercase tracking-widest shadow-lg flex items-center w-fit mb-2">
                      <Lock size={12} className="mr-1.5" /> Volgeboekt
                    </span>
                 )}
                 {selectedDay.status === 'WAITLIST' && (
                    <span className="px-3 py-1 rounded-full bg-orange-500 text-black text-xs font-bold uppercase tracking-widest shadow-lg flex items-center w-fit mb-2">
                      <Hourglass size={12} className="mr-1.5" /> Wachtlijst Open
                    </span>
                 )}
                 
                 <p className="text-white text-2xl font-serif font-bold leading-none shadow-black drop-shadow-md">{selectedDay.show.name}</p>
               </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3">
               <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                 <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Datum</p>
                 <div className="flex items-center text-white text-sm font-bold">
                   <CalIcon size={14} className="mr-2 text-amber-500" />
                   {selectedDay.date.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}
                 </div>
               </div>
               <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                 <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Tijd</p>
                 <div className="flex items-center text-white text-sm font-bold">
                   <Clock size={14} className="mr-2 text-amber-500" />
                   {selectedDay.event.times?.start || 'N/A'}
                 </div>
               </div>
            </div>

            {/* Description */}
            <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
               <div className="flex items-start space-x-3">
                 <Star className={`text-${selectedDay.theme.primary}-500 mt-0.5 shrink-0`} size={16} />
                 <div>
                   <h4 className="font-bold text-white text-sm">Over de show</h4>
                   <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                     {selectedDay.show.description || 'Geniet van een onvergetelijke avond uit bij Grand Stage.'}
                   </p>
                 </div>
               </div>
            </div>

            {/* Pricing Hint - Hide if closed/waitlist to reduce noise */}
            {selectedDay.status === 'OPEN' && (
                <div className="flex justify-between items-center text-sm px-2">
                <span className="text-slate-400">Vanaf prijs</span>
                <span className="font-serif text-amber-500 text-lg">€{selectedDay.event.pricing?.standard || selectedDay.show.profiles[0].pricing.standard} <span className="text-xs text-slate-500 font-sans">p.p.</span></span>
                </div>
            )}

            {/* Dynamic Actions based on Status */}
            <div className="pt-2">
               {selectedDay.status === 'CLOSED' ? (
                 <div className="space-y-3 animate-in fade-in">
                    <div className="bg-red-900/20 border border-red-900/50 p-4 rounded-xl flex items-start">
                        <Lock size={20} className="text-red-500 mr-3 mt-0.5 shrink-0" />
                        <div>
                            <h4 className="text-red-400 font-bold text-sm">Helaas Volgeboekt</h4>
                            <p className="text-red-300/70 text-xs mt-1">
                                Zowel de zaal als de wachtlijst voor deze datum zitten vol. Probeer een andere datum.
                            </p>
                        </div>
                    </div>
                    <Button disabled className="w-full bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-50">
                        Niet Beschikbaar
                    </Button>
                 </div>
               ) : selectedDay.status === 'WAITLIST' ? (
                 <div className="space-y-3 animate-in fade-in">
                   <div className="bg-amber-900/20 border border-amber-900/50 p-3 rounded-lg flex items-start">
                     <AlertCircle size={16} className="text-amber-500 mr-2 shrink-0 mt-0.5" />
                     <p className="text-xs text-amber-200">
                        <strong>Deze datum is vol.</strong> U kunt zich inschrijven op de wachtlijst. 
                        We nemen contact op zodra er een tafel vrijkomt.
                     </p>
                   </div>
                   <Button onClick={handleBookNow} className="w-full bg-amber-600 hover:bg-amber-700 text-black border-none shadow-lg shadow-amber-900/20">
                     <Hourglass size={18} className="mr-2" /> Inschrijven Wachtlijst
                   </Button>
                 </div>
               ) : (
                 <Button onClick={handleBookNow} className="w-full h-12 text-lg shadow-xl shadow-red-900/20">
                   Start Reservering <ChevronRight size={18} className="ml-2" />
                 </Button>
               )}
            </div>
          </div>
        )}
      </ResponsiveDrawer>
    </div>
  );
};
