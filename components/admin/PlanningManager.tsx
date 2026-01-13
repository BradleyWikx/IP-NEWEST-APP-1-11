
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, Printer, ChevronLeft, ChevronRight, 
  Clock, Users, CheckCircle2, AlertCircle, ShoppingBag, 
  Utensils, CalendarDays, BarChart3, AlertTriangle, FileText,
  Euro, Wine, Music, Tag, UserCheck, CreditCard, PartyPopper
} from 'lucide-react';
import { Button, Card, Input, Badge } from '../UI';
import { bookingRepo, calendarRepo, waitlistRepo, getShowDefinitions, getMerchandise } from '../../utils/storage';
import { Reservation, BookingStatus, CalendarEvent, ShowDefinition, MerchandiseItem } from '../../types';
import { formatCurrency, formatGuestName } from '../../utils/formatters';
import { getEffectivePricing } from '../../utils/pricing';

type Tab = 'DAY' | 'WEEK' | 'FORECAST';

// --- HELPER: Local Date String ---
const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- HELPER: Get Monday of current week ---
const getMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  return new Date(date.setDate(diff));
};

// --- HELPER: Operational Status Check ---
const isOperational = (status: BookingStatus) => {
  return [BookingStatus.CONFIRMED, BookingStatus.ARRIVED, BookingStatus.INVITED].includes(status);
};

export const PlanningManager = () => {
  const [activeTab, setActiveTab] = useState<Tab>('DAY');
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Data State
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

  const handlePrint = () => {
    window.print();
  };

  const shiftDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setSelectedDate(new Date(e.target.value));
    }
  };

  // --- DERIVED DATA (DAY) ---
  
  const dateStr = getLocalDateString(selectedDate);
  const dailyEvent = events.find(e => e.date === dateStr);
  const showDef = dailyEvent && dailyEvent.type === 'SHOW' ? shows.find(s => s.id === (dailyEvent as any).showId) : null;
  
  const dailyPricing = (dailyEvent && showDef) ? getEffectivePricing(dailyEvent, showDef) : null;

  const dailyList = useMemo(() => {
    const raw = reservations.filter(r => r.date === dateStr && isOperational(r.status));
    return raw.sort((a, b) => {
       const isVipA = a.packageType === 'premium' || a.tags?.includes('VIP');
       const isVipB = b.packageType === 'premium' || b.tags?.includes('VIP');
       if (isVipA !== isVipB) return isVipA ? -1 : 1;
       return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }).map((r, idx) => ({ ...r, tableNumber: idx + 1 }));
  }, [reservations, dateStr]);

  const stats = useMemo(() => {
    return {
      totalPax: dailyList.reduce((s, r) => s + r.partySize, 0),
      premiumPax: dailyList.filter(r => r.packageType === 'premium').reduce((s, r) => s + r.partySize, 0),
      dietaryCount: dailyList.filter(r => r.notes.dietary).length,
      revenueOpen: dailyList.reduce((s, r) => s + (r.financials.isPaid ? 0 : (r.financials.finalTotal - r.financials.paid)), 0),
      merchCount: dailyList.reduce((s, r) => s + r.merchandise.length, 0)
    };
  }, [dailyList]);

  // --- DERIVED DATA (WEEK) ---

  const weekOverview = useMemo(() => {
    const days = [];
    
    // Strict Monday-Sunday Logic
    const monday = getMonday(selectedDate);

    // Loop Mon-Sun (7 days)
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dStr = getLocalDateString(d);
        
        const event = events.find(e => e.date === dStr);
        
        // Only include days with events to keep the list clean
        if (!event) continue;

        const show = event && event.type === 'SHOW' ? shows.find(s => s.id === (event as any).showId) : null;
        const dayRes = reservations.filter(r => r.date === dStr && isOperational(r.status));
        
        const dayStats = {
            totalPax: dayRes.reduce((s, r) => s + r.partySize, 0),
            premiumPax: dayRes.filter(r => r.packageType === 'premium').reduce((s, r) => s + r.partySize, 0),
            
            // Addon Counts (Pre/After Party)
            preDrinks: dayRes.reduce((s, r) => s + (r.addons.find(a => a.id === 'pre-drinks')?.quantity || 0), 0),
            afterDrinks: dayRes.reduce((s, r) => s + (r.addons.find(a => a.id === 'after-drinks')?.quantity || 0), 0),
            
            dietary: dayRes.filter(r => r.notes.dietary).length,
            dietarySummary: Array.from(new Set(dayRes.filter(r => r.notes.dietary).map(r => r.notes.dietary))).join(', ')
        };
        
        days.push({ date: d, dStr, event, show, stats: dayStats });
    }
    return days;
  }, [selectedDate, events, reservations, shows]);

  // Helper for week header display
  const weekRange = useMemo(() => {
      const monday = getMonday(selectedDate);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { start: monday, end: sunday };
  }, [selectedDate]);

  // --- RENDERERS ---

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
                
                {/* Date Picker Trigger - Enhanced for Clickability */}
                <div className="relative group min-w-[160px]">
                    <input 
                        type="date" 
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-20"
                        value={dateStr}
                        onChange={handleDateInput}
                    />
                    <div className="px-4 font-bold text-white text-sm text-center group-hover:text-amber-500 transition-colors flex items-center justify-center h-full bg-slate-900/50 rounded pointer-events-none">
                      {activeTab === 'WEEK' ? (
                        <span>Week van {weekRange.start.getDate()} {weekRange.start.toLocaleString('nl-NL', { month: 'short' })}</span>
                      ) : (
                        <span>{selectedDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}</span>
                      )}
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
        <div className="flex space-x-1 border-b border-slate-800">
            <button 
                onClick={() => setActiveTab('DAY')} 
                className={`px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'DAY' ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
                Dagplanning (Call Sheet)
            </button>
            <button 
                onClick={() => setActiveTab('WEEK')} 
                className={`px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'WEEK' ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
                Weekoverzicht
            </button>
        </div>

        {/* KPI Chips (Screen Only - Only for DAY for now) */}
        {activeTab === 'DAY' && (
            <div className="grid grid-cols-4 gap-4">
            <Card className="p-4 bg-slate-900 border-slate-800 flex items-center justify-between">
                <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Gasten</p>
                    <p className="text-2xl font-serif text-white">{stats.totalPax}</p>
                </div>
                <Users className="text-slate-700" size={24} />
            </Card>
            <Card className="p-4 bg-slate-900 border-slate-800 flex items-center justify-between">
                <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Premium</p>
                    <p className="text-2xl font-serif text-amber-500">{stats.premiumPax}</p>
                </div>
                <Clock className="text-slate-700" size={24} />
            </Card>
            <Card className="p-4 bg-slate-900 border-slate-800 flex items-center justify-between">
                <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Dieet / Specials</p>
                    <p className="text-2xl font-serif text-red-400">{stats.dietaryCount}</p>
                </div>
                <Utensils className="text-slate-700" size={24} />
            </Card>
            <Card className="p-4 bg-slate-900 border-slate-800 flex items-center justify-between">
                <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Open Saldo</p>
                    <p className={`text-2xl font-serif ${stats.revenueOpen > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    €{stats.revenueOpen.toFixed(0)}
                    </p>
                </div>
                <Euro className="text-slate-700" size={24} />
            </Card>
            </div>
        )}
      </div>

      {/* 2. THE SHEET (Visible on Screen & Print, adapted via CSS) */}
      
      {activeTab === 'DAY' ? (
      <div className="bg-white text-black min-h-[297mm] shadow-2xl rounded-sm print:shadow-none print:w-full print:fixed print:top-0 print:left-0 print:m-0 print:h-auto print:z-[9999] overflow-hidden">
         
         {/* SHEET HEADER */}
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
               <div className="text-sm text-gray-500 font-mono mt-1">
                  Start: {dailyEvent?.times?.start || '19:30'} | 
                  Deur: {dailyEvent?.times?.doorsOpen || '18:30'} | 
                  Einde: {dailyEvent?.times?.end || '22:30'}
               </div>
            </div>
         </div>

         {/* SHEET SUMMARY STRIP */}
         <div className="bg-gray-100 border-b-2 border-black p-4 flex justify-between text-sm font-bold uppercase print:text-xs">
            <div className="flex space-x-6">
               <span>Totaal: {stats.totalPax} Pax</span>
               <span>Tafels: {dailyList.length}</span>
               <span>Premium: {stats.premiumPax}</span>
            </div>
            <div className="flex space-x-6 text-red-600">
               {stats.dietaryCount > 0 && <span>⚠️ {stats.dietaryCount} Dieetwensen</span>}
               {stats.revenueOpen > 0 && <span>💶 Te Innen: €{stats.revenueOpen.toFixed(2)}</span>}
            </div>
         </div>

         {/* MAIN LIST */}
         <div className="p-0">
            <table className="w-full text-left border-collapse">
               <thead className="bg-black text-white text-xs uppercase font-bold">
                  <tr>
                     <th className="p-3 w-16 text-center border-r border-white/20">Tafel</th>
                     <th className="p-3 w-20 text-center border-r border-white/20">Pax</th>
                     <th className="p-3 border-r border-white/20">Gast & Arrangement</th>
                     <th className="p-3 border-r border-white/20 w-1/3">Bijzonderheden & Wensen</th>
                     <th className="p-3 w-32 text-right">Status</th>
                  </tr>
               </thead>
               <tbody className="text-sm">
                  {dailyList.length === 0 ? (
                     <tr><td colSpan={5} className="p-12 text-center text-gray-400 italic">Geen reserveringen voor vandaag.</td></tr>
                  ) : dailyList.map((res, i) => {
                     const isVip = res.packageType === 'premium' || res.tags?.includes('VIP');
                     const hasDiet = !!res.notes.dietary;
                     const openBalance = res.financials.finalTotal - res.financials.paid;
                     const hasOpenBalance = openBalance > 0.01 && res.status !== 'INVITED';
                     
                     // Helper for price display on package tag
                     const packagePrice = res.packageType === 'premium' 
                        ? dailyPricing?.premium 
                        : dailyPricing?.standard;

                     return (
                        <tr key={res.id} className={`border-b border-gray-300 break-inside-avoid ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                           
                           {/* Tafel Nr */}
                           <td className="p-3 text-center border-r border-gray-300">
                              <span className="text-2xl font-black text-gray-800">{res.tableNumber}</span>
                           </td>

                           {/* Pax */}
                           <td className="p-3 text-center border-r border-gray-300 font-bold text-lg text-black">
                              {res.partySize}
                           </td>

                           {/* Gast */}
                           <td className="p-3 border-r border-gray-300 align-top">
                              <div className="font-black text-lg text-black uppercase tracking-tight truncate">
                                 {formatGuestName(res.customer.firstName, res.customer.lastName)}
                              </div>
                              {res.customer.companyName && (
                                 <div className="text-xs font-bold text-gray-700 uppercase mb-1">{res.customer.companyName}</div>
                              )}
                              
                              <div className="flex flex-wrap gap-1 mt-1 mb-1">
                                 {/* Custom Tags */}
                                 {res.tags?.map(tag => (
                                    <span key={tag} className="text-[10px] border border-black text-black px-1.5 py-0.5 font-bold uppercase flex items-center bg-gray-100">
                                       <Tag size={10} className="mr-1" /> {tag}
                                    </span>
                                 ))}
                              </div>

                              <div className="flex flex-wrap gap-1 mt-1">
                                 {res.packageType === 'premium' ? (
                                    <span className="text-[10px] bg-black text-white px-1.5 py-0.5 font-bold uppercase">
                                       Premium {packagePrice ? `(€${packagePrice.toFixed(2)})` : ''}
                                    </span>
                                 ) : (
                                    <span className="text-[10px] border border-black text-black px-1.5 py-0.5 font-bold uppercase">
                                       Standard {packagePrice ? `(€${packagePrice.toFixed(2)})` : ''}
                                    </span>
                                 )}
                                 {res.addons.map(a => (
                                    <span key={a.id} className="text-[10px] bg-gray-200 text-black px-1.5 py-0.5 font-bold uppercase border border-gray-300">
                                       + {a.id.replace('-',' ')}
                                    </span>
                                 ))}
                              </div>
                           </td>

                           {/* Notes / Diet */}
                           <td className="p-3 border-r border-gray-300 align-top">
                              <div className="space-y-1">
                                 {res.notes.dietary && (
                                    <div className="flex items-start font-bold text-red-600 text-xs uppercase border border-red-200 bg-red-50 p-1">
                                       <Utensils size={12} className="mr-1 mt-0.5 shrink-0" />
                                       {res.notes.dietary}
                                    </div>
                                 )}
                                 {res.notes.isCelebrating && (
                                    <div className="flex items-center text-blue-700 bg-blue-50 border border-blue-200 p-1 text-xs font-bold uppercase">
                                       <Tag size={12} className="mr-1" />
                                       {res.notes.celebrationText || 'IETS TE VIEREN'}
                                    </div>
                                 )}
                                 {res.notes.comments && (
                                    <div className="text-xs italic text-gray-600 border-l-2 border-gray-300 pl-2">
                                       "{res.notes.comments}"
                                    </div>
                                 )}
                                 {res.merchandise.length > 0 && (
                                    <div className="mt-2 text-xs">
                                       <div className="font-bold text-amber-600 uppercase flex items-center mb-0.5">
                                          <ShoppingBag size={10} className="mr-1"/> Merchandise
                                       </div>
                                       <ul className="list-disc list-inside text-gray-700 text-[10px]">
                                          {res.merchandise.map(m => {
                                             const itemDef = merchItems.find(i => i.id === m.id);
                                             return (
                                                <li key={m.id}>
                                                   <strong>{m.quantity}x</strong> {itemDef ? itemDef.name : 'Unknown Item'}
                                                </li>
                                             );
                                          })}
                                       </ul>
                                    </div>
                                 )}
                              </div>
                           </td>

                           {/* Status / Saldo */}
                           <td className="p-3 text-right align-top">
                              {hasOpenBalance ? (
                                 <div className="border-2 border-black p-1 inline-block bg-white text-right">
                                    <div className="text-[9px] font-bold uppercase text-red-600 leading-none mb-0.5">Openstaand</div>
                                    <div className="font-black text-sm text-red-600">€{openBalance.toFixed(2)}</div>
                                    <div className="text-[9px] text-gray-400">Totaal: €{res.financials.finalTotal.toFixed(0)}</div>
                                 </div>
                              ) : (
                                 <div>
                                    <div className="text-gray-400 font-bold text-xs flex items-center justify-end">
                                       <CheckCircle2 size={14} className="mr-1"/> Betaald
                                    </div>
                                    <div className="text-[9px] text-gray-400 mt-0.5">€{res.financials.finalTotal.toFixed(2)}</div>
                                 </div>
                              )}
                              
                              {res.status === 'INVITED' && (
                                 <div className="mt-1 text-[10px] font-bold bg-purple-100 text-purple-800 px-1 rounded inline-block">GASTENLIJST</div>
                              )}
                           </td>
                        </tr>
                     );
                  })}
               </tbody>
            </table>
         </div>

         {/* CHEF SUMMARY BLOCK (Bottom of Print) */}
         <div className="mt-auto p-6 border-t-4 border-black bg-gray-50 break-inside-avoid">
            <h3 className="text-lg font-black uppercase mb-4 flex items-center">
               <Utensils size={20} className="mr-2"/> Keuken Productie Totaal
            </h3>
            <div className="grid grid-cols-4 gap-8 text-sm">
               <div>
                  <p className="font-bold text-gray-500 uppercase text-xs">Arrangementen</p>
                  <div className="font-mono mt-1 text-black">
                     <div>STD: <strong>{stats.totalPax - stats.premiumPax}</strong></div>
                     <div>PREM: <strong>{stats.premiumPax}</strong></div>
                  </div>
               </div>
               <div className="col-span-3">
                  <p className="font-bold text-gray-500 uppercase text-xs mb-1">Mise-en-place (Opmerkingen)</p>
                  <div className="flex flex-wrap gap-2">
                     {dailyList.filter(r => r.notes.dietary).map(r => (
                        <span key={r.id} className="border border-gray-300 bg-white px-2 py-1 text-xs text-black">
                           T{r.tableNumber}: <strong>{r.notes.dietary}</strong>
                        </span>
                     ))}
                     {dailyList.filter(r => r.notes.dietary).length === 0 && <span className="text-gray-400 italic">Geen bijzonderheden.</span>}
                  </div>
               </div>
            </div>
         </div>

      </div>
      ) : (
      // --- WEEK REPORT LAYOUT ---
      <div className="bg-white text-black min-h-[297mm] shadow-2xl rounded-sm print:shadow-none print:w-full print:fixed print:top-0 print:left-0 print:m-0 print:h-auto print:z-[9999] overflow-hidden">
         <div className="p-8 border-b-4 border-black print:p-6">
            <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">Week Overzicht</h1>
            <div className="flex items-center space-x-4 text-sm font-bold uppercase tracking-widest text-gray-600">
               <span>Van: {weekRange.start.toLocaleDateString('nl-NL')}</span>
               <span>Tot: {weekRange.end.toLocaleDateString('nl-NL')}</span>
            </div>
         </div>

         <div className="p-0">
            <table className="w-full text-left border-collapse">
               <thead className="bg-black text-white text-xs uppercase font-bold">
                  <tr>
                     <th className="p-3 border-r border-white/20 w-32">Datum</th>
                     <th className="p-3 border-r border-white/20">Show & Tijd</th>
                     <th className="p-3 border-r border-white/20 w-24 text-center">Pax</th>
                     <th className="p-3 border-r border-white/20 w-32">Arrangementen</th>
                     <th className="p-3 border-r border-white/20">Bijzonderheden</th>
                     <th className="p-3 w-24 text-right">Status</th>
                  </tr>
               </thead>
               <tbody className="text-sm">
                  {weekOverview.length === 0 && (
                      <tr><td colSpan={6} className="p-12 text-center text-gray-400 italic">Geen events deze week.</td></tr>
                  )}
                  {weekOverview.map((day, i) => (
                     <tr key={day.dStr} className={`border-b border-gray-300 break-inside-avoid ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="p-3 font-bold border-r border-gray-300">
                           <div className="uppercase text-xs text-gray-500">{day.date.toLocaleDateString('nl-NL', {weekday:'short'})}</div>
                           <div className="text-lg text-slate-900">{day.date.getDate()} {day.date.toLocaleDateString('nl-NL', {month:'short'})}</div>
                        </td>
                        <td className="p-3 border-r border-gray-300">
                           {day.event?.type === 'SHOW' ? (
                              <>
                                 <div className="font-bold text-slate-900">{day.show?.name || 'Onbekende Show'}</div>
                                 <div className="text-xs text-gray-500 font-mono">{day.event.times?.start}</div>
                              </>
                           ) : (
                              <span className="text-gray-400 italic">{day.event?.title || 'Geen Event'}</span>
                           )}
                        </td>
                        <td className="p-3 text-center border-r border-gray-300 font-black text-lg text-slate-900">
                           {day.stats.totalPax > 0 ? day.stats.totalPax : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="p-3 border-r border-gray-300 text-xs text-slate-700">
                           {day.stats.totalPax > 0 && (
                              <div className="space-y-1">
                                 <div className="flex justify-between"><span>STD:</span> <strong>{day.stats.totalPax - day.stats.premiumPax}</strong></div>
                                 <div className="flex justify-between text-amber-600"><span>PREM:</span> <strong>{day.stats.premiumPax}</strong></div>
                                 
                                 {/* NEW: Pre/After Drinks Breakdown */}
                                 {(day.stats.preDrinks > 0 || day.stats.afterDrinks > 0) && <div className="border-t border-gray-200 my-1"/>}
                                 
                                 {day.stats.preDrinks > 0 && (
                                    <div className="flex justify-between text-blue-600"><span>Borrel:</span> <strong>{day.stats.preDrinks}</strong></div>
                                 )}
                                 {day.stats.afterDrinks > 0 && (
                                    <div className="flex justify-between text-purple-600"><span>After:</span> <strong>{day.stats.afterDrinks}</strong></div>
                                 )}
                              </div>
                           )}
                        </td>
                        <td className="p-3 border-r border-gray-300 text-xs">
                           {day.stats.dietary > 0 ? (
                              <div className="text-red-600 font-bold">
                                 {day.stats.dietary}x Dieet
                                 <div className="text-[10px] font-normal text-gray-600 mt-1 line-clamp-2">{day.stats.dietarySummary}</div>
                              </div>
                           ) : (
                              <span className="text-gray-300">-</span>
                           )}
                        </td>
                        <td className="p-3 text-right">
                           {day.event?.type === 'SHOW' ? (
                              <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${day.event.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800' : day.event.status === 'WAITLIST' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}`}>
                                 {day.event.status}
                              </span>
                           ) : (
                              <span className="text-gray-300 text-xs">-</span>
                           )}
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
      )}

    </div>
  );
};
