
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
import { Reservation, BookingStatus, CalendarEvent, ShowDefinition, MerchandiseItem } from '../../types';
import { formatCurrency, formatGuestName } from '../../utils/formatters';
import { getEffectivePricing } from '../../utils/pricing';

type Tab = 'DAY' | 'WEEK' | 'FORECAST';
type SortMode = 'TABLE' | 'NAME' | 'TIME';

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
  const [sortMode, setSortMode] = useState<SortMode>('NAME');
  
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

  // --- NEW: Print Call Sheet (PDF) ---
  const handlePrintCallSheet = () => {
    const list = dailyList; // Uses current sort
    
    // 1. Prepare Aggregated Data for the Summary Section
    const kitchenSummary: Record<string, number> = {};
    const merchSummary: Record<string, number> = {};
    const celebrationsList: { table: string, text: string, name: string }[] = [];

    list.forEach(r => {
        // Kitchen Aggregation
        if (r.notes.structuredDietary) {
            Object.entries(r.notes.structuredDietary).forEach(([k, v]) => {
                kitchenSummary[k] = (kitchenSummary[k] || 0) + (v as number);
            });
        }
        // Fallback for manual text notes if simple
        if (r.notes.dietary && (!r.notes.structuredDietary || Object.keys(r.notes.structuredDietary).length === 0)) {
             kitchenSummary['Handmatig (Zie Lijst)'] = (kitchenSummary['Handmatig (Zie Lijst)'] || 0) + 1;
        }

        // Merch Aggregation
        r.merchandise.forEach(m => {
            const itemDef = merchItems.find(i => i.id === m.id);
            const label = itemDef ? itemDef.name : m.id;
            merchSummary[label] = (merchSummary[label] || 0) + m.quantity;
        });

        // Celebrations
        if (r.notes.isCelebrating) {
            celebrationsList.push({
                table: r.displayTable,
                text: r.notes.celebrationText || 'Viering',
                name: formatGuestName(r.customer.firstName, r.customer.lastName)
            });
        }
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // 2. Build Rows HTML
    const rows = list.map((r, index) => {
        const isVip = r.packageType === 'premium' || r.tags?.includes('VIP');
        const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
        const borderLeft = r.packageType === 'premium' ? '4px solid #d97706' : '4px solid #cbd5e1'; // Amber vs Slate
        
        let notesHtml = '';
        if (r.notes.dietary) notesHtml += `<div class="note-diet">🍽️ ${r.notes.dietary}</div>`;
        if (r.notes.isCelebrating) notesHtml += `<div class="note-cel">🎉 ${r.notes.celebrationText || 'Viering'}</div>`;
        if (r.notes.comments) notesHtml += `<div class="note-gen">💬 "${r.notes.comments}"</div>`;
        if (r.merchandise.length > 0) notesHtml += `<div class="note-merch">🛍️ ${r.merchandise.length} items</div>`;

        const addonsHtml = r.addons.map(a => `<span class="badge badge-addon">${a.quantity}x ${a.id}</span>`).join('');
        
        return `
            <tr style="background-color: ${rowBg};">
                <td style="border-left: ${borderLeft}; text-align: center; font-size: 18px; font-weight: 800;">${r.displayTable}</td>
                <td style="text-align: center; font-weight: bold;">${r.partySize}</td>
                <td>
                    <div class="guest-name">${formatGuestName(r.customer.firstName, r.customer.lastName)}</div>
                    ${r.customer.companyName ? `<div class="company">${r.customer.companyName}</div>` : ''}
                </td>
                <td>
                    <span class="badge ${r.packageType === 'premium' ? 'badge-premium' : 'badge-std'}">${r.packageType.toUpperCase()}</span>
                    ${addonsHtml}
                </td>
                <td>${notesHtml}</td>
                <td style="text-align: right; font-family: monospace;">
                    ${r.financials.isPaid ? 'PAID' : `<span style="color: #ef4444; font-weight: bold;">OPEN</span>`}
                </td>
            </tr>
        `;
    }).join('');

    // 3. Build Summary Sections HTML
    const kitchenRows = Object.entries(kitchenSummary).map(([k, v]) => `<div><span style="font-weight:bold;">${v}x</span> ${k}</div>`).join('') || '<div style="color:#94a3b8; font-style:italic;">Geen bijzonderheden.</div>';
    
    const merchRows = Object.entries(merchSummary).map(([k, v]) => `<div><span style="font-weight:bold;">${v}x</span> ${k}</div>`).join('') || '<div style="color:#94a3b8; font-style:italic;">Geen merchandise.</div>';
    
    const celebrationRows = celebrationsList.map(c => `<div><span style="font-weight:bold;">Tafel ${c.table}:</span> ${c.text} <span style="font-size:10px; color:#64748b;">(${c.name})</span></div>`).join('') || '<div style="color:#94a3b8; font-style:italic;">Geen vieringen.</div>';

    // 4. Construct Full HTML
    const html = `
        <html>
        <head>
            <title>Callsheet ${selectedDate.toLocaleDateString()}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Playfair+Display:wght@700&display=swap');
                
                body { font-family: 'Inter', sans-serif; padding: 20px; font-size: 11px; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                
                /* HEADER */
                .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; border-bottom: 3px solid #0f172a; padding-bottom: 15px; }
                h1 { font-family: 'Playfair Display', serif; margin: 0; font-size: 32px; color: #0f172a; line-height: 1; }
                .sub-header { font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #64748b; margin-top: 5px; }
                .meta-box { text-align: right; }
                .meta-event { font-weight: 800; font-size: 16px; margin-bottom: 4px; }
                
                /* STATS STRIP */
                .stats-strip { display: flex; gap: 15px; margin-bottom: 20px; background: #f1f5f9; padding: 10px 15px; border-radius: 8px; }
                .stat { font-weight: 700; text-transform: uppercase; font-size: 10px; color: #475569; }
                .stat strong { color: #0f172a; font-size: 14px; margin-left: 4px; }
                
                /* TABLE */
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th { text-align: left; background: #0f172a; color: white; padding: 8px 5px; text-transform: uppercase; font-size: 9px; letter-spacing: 1px; }
                td { padding: 8px 5px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
                
                .guest-name { font-weight: 700; font-size: 12px; }
                .company { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 600; }
                
                /* BADGES & NOTES */
                .badge { display: inline-block; padding: 2px 5px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; margin-right: 4px; margin-bottom: 2px; border: 1px solid transparent; }
                .badge-premium { background-color: #fffbeb; color: #d97706; border-color: #fcd34d; }
                .badge-std { background-color: #f1f5f9; color: #475569; border-color: #cbd5e1; }
                .badge-addon { background-color: #f0fdf4; color: #15803d; border-color: #86efac; }
                
                .note-diet { color: #dc2626; font-weight: 700; margin-bottom: 2px; }
                .note-cel { color: #7c3aed; font-weight: 700; margin-bottom: 2px; }
                .note-gen { color: #475569; font-style: italic; }
                .note-merch { color: #0891b2; font-weight: 700; }

                /* PRODUCTION SECTION (FOOTER) */
                .production-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; page-break-inside: avoid; }
                .prod-box { border: 2px solid #0f172a; padding: 15px; border-radius: 0; background: #fff; }
                .prod-header { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; }
                .prod-content { font-size: 11px; line-height: 1.5; }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <h1>Call Sheet</h1>
                    <div class="sub-header">${selectedDate.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </div>
                <div class="meta-box">
                    <div class="meta-event">${showDef?.name || dailyEvent?.title || 'Event'}</div>
                    <div>Aanvang: ${dailyEvent?.times?.start || '19:30'} &bull; Deur: ${dailyEvent?.times?.doorsOpen || '18:30'}</div>
                </div>
            </div>

            <div class="stats-strip">
                <div class="stat">Totaal Pax <strong>${stats.totalPax}</strong></div>
                <div class="stat">Premium <strong>${stats.premiumPax}</strong></div>
                <div class="stat">Standard <strong>${stats.totalPax - stats.premiumPax}</strong></div>
                <div class="stat" style="color: #dc2626;">Dieetwensen <strong>${stats.dietaryCount}</strong></div>
                <div class="stat" style="color: #0891b2;">Merch Orders <strong>${stats.merchCount}</strong></div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th width="60" style="text-align: center;">Tafel</th>
                        <th width="40" style="text-align: center;">Pax</th>
                        <th width="200">Gast</th>
                        <th width="150">Arrangement & Add-ons</th>
                        <th>Bijzonderheden</th>
                        <th width="60" style="text-align: right;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
            
            <div class="production-grid">
                <div class="prod-box">
                    <div class="prod-header">
                        <span>Keuken Pass</span>
                        <span style="font-size: 20px;">🍽️</span>
                    </div>
                    <div class="prod-content">
                        ${kitchenRows}
                    </div>
                </div>
                
                <div class="prod-box">
                    <div class="prod-header">
                         <span>Merchandise Pick</span>
                         <span style="font-size: 20px;">🛍️</span>
                    </div>
                    <div class="prod-content">
                        ${merchRows}
                    </div>
                </div>

                <div class="prod-box">
                    <div class="prod-header">
                        <span>Vieringen</span>
                        <span style="font-size: 20px;">🎉</span>
                    </div>
                    <div class="prod-content">
                        ${celebrationRows}
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 20px; text-align: center; color: #94a3b8; font-size: 9px; text-transform: uppercase; letter-spacing: 1px;">
                Gegenereerd op ${new Date().toLocaleString('nl-NL')}
            </div>

            <script>window.onload = () => window.print();</script>
        </body>
        </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // --- Print Bar List (PDF) ---
  const handlePrintBarList = () => {
    const list = dailyList.sort((a, b) => {
        const tA = a.tableId ? parseInt(a.tableId.replace('TAB-', '')) : 999;
        const tB = b.tableId ? parseInt(b.tableId.replace('TAB-', '')) : 999;
        return tA - tB;
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rows = list.map(r => {
        const drinks = r.addons.filter(a => a.id.includes('drink') || a.id.includes('wijn') || a.id.includes('bob'));
        const drinkText = drinks.map(d => `${d.quantity}x ${d.id.replace(/-/g,' ')}`).join(', ');
        
        return `
            <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 8px; font-size: 14px; font-weight: bold;">${r.displayTable}</td>
                <td style="padding: 8px; font-size: 14px;">${r.partySize}</td>
                <td style="padding: 8px; font-size: 14px;">${formatGuestName(r.customer.firstName, r.customer.lastName)}</td>
                <td style="padding: 8px; font-size: 14px;">${r.packageType.toUpperCase()}</td>
                <td style="padding: 8px; font-size: 14px; color: #d97706;">${drinkText}</td>
                <td style="padding: 8px; font-size: 12px; font-style: italic;">${r.notes.isCelebrating ? 'VIERING!' : ''}</td>
            </tr>
        `;
    }).join('');

    printWindow.document.write(`
        <html>
        <head>
            <title>Drankenlijst ${selectedDate.toLocaleDateString()}</title>
            <style>
                body { font-family: sans-serif; padding: 20px; }
                table { width: 100%; border-collapse: collapse; }
                th { text-align: left; background: #eee; padding: 8px; font-size: 12px; text-transform: uppercase; }
                h1 { margin-bottom: 0; }
                .meta { font-size: 14px; color: #666; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <h1>Drankenlijst / Bar</h1>
            <div class="meta">${selectedDate.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} • ${dailyEvent?.title || 'Event'}</div>
            
            <table>
                <thead>
                    <tr>
                        <th width="10%">Tafel</th>
                        <th width="10%">Pax</th>
                        <th width="25%">Naam</th>
                        <th width="15%">Arrangement</th>
                        <th width="25%">Add-ons</th>
                        <th width="15%">Info</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
            <script>window.onload = () => window.print();</script>
        </body>
        </html>
    `);
    printWindow.document.close();
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
       if (sortMode === 'NAME') {
           return a.customer.lastName.localeCompare(b.customer.lastName);
       }
       if (sortMode === 'TABLE') {
           // Extract number from "TAB-12" -> 12. If missing, treat as 999
           const tA = a.tableId ? parseInt(a.tableId.replace('TAB-', '')) : 999;
           const tB = b.tableId ? parseInt(b.tableId.replace('TAB-', '')) : 999;
           return tA - tB;
       }
       if (sortMode === 'TIME') {
           const timeA = a.startTime || '00:00';
           const timeB = b.startTime || '00:00';
           return timeA.localeCompare(timeB);
       }
       return 0;
    }).map(r => ({
        ...r,
        // Display Logic for Table
        displayTable: r.tableId ? r.tableId.replace('TAB-', '') : '-'
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
        
        // --- AGGREGATION LOGIC ---
        const dietaryAgg = {
            standard: {} as Record<string, number>, // e.g. { "Glutenvrij": 8 }
            specials: [] as { text: string, guestName: string }[] // e.g. [{ text: "Zonder Cayenne", guest: "Jansen" }]
        };

        dayRes.forEach(r => {
            // 1. Aggregate Standard Counts (Checkboxes)
            if (r.notes.structuredDietary) {
                Object.entries(r.notes.structuredDietary).forEach(([type, rawCount]) => {
                    const count = rawCount as number;
                    if (count > 0) {
                        dietaryAgg.standard[type] = (dietaryAgg.standard[type] || 0) + count;
                    }
                });
            }

            // 2. Collect Specific Comments (Text Input)
            if (r.notes.comments) {
                dietaryAgg.specials.push({ 
                    text: r.notes.comments, 
                    guestName: r.customer.lastName 
                });
            }

            // 3. Fallback for Legacy Data (If text exists but no structured counters)
            if (r.notes.dietary && (!r.notes.structuredDietary || Object.keys(r.notes.structuredDietary).length === 0) && !r.notes.comments) {
                 dietaryAgg.specials.push({ 
                    text: r.notes.dietary, 
                    guestName: r.customer.lastName 
                });
            }
        });

        const dayStats = {
            totalPax: dayRes.reduce((s, r) => s + r.partySize, 0),
            premiumPax: dayRes.filter(r => r.packageType === 'premium').reduce((s, r) => s + r.partySize, 0),
            
            // Addon Counts (Pre/After Party)
            preDrinks: dayRes.reduce((s, r) => s + (r.addons.find(a => a.id === 'pre-drinks')?.quantity || 0), 0),
            afterDrinks: dayRes.reduce((s, r) => s + (r.addons.find(a => a.id === 'after-drinks')?.quantity || 0), 0),
            
            dietaryAgg // New Aggregated Structure
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
              
              {activeTab === 'DAY' && (
                <>
                    <Button onClick={handlePrintBarList} variant="secondary" className="flex items-center">
                        <Wine size={18} className="mr-2"/> Barlijst (PDF)
                    </Button>
                    <Button onClick={handlePrintCallSheet} variant="secondary" className="flex items-center">
                        <FileText size={18} className="mr-2"/> Callsheet (PDF)
                    </Button>
                </>
              )}

              <Button onClick={handlePrint} className="flex items-center bg-white text-black hover:bg-slate-200 border-none shadow-lg shadow-white/10">
                <Printer size={18} className="mr-2"/> Afdrukken
              </Button>
           </div>
        </div>

        {/* TAB SWITCHER */}
        <div className="flex items-center justify-between border-b border-slate-800">
            <div className="flex space-x-1">
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

            {/* SORT CONTROL (Visible on DAY tab) */}
            {activeTab === 'DAY' && (
                <div className="flex items-center space-x-2 py-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mr-2">Sorteer op:</span>
                    {[
                        { id: 'TABLE', label: 'Tafel' },
                        { id: 'NAME', label: 'Naam' },
                        { id: 'TIME', label: 'Tijd' },
                    ].map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => setSortMode(opt.id as SortMode)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-colors ${sortMode === opt.id ? 'bg-amber-500 text-black border-amber-500' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
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
      <div className="bg-white text-black shadow-2xl rounded-sm print:shadow-none print:w-full print:static print:h-auto print:overflow-visible">
         
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
                           <td className="p-3 text-center border-r border-gray-300 align-top">
                              <span className="text-2xl font-black text-gray-800">{res.displayTable}</span>
                           </td>

                           {/* Pax */}
                           <td className="p-3 text-center border-r border-gray-300 font-bold text-lg text-black align-top">
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
                           T{r.displayTable}: <strong>{r.notes.dietary}</strong>
                        </span>
                     ))}
                     {dailyList.filter(r => r.notes.dietary).length === 0 && <span className="text-gray-400 italic">Geen bijzonderheden.</span>}
                  </div>
               </div>
            </div>
         </div>

      </div>
      ) : (
      // --- WEEK REPORT LAYOUT (UPDATED FOR FULL DETAILS) ---
      <div className="bg-white text-black shadow-2xl rounded-sm print:shadow-none print:w-full print:static print:h-auto print:overflow-visible">
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
                  {weekOverview.map((day, i) => {
                     const hasDiets = Object.keys(day.stats.dietaryAgg.standard).length > 0 || day.stats.dietaryAgg.specials.length > 0;
                     
                     return (
                     <tr key={day.dStr} className={`border-b border-gray-300 break-inside-avoid ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="p-3 font-bold border-r border-gray-300 align-top">
                           <div className="uppercase text-xs text-gray-500">{day.date.toLocaleDateString('nl-NL', {weekday:'short'})}</div>
                           <div className="text-lg text-slate-900">{day.date.getDate()} {day.date.toLocaleDateString('nl-NL', {month:'short'})}</div>
                        </td>
                        <td className="p-3 border-r border-gray-300 align-top">
                           {day.event?.type === 'SHOW' ? (
                              <>
                                 <div className="font-bold text-slate-900">{day.show?.name || 'Onbekende Show'}</div>
                                 <div className="text-xs text-gray-500 font-mono">{day.event.times?.start}</div>
                              </>
                           ) : (
                              <span className="text-gray-400 italic">{day.event?.title || 'Geen Event'}</span>
                           )}
                        </td>
                        <td className="p-3 text-center border-r border-gray-300 font-black text-lg text-slate-900 align-top">
                           {day.stats.totalPax > 0 ? day.stats.totalPax : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="p-3 border-r border-gray-300 text-xs text-slate-700 align-top">
                           {day.stats.totalPax > 0 && (
                              <div className="space-y-1">
                                 <div className="flex justify-between"><span>STD:</span> <strong>{day.stats.totalPax - day.stats.premiumPax}</strong></div>
                                 <div className="flex justify-between text-amber-600"><span>PREM:</span> <strong>{day.stats.premiumPax}</strong></div>
                                 
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
                        <td className="p-3 border-r border-gray-300 text-xs align-top">
                           {hasDiets ? (
                              <div className="space-y-2">
                                 {/* Standard Aggregated */}
                                 {Object.entries(day.stats.dietaryAgg.standard).length > 0 && (
                                     <div className="flex flex-wrap gap-2 mb-2">
                                         {Object.entries(day.stats.dietaryAgg.standard).map(([type, count]) => (
                                             <span key={type} className="inline-block bg-red-100 text-red-800 border border-red-200 px-1.5 py-0.5 rounded font-bold">
                                                 {count}x {type}
                                             </span>
                                         ))}
                                     </div>
                                 )}
                                 
                                 {/* Specials List */}
                                 {day.stats.dietaryAgg.specials.length > 0 && (
                                     <ul className="space-y-1 border-t border-gray-200 pt-1 mt-1">
                                         {day.stats.dietaryAgg.specials.map((note, idx) => (
                                            <li key={idx} className="text-slate-700">
                                               <span className="text-red-600 font-bold mr-1">⚠</span>
                                               <span className="italic">{note.text}</span>
                                               <span className="text-[10px] text-gray-500 uppercase ml-1">({note.guestName})</span>
                                            </li>
                                         ))}
                                     </ul>
                                 )}
                              </div>
                           ) : (
                              <span className="text-gray-300">-</span>
                           )}
                        </td>
                        <td className="p-3 text-right align-top">
                           {day.event?.type === 'SHOW' ? (
                              <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${day.event.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800' : day.event.status === 'WAITLIST' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}`}>
                                 {day.event.status}
                              </span>
                           ) : (
                              <span className="text-gray-300 text-xs">-</span>
                           )}
                        </td>
                     </tr>
                  )})}
               </tbody>
            </table>
         </div>
      </div>
      )}

    </div>
  );
};
