
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Utensils, Wine, Clock, RefreshCw, 
  ChefHat, AlertTriangle, ClipboardList, StickyNote, CheckCircle2, ArrowRight
} from 'lucide-react';
import { Card, Badge, Button } from '../UI';
import { bookingRepo } from '../../utils/storage';
import { Reservation, BookingStatus } from '../../types';
import { MOCK_ADDONS } from '../../mock/data';

// Local storage key for ticket statuses
const KDS_STATUS_KEY = 'grand_stage_kds_status';

type TicketStatus = 'PREP' | 'COOKING' | 'READY' | 'SERVED';

interface KitchenTicket {
  id: string; // Reservation ID
  tableNumber: string;
  guestName: string;
  pax: number;
  time: string;
  type: 'STANDARD' | 'PREMIUM';
  dietary: string;
  comments: string;
  status: TicketStatus;
}

const STATUS_COLORS = {
  PREP: 'bg-slate-800 border-slate-700',
  COOKING: 'bg-blue-900/20 border-blue-500/50',
  READY: 'bg-emerald-900/20 border-emerald-500/50',
  SERVED: 'bg-slate-900 border-slate-800 opacity-50'
};

const DANGER_KEYWORDS = ['NOTEN', 'PINDA', 'SCHAALDIER', 'KREEFT', 'GARNAAL', 'GLUTEN', 'LACTOSE', 'ALLERGIE'];

export const KitchenDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  
  // Data State
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [productionSummary, setProductionSummary] = useState<{name: string, count: number}[]>([]);
  const [addonSummary, setAddonSummary] = useState<{name: string, count: number}[]>([]);
  const [dangerAlerts, setDangerAlerts] = useState<{keyword: string, count: number, tables: string[]}[]>([]);
  
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 10000); // Polling every 10s
    
    // Listen for local changes to sync multiple tabs
    window.addEventListener('storage-update', refreshData);
    return () => {
        clearInterval(interval);
        window.removeEventListener('storage-update', refreshData);
    };
  }, []);

  const refreshData = () => {
    setLoading(true);
    const all = bookingRepo.getAll();
    const statusMap = JSON.parse(localStorage.getItem(KDS_STATUS_KEY) || '{}');
    
    // Filter for TODAY + Active
    const relevant = all.filter(r => 
      r.date === today && 
      r.status !== BookingStatus.CANCELLED && 
      r.status !== BookingStatus.NOSHOW &&
      r.status !== BookingStatus.ARCHIVED
    );

    // 1. Build Interactive Tickets
    const newTickets: KitchenTicket[] = relevant.map(r => ({
        id: r.id,
        tableNumber: (r as any).tableNumber || '?',
        guestName: r.customer.lastName,
        pax: r.partySize,
        time: r.startTime || '19:30',
        type: (r.packageType === 'premium' ? 'PREMIUM' : 'STANDARD') as 'STANDARD' | 'PREMIUM',
        dietary: r.notes.dietary || '',
        comments: r.notes.comments || '',
        status: (statusMap[r.id] as TicketStatus) || 'PREP'
    })).sort((a,b) => {
        // Sort served to bottom
        if (a.status === 'SERVED' && b.status !== 'SERVED') return 1;
        if (a.status !== 'SERVED' && b.status === 'SERVED') return -1;
        return a.time.localeCompare(b.time);
    });

    // 2. Production Summary (Mise-en-place)
    const productionMap = new Map<string, number>();
    const dangerMap = new Map<string, { count: number, tables: Set<string> }>();

    relevant.forEach(r => {
      // Structured Diets
      if (r.notes.structuredDietary) {
        Object.entries(r.notes.structuredDietary).forEach(([key, count]) => {
          if (count > 0) {
             productionMap.set(key, (productionMap.get(key) || 0) + count);
             
             // Check Danger Keywords
             const upperKey = key.toUpperCase();
             const matchedKeyword = DANGER_KEYWORDS.find(k => upperKey.includes(k));
             if (matchedKeyword) {
                 const entry = dangerMap.get(matchedKeyword) || { count: 0, tables: new Set() };
                 entry.count += count;
                 entry.tables.add((r as any).tableNumber || '?');
                 dangerMap.set(matchedKeyword, entry);
             }
          }
        });
      }
      
      // Free Text check for Danger
      if (r.notes.dietary) {
          const upperNote = r.notes.dietary.toUpperCase();
          DANGER_KEYWORDS.forEach(k => {
              if (upperNote.includes(k) && !Object.keys(r.notes.structuredDietary || {}).some(sk => sk.toUpperCase().includes(k))) {
                  const entry = dangerMap.get(k) || { count: 0, tables: new Set() };
                  entry.count += 1; // Assume 1 if in text and not structured
                  entry.tables.add((r as any).tableNumber || '?');
                  dangerMap.set(k, entry);
              }
          });
      }
    });

    const prodList = Array.from(productionMap.entries()).map(([name, count]) => ({ name, count }));
    
    // 3. Danger Alerts
    const dangerList = Array.from(dangerMap.entries()).map(([keyword, data]) => ({
        keyword,
        count: data.count,
        tables: Array.from(data.tables).sort()
    }));

    // 4. Addon Summary
    const addonMap = new Map<string, number>();
    relevant.forEach(r => {
        r.addons.forEach(a => {
            const def = MOCK_ADDONS.find(ad => ad.id === a.id);
            const name = def ? def.name : a.id;
            addonMap.set(name, (addonMap.get(name) || 0) + a.quantity);
        });
    });
    const addList = Array.from(addonMap.entries()).map(([name, count]) => ({ name, count }));

    setTickets(newTickets);
    setProductionSummary(prodList);
    setAddonSummary(addList);
    setDangerAlerts(dangerList);
    setLastRefreshed(new Date());
    setTimeout(() => setLoading(false), 300);
  };

  const updateTicketStatus = (id: string, newStatus: TicketStatus) => {
    const statusMap = JSON.parse(localStorage.getItem(KDS_STATUS_KEY) || '{}');
    statusMap[id] = newStatus;
    localStorage.setItem(KDS_STATUS_KEY, JSON.stringify(statusMap));
    
    // Optimistic Update
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    
    // Trigger event for other tabs
    window.dispatchEvent(new Event('storage-update'));
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 p-4 md:p-8 font-sans">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-red-900/20 rounded-xl border border-red-900/50 text-red-500">
            <ChefHat size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-white">Kitchen Display</h1>
            <p className="text-slate-500 text-lg font-mono">
              {new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
           <div className="text-right">
             <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Auto Update</div>
             <div className="text-emerald-500 font-mono text-sm flex items-center justify-end">
               <Clock size={12} className="mr-1.5" />
               {lastRefreshed.toLocaleTimeString()}
             </div>
           </div>
           <button onClick={refreshData} className="p-3 bg-slate-900 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
             <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
           </button>
        </div>
      </div>

      {/* DANGER MATRIX BANNER */}
      {dangerAlerts.length > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-orange-900/40 border-l-4 border-orange-500 flex items-start animate-in slide-in-from-top-4 shadow-lg">
            <AlertTriangle className="text-orange-500 mr-4 mt-1 shrink-0" size={24} />
            <div className="flex-grow">
                <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-wide">⚠️ Kritieke Allergieën</h3>
                <div className="flex flex-wrap gap-3">
                    {dangerAlerts.map(alert => (
                        <span key={alert.keyword} className="bg-red-600 text-white px-3 py-1 rounded font-bold text-sm shadow-md border border-red-400">
                            {alert.count}x {alert.keyword} <span className="opacity-75 font-normal text-xs ml-1">(Tafels: {alert.tables.join(', ')})</span>
                        </span>
                    ))}
                </div>
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
        
        {/* LEFT COLUMN: Production Summaries (Sticky) */}
        <div className="lg:col-span-1 space-y-6">
            <Card className="bg-slate-900 border-slate-800 p-0 overflow-hidden">
                <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                    <h3 className="font-bold text-white text-sm uppercase tracking-wide flex items-center">
                        <ClipboardList size={16} className="mr-2 text-emerald-500"/> Mise-en-place
                    </h3>
                </div>
                <div className="p-4 space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar">
                    {productionSummary.length === 0 ? <p className="text-slate-500 italic text-xs">Geen bijzonderheden.</p> : 
                        productionSummary.map((item, i) => (
                            <div key={i} className="flex justify-between items-center p-2 bg-slate-800/50 rounded border border-slate-700/50">
                                <span className="text-sm text-slate-300">{item.name}</span>
                                <span className="font-black text-emerald-400">{item.count}x</span>
                            </div>
                        ))
                    }
                </div>
            </Card>

            <Card className="bg-slate-900 border-slate-800 p-0 overflow-hidden">
                <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                    <h3 className="font-bold text-white text-sm uppercase tracking-wide flex items-center">
                        <Wine size={16} className="mr-2 text-blue-500"/> Drank & Extra
                    </h3>
                </div>
                <div className="p-4 space-y-2 max-h-[30vh] overflow-y-auto custom-scrollbar">
                    {addonSummary.length === 0 ? <p className="text-slate-500 italic text-xs">Geen extra's.</p> : 
                        addonSummary.map((item, i) => (
                            <div key={i} className="flex justify-between items-center p-2 bg-slate-800/50 rounded border border-slate-700/50">
                                <span className="text-sm text-slate-300">{item.name}</span>
                                <span className="font-bold text-blue-400">{item.count}x</span>
                            </div>
                        ))
                    }
                </div>
            </Card>
        </div>

        {/* RIGHT COLUMN: Interactive Tickets */}
        <div className="lg:col-span-3">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {tickets.map(ticket => (
                    <div 
                        key={ticket.id} 
                        className={`
                            relative flex flex-col p-4 rounded-xl border-2 transition-all duration-300
                            ${STATUS_COLORS[ticket.status]}
                        `}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-start mb-3 border-b border-white/10 pb-2">
                            <div>
                                <span className="text-xs font-mono text-slate-400 block">{ticket.time}</span>
                                <h4 className="font-black text-xl text-white">Tafel {ticket.tableNumber}</h4>
                            </div>
                            <div className="text-right">
                                <span className="block font-bold text-2xl text-white">{ticket.pax}p</span>
                                <Badge status={ticket.type === 'PREMIUM' ? 'CONFIRMED' : 'ARCHIVED'} className="scale-75 origin-right">
                                    {ticket.type}
                                </Badge>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-grow space-y-3 mb-4">
                            <p className="text-sm font-bold text-slate-200 truncate">{ticket.guestName}</p>
                            
                            {ticket.dietary && (
                                <div className="bg-red-900/30 border border-red-500/50 p-2 rounded text-red-200 text-sm font-bold flex items-start">
                                    <AlertTriangle size={14} className="mr-2 mt-0.5 shrink-0" />
                                    {ticket.dietary}
                                </div>
                            )}
                            
                            {ticket.comments && (
                                <div className="bg-amber-900/30 border border-amber-500/50 p-2 rounded text-amber-200 text-xs italic flex items-start">
                                    <StickyNote size={14} className="mr-2 mt-0.5 shrink-0" />
                                    "{ticket.comments}"
                                </div>
                            )}
                            
                            {!ticket.dietary && !ticket.comments && (
                                <div className="text-slate-500 text-xs italic py-2">Standaard order</div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="mt-auto pt-2 border-t border-white/10">
                            {ticket.status === 'PREP' && (
                                <Button onClick={() => updateTicketStatus(ticket.id, 'COOKING')} className="w-full bg-blue-600 hover:bg-blue-500 border-none text-xs h-10">
                                    Start Bereiding
                                </Button>
                            )}
                            {ticket.status === 'COOKING' && (
                                <Button onClick={() => updateTicketStatus(ticket.id, 'READY')} className="w-full bg-emerald-600 hover:bg-emerald-500 border-none text-xs h-10">
                                    <CheckCircle2 size={16} className="mr-2"/> Klaar voor Pas
                                </Button>
                            )}
                            {ticket.status === 'READY' && (
                                <Button onClick={() => updateTicketStatus(ticket.id, 'SERVED')} variant="secondary" className="w-full text-xs h-10">
                                    Uitgeserveerd
                                </Button>
                            )}
                            {ticket.status === 'SERVED' && (
                                <div className="text-center text-xs font-bold text-slate-500 uppercase tracking-widest py-2">
                                    Afgerond
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                
                {tickets.length === 0 && (
                    <div className="col-span-full py-20 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
                        <CheckCircle2 size={48} className="mx-auto mb-4 opacity-20" />
                        <p>Geen bestellingen meer. Goed gewerkt!</p>
                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};
