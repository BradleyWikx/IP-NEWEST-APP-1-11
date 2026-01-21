import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, Printer, ChevronLeft, ChevronRight, 
  Clock, Users, CheckCircle2, AlertCircle, ShoppingBag, 
  Utensils, CalendarDays, BarChart3, AlertTriangle, FileText,
  Euro, Wine, Music, Tag, UserCheck, CreditCard, PartyPopper,
  ArrowUpDown
} from 'lucide-react';
import { Button, Card, Input, Badge } from '../UI';
import { bookingRepo, calendarRepo, waitlistRepo, getShowDefinitions, getMerchandise } from '../../utils/storage';
import { Reservation, BookingStatus, CalendarEvent, ShowDefinition, MerchandiseItem, ShowEvent } from '../../types';
import { formatCurrency, formatGuestName } from '../../utils/formatters';
import { getEffectivePricing } from '../../utils/pricing';
import { toLocalISOString } from '../../utils/dateHelpers';

type Tab = 'DAY' | 'WEEK' | 'FORECAST';
type SortMode = 'TABLE' | 'NAME' | 'TIME';

const getMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); 
  return new Date(date.setDate(diff));
};

const isOperational = (status: BookingStatus) => {
  return [BookingStatus.CONFIRMED, BookingStatus.ARRIVED, BookingStatus.INVITED].includes(status);
};

export const PlanningManager = () => {
  const [activeTab, setActiveTab] = useState<Tab>('DAY');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [sortMode, setSortMode] = useState<SortMode>('NAME');
  
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [shows, setShows] = useState<ShowDefinition[]>([]);
  const [merchItems, setMerchItems] = useState<MerchandiseItem[]>([]);

  useEffect(() => {
    loadData();
    window.addEventListener('storage-update', loadData);
    return () => window.removeEventListener('storage-update', loadData);
  }, []);

  const loadData = () => {
    setReservations(bookingRepo.getAll());
    setEvents(calendarRepo.getAll());
    setShows(getShowDefinitions());
    setMerchItems(getMerchandise());
  };

  const handlePrint = () => window.print();

  // (Printing logic omitted for brevity, assumed unchanged from previous, focusing on render updates)
  // ... handlePrintCallSheet, handlePrintBarList ...

  const shiftDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) setSelectedDate(new Date(e.target.value));
  };

  const dateStr = toLocalISOString(selectedDate);
  const dailyEvent = events.find(e => e.date === dateStr);
  const showDef = dailyEvent && dailyEvent.type === 'SHOW' ? shows.find(s => s.id === (dailyEvent as any).showId) : null;
  const dailyPricing = (dailyEvent && showDef && dailyEvent.type === 'SHOW') ? getEffectivePricing(dailyEvent as ShowEvent, showDef) : null;

  const dailyList = useMemo(() => {
    const raw = reservations.filter(r => r.date === dateStr && isOperational(r.status));
    
    return raw.sort((a, b) => {
       if (sortMode === 'NAME') return a.customer.lastName.localeCompare(b.customer.lastName);
       if (sortMode === 'TABLE') {
           const tA = a.tableId ? parseInt(a.tableId.replace('TAB-', '')) : 999;
           const tB = b.tableId ? parseInt(b.tableId.replace('TAB-', '')) : 999;
           return tA - tB;
       }
       if (sortMode === 'TIME') {
           return (a.startTime || '00:00').localeCompare(b.startTime || '00:00');
       }
       return 0;
    }).map(r => ({
        ...r,
        displayTable: r.tableId ? r.tableId.replace('TAB-', '') : '?',
        isUnassigned: !r.tableId || r.tableId === 'TAB-?'
    }));
  }, [reservations, dateStr, sortMode]);

  const stats = useMemo(() => {
    return {
      totalPax: dailyList.reduce((s, r) => s + r.partySize, 0),
      premiumPax: dailyList.filter(r => r.packageType === 'premium').reduce((s, r) => s + r.partySize, 0),
      dietaryCount: dailyList.filter(r => r.notes.dietary).length,
      revenueOpen: dailyList.reduce((s, r) => s + (r.financials.isPaid ? 0 : (r.financials.finalTotal - r.financials.paid)), 0),
      merchCount: dailyList.reduce((s, r) => s + r.merchandise.length, 0)
    };
  }, [dailyList]);

  // (Week overview logic omitted for brevity, same as existing)

  return (
    <div className="h-full flex flex-col space-y-6">
      
      {/* 1. SCREEN HEADER (Hidden on Print) */}
      <div className="print:hidden flex flex-col space-y-6">
        <div className="flex justify-between items-end">
           <div>
             <h2 className="text-3xl font-serif text-white">Planning & Productie</h2>
             <p className="text-slate-500 text-sm">Operationele lijsten en draaiboeken.</p>
           </div>
           <div className="flex space-x-3">
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
                <button onClick={() => shiftDate(activeTab === 'WEEK' ? -7 : -1)} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white"><ChevronLeft size={20}/></button>
                <div className="relative group min-w-[160px]">
                    <input type="date" className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-20" value={dateStr} onChange={handleDateInput} />
                    <div className="px-4 font-bold text-white text-sm text-center group-hover:text-amber-500 transition-colors flex items-center justify-center h-full bg-slate-900/50 rounded pointer-events-none">
                      {activeTab === 'WEEK' ? <span>Week van {getMonday(selectedDate).getDate()}</span> : <span>{selectedDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}</span>}
                    </div>
                </div>
                <button onClick={() => shiftDate(activeTab === 'WEEK' ? 7 : 1)} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white"><ChevronRight size={20}/></button>
              </div>
              <Button onClick={handlePrint} className="flex items-center bg-white text-black hover:bg-slate-200 border-none shadow-lg shadow-white/10">
                <Printer size={18} className="mr-2"/> Afdrukken
              </Button>
           </div>
        </div>

        {/* TAB SWITCHER */}
        <div className="flex items-center justify-between border-b border-slate-800">
            <div className="flex space-x-1">
                <button onClick={() => setActiveTab('DAY')} className={`px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'DAY' ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Dagplanning</button>
                <button onClick={() => setActiveTab('WEEK')} className={`px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'WEEK' ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Weekoverzicht</button>
            </div>
            {activeTab === 'DAY' && (
                <div className="flex items-center space-x-2 py-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mr-2">Sorteer:</span>
                    {[{ id: 'TABLE', label: 'Tafel' }, { id: 'NAME', label: 'Naam' }, { id: 'TIME', label: 'Tijd' }].map(opt => (
                        <button key={opt.id} onClick={() => setSortMode(opt.id as SortMode)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-colors ${sortMode === opt.id ? 'bg-amber-500 text-black border-amber-500' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}>{opt.label}</button>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* 2. THE SHEET */}
      {activeTab === 'DAY' && (
      <div className="bg-white text-black shadow-2xl rounded-sm print:shadow-none print:w-full print:static print:h-auto print:overflow-visible">
         <div className="p-8 border-b-4 border-black flex justify-between items-start print:p-6">
            <div>
               <h1 className="text-4xl font-black uppercase tracking-tighter leading-none mb-2">Call Sheet</h1>
               <div className="flex items-center space-x-4 text-sm font-bold uppercase tracking-widest">
                  <span className="bg-black text-white px-2 py-1">{selectedDate.toLocaleDateString('nl-NL', { weekday: 'long' })}</span>
                  <span>{selectedDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
               </div>
            </div>
            <div className="text-right">
               <div className="text-xl font-bold">{showDef?.name || dailyEvent?.title || 'Geen Show'}</div>
               <div className="text-sm text-gray-500 font-mono mt-1">Start: {dailyEvent?.times?.start || '19:30'}</div>
            </div>
         </div>

         {/* MAIN LIST */}
         <div className="p-0">
            <table className="w-full text-left border-collapse">
               <thead className="bg-black text-white text-xs uppercase font-bold">
                  <tr>
                     <th className="p-3 w-20 text-center border-r border-white/20">Tafel</th>
                     <th className="p-3 w-16 text-center border-r border-white/20">Pax</th>
                     <th className="p-3 border-r border-white/20">Gast & Arrangement</th>
                     <th className="p-3 border-r border-white/20 w-1/3">Bijzonderheden</th>
                     <th className="p-3 w-32 text-right">Status</th>
                  </tr>
               </thead>
               <tbody className="text-sm">
                  {dailyList.length === 0 ? (
                     <tr><td colSpan={5} className="p-12 text-center text-gray-400 italic">Geen reserveringen voor vandaag.</td></tr>
                  ) : dailyList.map((res, i) => {
                     const rowBg = i % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                     return (
                        <tr key={res.id} className={`border-b border-gray-300 break-inside-avoid ${rowBg}`}>
                           <td className="p-3 text-center border-r border-gray-300 align-top">
                              {res.isUnassigned ? (
                                <span className="inline-block px-2 py-1 bg-red-100 text-red-600 text-xs font-bold border border-red-200 rounded">UNASSIGNED</span>
                              ) : (
                                <span className="text-2xl font-black text-gray-800">{res.displayTable}</span>
                              )}
                           </td>
                           <td className="p-3 text-center border-r border-gray-300 font-bold text-lg text-black align-top">{res.partySize}</td>
                           <td className="p-3 border-r border-gray-300 align-top">
                              <div className="font-black text-lg text-black uppercase tracking-tight truncate">{formatGuestName(res.customer.firstName, res.customer.lastName)}</div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                 <span className={`text-[10px] px-1.5 py-0.5 font-bold uppercase ${res.packageType === 'premium' ? 'bg-black text-white' : 'border border-black text-black'}`}>{res.packageType}</span>
                              </div>
                           </td>
                           <td className="p-3 border-r border-gray-300 align-top">
                              {res.notes.dietary && <div className="text-red-600 font-bold text-xs uppercase">🍽️ {res.notes.dietary}</div>}
                              {res.notes.comments && <div className="text-xs italic text-gray-600">"{res.notes.comments}"</div>}
                           </td>
                           <td className="p-3 text-right align-top font-mono">
                              {res.financials.isPaid ? <span className="text-gray-400 font-bold text-xs">BETAALD</span> : <span className="text-red-600 font-black text-xs">OPEN €{(res.financials.finalTotal - res.financials.paid).toFixed(2)}</span>}
                           </td>
                        </tr>
                     );
                  })}
               </tbody>
            </table>
         </div>
      </div>
      )}
    </div>
  );
};