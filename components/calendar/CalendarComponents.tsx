
import React from 'react';
import { ChevronLeft, ChevronRight, List, Grid, Clock, Users, Maximize2, Minimize2, CheckCircle2, Lock, Mic, Briefcase, Calendar, AlertCircle, Hourglass, Flame } from 'lucide-react';
import { Badge } from '../UI';
import { ShowEvent } from '../../types';

export interface CalendarDayProps {
  day: any; 
  onClick: (day: any) => void;
  isAdmin?: boolean;
  isDense?: boolean;
  isSelected?: boolean;
  isBulkMode?: boolean;
}

export const CalendarHeader = ({ currentMonth, onPrev, onNext, viewMode, onViewChange, isDense, onToggleDense, isBulkMode, onToggleBulk }: any) => (
  <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
    <div className="flex items-center justify-between w-full md:w-auto md:space-x-4">
      <button onClick={onPrev} className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-slate-800">
        <ChevronLeft size={20} />
      </button>
      <h2 className="text-lg md:text-2xl font-serif text-white capitalize w-40 text-center">
        {currentMonth.toLocaleString('nl-NL', { month: 'long', year: 'numeric' })}
      </h2>
      <button onClick={onNext} className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-slate-800">
        <ChevronRight size={20} />
      </button>
    </div>

    <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
      {onToggleBulk && (
        <button
          onClick={onToggleBulk}
          className={`px-3 py-2 rounded-lg border transition-all text-xs font-bold uppercase tracking-wider flex items-center ${
            isBulkMode 
              ? 'bg-amber-500 border-amber-500 text-black' 
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          {isBulkMode ? <CheckCircle2 size={14} className="mr-2" /> : <Grid size={14} className="mr-2" />}
          {isBulkMode ? 'Klaar' : 'Select'}
        </button>
      )}

      {viewMode === 'GRID' && onToggleDense && (
        <button
          onClick={onToggleDense}
          className={`p-2 rounded-lg border transition-all ${isDense ? 'bg-amber-900/20 border-amber-500/50 text-amber-500' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white'}`}
        >
          {isDense ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
        </button>
      )}

      <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800">
        <button 
          onClick={() => onViewChange('GRID')}
          className={`p-2 rounded flex items-center space-x-2 text-xs font-bold uppercase tracking-wider transition-all ${viewMode === 'GRID' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Grid size={16} /> <span className="hidden md:inline">Maand</span>
        </button>
        <button 
          onClick={() => onViewChange('AGENDA')}
          className={`p-2 rounded flex items-center space-x-2 text-xs font-bold uppercase tracking-wider transition-all ${viewMode === 'AGENDA' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <List size={16} /> <span className="hidden md:inline">Lijst</span>
        </button>
      </div>
    </div>
  </div>
);

export const CalendarLegend = () => (
  <div className="flex flex-wrap gap-4 mb-4 text-[10px] uppercase font-bold tracking-widest text-slate-500 px-2">
    <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-emerald-500 mr-2"/> Beschikbaar</div>
    <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-orange-500 mr-2"/> Wachtlijst</div>
    <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-red-500 mr-2"/> Vol</div>
    <div className="flex items-center"><span className="text-amber-500 mr-1">🔥</span> Laatste Plekken</div>
  </div>
);

export const DateTile: React.FC<CalendarDayProps> = ({ day, onClick, isAdmin, isDense, isSelected, isBulkMode }) => {
  const { date, isCurrentMonth, isToday, isPast, event, show, status, theme, waitlistCount } = day;
  
  // Past dates are dimmed heavily.
  const opacity = isPast 
    ? 'opacity-20 grayscale pointer-events-none' 
    : (isCurrentMonth ? 'opacity-100' : 'opacity-30 grayscale');

  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const isShow = event?.type === 'SHOW';
  
  const heightClass = isDense ? 'min-h-[70px] md:min-h-[90px]' : 'min-h-[80px] md:min-h-[120px]';
  const hoverClass = !isBulkMode && !isPast ? (event || isAdmin ? 'cursor-pointer hover:border-slate-500 transition-all' : 'cursor-default') : '';
  
  // Calculate Occupancy Ratio
  const booked = (event as any)?.bookedCount || 0;
  const capacity = (event as any)?.capacity || 230;
  const occupancy = capacity > 0 ? booked / capacity : 0;
  const isAlmostFull = isShow && status === 'OPEN' && occupancy > 0.8;

  // --- HEATMAP LOGIC ---
  let heatmapBg = isToday ? 'bg-slate-900 ring-1 ring-amber-500 z-10' : (isWeekend && !isToday ? 'bg-black/40' : 'bg-slate-900/30');
  
  if (isAdmin && isShow && event) {
    if (status === 'CLOSED') {
        heatmapBg = 'bg-red-950/20'; // Closed manually
    } else if (occupancy > 0.9) {
        heatmapBg = 'bg-red-900/30'; // Full/High
    } else if (occupancy > 0.5) {
        heatmapBg = 'bg-amber-900/20'; // Medium
    } else {
        heatmapBg = 'bg-emerald-900/10'; // Low
    }
  }
  
  const finalBg = isBulkMode ? (isSelected ? 'bg-amber-900/30' : 'bg-slate-950/80') : heatmapBg;
  
  // Status Logic for Borders & Badges
  let finalBorder = isSelected ? 'border-amber-500' : 'border-slate-800/50';
  let accentBorder = 'border-l border-l-transparent';
  let badge = null;
  let textOpacity = '';

  if (isShow && show && !isBulkMode) {
    if (status === 'WAITLIST') {
      accentBorder = 'border-l-4 border-l-orange-500';
      badge = (
        <div className="absolute top-0 right-0 bg-orange-600 text-white text-[8px] md:text-[9px] px-1.5 py-0.5 rounded-bl-lg font-bold uppercase tracking-wider z-20 shadow-md">
          Wachtlijst
        </div>
      );
    } else if (status === 'CLOSED') {
      accentBorder = 'border-l-4 border-l-red-600';
      textOpacity = 'opacity-60 grayscale-[0.5]'; 
      badge = (
        <div className="absolute top-0 right-0 bg-red-600 text-white text-[8px] md:text-[9px] px-2 py-0.5 rounded-bl-lg font-bold uppercase tracking-wider z-20 shadow-md">
          VOL
        </div>
      );
    } else if (status === 'OPEN') {
      accentBorder = `border-l-2 border-l-${theme.primary}-500`;
      
      if (isAlmostFull) {
        badge = (
          <div className="absolute top-0 right-0 bg-amber-500 text-black text-[8px] md:text-[9px] px-2 py-0.5 rounded-bl-lg font-bold uppercase tracking-wider z-20 shadow-md flex items-center animate-pulse">
            <Flame size={8} className="mr-1" fill="currentColor"/> Bijna Vol
          </div>
        );
      }
    }
  }

  // Capacity Logic for Admins
  let capacityBar = null;
  let capacityText = null;

  if (isAdmin && isShow && event) {
    const pct = Math.min(100, occupancy * 100);
    
    let barColor = 'bg-emerald-500';
    if (pct > 50) barColor = 'bg-amber-500';
    if (pct > 90) barColor = 'bg-red-500';
    if (booked > capacity) barColor = 'bg-purple-500';

    capacityBar = (
      <div className="w-full h-1 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
        <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    );

    capacityText = (
      <div className={`text-[9px] font-mono mt-0.5 flex justify-between items-center ${pct > 90 ? 'text-red-400 font-bold' : 'text-slate-500'}`}>
        <span>{booked}/{capacity}</span>
        
        {waitlistCount > 0 && (
          <div className={`flex items-center space-x-1 ${waitlistCount >= 10 ? 'text-red-500' : 'text-orange-500'}`}>
            <Hourglass size={10} />
            <span>{waitlistCount}</span>
          </div>
        )}
      </div>
    );
  }

  if (!isAdmin && event && !isShow) return (
    <div className={`relative ${heightClass} p-2 border-b border-r border-slate-800/30 bg-black/60 flex flex-col`}>
        <span className="text-xs font-bold text-slate-600">{date.getDate()}</span>
    </div>
  );

  return (
    <div 
      onClick={() => !isPast && onClick(day)}
      className={`
        relative ${heightClass} p-2 border-b border-r flex flex-col justify-between transition-all duration-200 overflow-hidden
        ${opacity} ${finalBg} ${finalBorder} ${hoverClass} ${accentBorder}
      `}
    >
      {badge}

      <div className="flex justify-between items-start relative z-10">
        <span className={`text-xs font-bold ${isSelected ? 'text-amber-500' : isToday ? 'text-amber-500 scale-110' : 'text-slate-400'}`}>
          {date.getDate()}
        </span>
        {isBulkMode && isSelected && <div className="bg-amber-500 text-black rounded-full p-0.5"><CheckCircle2 size={12} strokeWidth={4} /></div>}
      </div>

      {event && isShow && show && (
        <div className={`mt-1 flex-grow flex flex-col justify-end ${textOpacity}`}>
          <div className={`font-black uppercase tracking-tight leading-none text-${theme.primary}-400 line-clamp-2 ${isDense ? 'text-[8px]' : 'text-[10px]'}`}>
            {show.name}
          </div>
          
          {isAdmin ? (
            <>
              {capacityBar}
              {capacityText}
            </>
          ) : (
            !isDense && (
              <div className="flex justify-between items-end mt-1">
                 <span className="text-[9px] text-slate-500 font-mono">{event.times?.start || 'N/A'}</span>
              </div>
            )
          )}
        </div>
      )}
      
      {isAdmin && !isShow && event && (
         <div className="mt-auto text-[8px] font-bold text-slate-500 uppercase">{event.type}</div>
      )}
    </div>
  );
};

export const AgendaItem: React.FC<CalendarDayProps> = ({ day, onClick, isAdmin }) => {
  const { date, event, show, theme, status, waitlistCount, isPast } = day;
  
  const isShow = event?.type === 'SHOW';
  // Filter out past events in agenda view for non-admins (though hook handles this too)
  if (!event || (!isAdmin && (!isShow || isPast))) return null;

  const dayName = date.toLocaleDateString('nl-NL', { weekday: 'short' });
  const dayNum = date.getDate();

  const booked = (event as any).bookedCount || 0;
  const capacity = (event as any).capacity || 0;
  const pct = capacity > 0 ? Math.round((booked / capacity) * 100) : 0;
  const isAlmostFull = isShow && status === 'OPEN' && (booked / capacity) > 0.8;

  return (
    <div 
      onClick={() => onClick(day)}
      className="flex items-center p-4 border-b border-slate-800 last:border-0 hover:bg-slate-800/50 transition-colors cursor-pointer group"
    >
      <div className="flex flex-col items-center w-12 mr-4 shrink-0 border-r border-slate-800 pr-4">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{dayName}</span>
        <span className="text-xl font-serif text-white group-hover:text-amber-500 transition-colors">{dayNum}</span>
      </div>

      <div className="flex-grow min-w-0">
        {isShow ? (
          <>
            <h3 className="font-bold text-white truncate text-sm mb-1">{show?.name}</h3>
            <div className="flex items-center text-xs text-slate-400">
              <Clock size={12} className="mr-1.5 text-slate-500"/> 
              <span className="font-mono">{event.times?.start || 'N/A'}</span>
              <span className="mx-2 text-slate-700">|</span>
              <span className="truncate">{event.title}</span>
            </div>
          </>
        ) : (
          <div className="text-sm text-slate-500 font-bold">{event.title}</div>
        )}
      </div>

      {isAdmin && isShow && (
        <div className="shrink-0 w-32 mr-4 hidden sm:block">
           <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 mb-1">
             <span>Bezetting</span>
             <div className="flex items-center">
                <span className={pct > 90 ? 'text-red-500' : 'text-slate-300'}>{booked}/{capacity}</span>
                {waitlistCount > 0 && <span className="ml-2 text-orange-500 flex items-center"><Hourglass size={10} className="mr-0.5"/> {waitlistCount}</span>}
             </div>
           </div>
           <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
             <div className={`h-full ${pct > 90 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
           </div>
        </div>
      )}

      <div className="shrink-0 ml-2">
        {isShow ? (
          status === 'OPEN' ? (
            isAlmostFull ? (
                <span className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-[10px] font-bold uppercase border border-amber-600 flex items-center animate-pulse">
                    <Flame size={10} className="mr-1" /> Laatste
                </span>
            ) : (
                <span className="px-3 py-1.5 rounded-lg bg-emerald-900/20 text-emerald-500 text-[10px] font-bold uppercase border border-emerald-900/50">
                Boek
                </span>
            )
          ) : status === 'WAITLIST' ? (
            <span className="px-3 py-1.5 rounded-lg bg-orange-900/20 text-orange-500 text-[10px] font-bold uppercase border border-orange-900/50 flex items-center">
              <AlertCircle size={10} className="mr-1.5"/> Wachtlijst
            </span>
          ) : (
            <span className="px-3 py-1.5 rounded-lg bg-red-900/20 text-red-500 text-[10px] font-bold uppercase border border-red-900/50">
              Vol
            </span>
          )
        ) : (
          <span className="text-[9px] bg-slate-900 border border-slate-700 px-2 py-1 rounded text-slate-500">INTERN</span>
        )}
      </div>
    </div>
  );
};

export const CalendarGrid = ({ days, onDayClick, isAdmin, isDense, isBulkMode, selectedDates }: any) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
    <div className="grid grid-cols-7 bg-slate-950 border-b border-slate-800">
      {/* Changed to Monday start */}
      {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map((d, i) => (
        <div key={d} className={`py-3 text-center text-[10px] font-black uppercase tracking-widest ${i >= 5 ? 'text-slate-700 bg-black/20' : 'text-slate-600'}`}>
          {d}
        </div>
      ))}
    </div>
    <div className="grid grid-cols-7 bg-slate-900 gap-px border-slate-800">
      {days.map((day: any) => (
        <DateTile 
          key={day.dateStr} 
          day={day} 
          onClick={onDayClick} 
          isAdmin={isAdmin} 
          isDense={isDense} 
          isSelected={isBulkMode && selectedDates?.has(day.dateStr)}
          isBulkMode={isBulkMode}
        />
      ))}
    </div>
  </div>
);

export const CalendarAgenda = ({ days, onDayClick, isAdmin }: any) => {
  const listDays = days.filter((d: any) => d.isCurrentMonth);
  // Filter for items that actually have content to show
  // Hook logic ensures past events are undefined for non-admins, effectively filtering them here
  const activeDays = listDays.filter((d: any) => d.event && (isAdmin || d.event.type === 'SHOW'));

  return (
    <div className="divide-y divide-slate-800">
      {activeDays.length === 0 ? (
        <div className="p-12 text-center">
          <Calendar size={32} className="mx-auto text-slate-600 mb-2 opacity-50"/>
          <p className="text-slate-500 text-sm">Geen voorstellingen in deze periode.</p>
        </div>
      ) : (
        activeDays.map((day: any) => (
          <AgendaItem key={day.dateStr} day={day} onClick={onDayClick} isAdmin={isAdmin} />
        ))
      )}
    </div>
  );
};
