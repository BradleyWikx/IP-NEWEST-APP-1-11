
import React, { useState, useEffect } from 'react';
import { 
  Users, Utensils, Wine, Clock, RefreshCw, 
  ChefHat, AlertTriangle, ClipboardList, StickyNote
} from 'lucide-react';
import { Card } from '../UI';
import { bookingRepo } from '../../utils/storage';
import { Reservation, BookingStatus } from '../../types';
import { MOCK_ADDONS } from '../../mock/data';

export const KitchenDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  
  // Data State
  const [stats, setStats] = useState({
    totalGuests: 0,
    standardCount: 0,
    premiumCount: 0,
    productionCounts: [] as { name: string; count: number }[], // Blok A: Aggregated
    serviceTickets: [] as { id: string; name: string; table?: string; details: string; type: 'DIET' | 'COMMENT' }[], // Blok B: Specifics
    addons: [] as { name: string; count: number }[],
    reservationsCount: 0
  });

  const today = new Date().toISOString().split('T')[0];

  const refreshData = () => {
    setLoading(true);
    const all = bookingRepo.getAll();
    
    // Filter for TODAY + Active
    const relevant = all.filter(r => 
      r.date === today && 
      r.status !== BookingStatus.CANCELLED && 
      r.status !== BookingStatus.NOSHOW && // Don't cook for no-shows
      r.status !== BookingStatus.ARCHIVED
    );

    // 1. Basic Counts
    const totalGuests = relevant.reduce((sum, r) => sum + r.partySize, 0);
    const standardCount = relevant.filter(r => r.packageType === 'standard').reduce((sum, r) => sum + r.partySize, 0);
    const premiumCount = relevant.filter(r => r.packageType === 'premium').reduce((sum, r) => sum + r.partySize, 0);

    // 2. Dietary & Notes Processing
    const productionMap = new Map<string, number>();
    const tickets: typeof stats.serviceTickets = [];

    relevant.forEach(r => {
      // --- BLOCK A: PRODUCTION (Mise-en-place) ---
      // Only count structured data here for bulk cooking
      if (r.notes.structuredDietary) {
        Object.entries(r.notes.structuredDietary).forEach(([key, count]) => {
          if (count > 0) {
            productionMap.set(key, (productionMap.get(key) || 0) + count);
          }
        });
      }

      // --- BLOCK B: SERVICE (Tickets) ---
      // Any specific comment OR dietary note needs a ticket
      // We combine specific comments and dietary strings into a readable ticket
      const hasComments = !!r.notes.comments;
      const hasDietary = !!r.notes.dietary;
      
      if (hasComments || hasDietary) {
        let details = '';
        if (hasDietary) details += r.notes.dietary;
        if (hasComments) details += (details ? ' | ' : '') + `"${r.notes.comments}"`;

        tickets.push({
          id: r.id,
          name: `${r.customer.firstName} ${r.customer.lastName}`,
          table: (r as any).tableNumber, // Cast as any since tableNumber might be injected by HostView logic
          details: details,
          type: hasComments ? 'COMMENT' : 'DIET'
        });
      }
    });

    const productionList = Array.from(productionMap.entries()).map(([name, count]) => ({ name, count }));

    // 3. Aggregate Addons
    const addonMap = new Map<string, number>();
    relevant.forEach(r => {
      r.addons.forEach(a => {
        const def = MOCK_ADDONS.find(ad => ad.id === a.id);
        const name = def ? def.name : a.id;
        addonMap.set(name, (addonMap.get(name) || 0) + a.quantity);
      });
    });
    
    const addonList = Array.from(addonMap.entries()).map(([name, count]) => ({ name, count }));

    setStats({
      totalGuests,
      standardCount,
      premiumCount,
      productionCounts: productionList,
      serviceTickets: tickets,
      addons: addonList,
      reservationsCount: relevant.length
    });

    setLastRefreshed(new Date());
    setTimeout(() => setLoading(false), 500); // Visual delay
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 30000); // 30s Auto Refresh
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-slate-100 p-4 md:p-8 font-sans">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-6">
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
           <button 
             onClick={refreshData} 
             disabled={loading}
             className="p-4 bg-slate-900 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
           >
             <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
        
        {/* COL 1: ALGEMEEN (Covers) */}
        <div className="space-y-6">
           <Card className="p-8 bg-slate-900 border-slate-800 flex flex-col items-center justify-center text-center h-64">
              <p className="text-slate-500 uppercase font-bold tracking-widest text-sm mb-2">Totaal Covers</p>
              <span className="text-8xl font-black text-white leading-none">{stats.totalGuests}</span>
              <p className="text-slate-600 mt-4 font-mono">{stats.reservationsCount} Bonnen</p>
           </Card>

           <div className="grid grid-cols-2 gap-4">
              <Card className="p-6 bg-slate-900 border-slate-800 text-center">
                 <p className="text-slate-500 text-xs font-bold uppercase">Standard</p>
                 <span className="text-4xl font-bold text-slate-300 block my-2">{stats.standardCount}</span>
              </Card>
              <Card className="p-6 bg-slate-900 border-amber-900/30 text-center relative overflow-hidden">
                 <div className="absolute inset-0 bg-amber-500/5" />
                 <p className="text-amber-500 text-xs font-bold uppercase relative z-10">Premium</p>
                 <span className="text-4xl font-bold text-amber-400 block my-2 relative z-10">{stats.premiumCount}</span>
              </Card>
           </div>
        </div>

        {/* COL 2: PRODUCTIE & MISE-EN-PLACE (Block A + Addons) */}
        <div className="space-y-6 flex flex-col">
           {/* BLOCK A: Aggregated Dietary */}
           <Card className="bg-slate-900 border-slate-800 p-0 overflow-hidden flex-1">
             <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
               <div className="flex items-center space-x-3">
                 <ClipboardList size={20} className="text-emerald-500" />
                 <h2 className="text-lg font-bold text-white uppercase tracking-wide">Mise-en-place</h2>
               </div>
               <span className="text-[10px] bg-emerald-900/20 text-emerald-500 px-2 py-1 rounded font-bold uppercase">Productie</span>
             </div>
             
             <div className="p-4 space-y-3">
               {stats.productionCounts.length === 0 ? (
                 <div className="p-4 text-center text-slate-500 italic">Geen bijzonderheden.</div>
               ) : (
                 stats.productionCounts.map((item, idx) => (
                   <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-slate-800/50 border border-slate-700">
                      <span className="font-bold text-slate-200 text-lg">{item.name}</span>
                      <span className="font-black text-2xl text-emerald-400">{item.count}x</span>
                   </div>
                 ))
               )}
             </div>
           </Card>

           {/* Add-ons */}
           <Card className="bg-blue-950/10 border-blue-900/30 border p-0 overflow-hidden flex-1">
             <div className="p-4 border-b border-blue-900/30 bg-blue-900/10 flex items-center space-x-3">
               <Wine size={20} className="text-blue-500" />
               <h2 className="text-lg font-bold text-blue-100 uppercase tracking-wide">Drank & Extra</h2>
             </div>
             <div className="p-4 space-y-3">
               {stats.addons.length === 0 ? (
                 <div className="p-4 text-center text-blue-800 italic">Geen extra's.</div>
               ) : (
                 stats.addons.map((item, idx) => (
                   <div key={idx} className="flex justify-between items-center text-sm font-bold text-blue-200 border-b border-blue-900/20 pb-2 last:border-0">
                      <span>{item.name}</span>
                      <span className="text-lg text-blue-400">{item.count}</span>
                   </div>
                 ))
               )}
             </div>
           </Card>
        </div>

        {/* COL 3: SERVICE / SPECIALS (Block B) */}
        <Card className="lg:col-span-1 bg-amber-950/10 border-amber-900/30 border p-0 overflow-hidden flex flex-col h-full">
           <div className="p-4 border-b border-amber-900/30 bg-amber-900/10 flex items-center justify-between">
             <div className="flex items-center space-x-3">
               <StickyNote size={20} className="text-amber-500" />
               <h2 className="text-lg font-bold text-amber-100 uppercase tracking-wide">Speciale Verzoeken</h2>
             </div>
             <span className="text-[10px] bg-amber-900/20 text-amber-500 px-2 py-1 rounded font-bold uppercase">Service</span>
           </div>
           
           <div className="flex-grow p-4 overflow-y-auto custom-scrollbar space-y-3 bg-black/20">
             {stats.serviceTickets.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-amber-800/50 italic min-h-[200px]">
                 <AlertTriangle size={32} className="mb-2"/>
                 <p>Geen tickets voor de pas.</p>
               </div>
             ) : (
               stats.serviceTickets.map((ticket, idx) => (
                 <div key={idx} className="bg-amber-100 text-black p-4 rounded-lg shadow-lg relative overflow-hidden group">
                    {/* Tape visual */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-3 bg-white/30 backdrop-blur-sm -mt-1.5 rotate-2"></div>
                    
                    <div className="flex justify-between items-start mb-2 border-b border-amber-900/10 pb-2">
                       <span className="font-black text-lg uppercase tracking-tight truncate max-w-[150px]">
                         {ticket.table ? `TAFEL ${ticket.table}` : 'GEEN TAFEL'}
                       </span>
                       <span className="text-[10px] font-bold bg-black/10 px-1.5 py-0.5 rounded">
                         {ticket.type === 'COMMENT' ? 'OPM' : 'DIEET'}
                       </span>
                    </div>
                    
                    <p className="font-serif font-bold text-xl leading-tight mb-2">
                      {ticket.details}
                    </p>
                    
                    <div className="text-xs font-mono text-amber-900/70 uppercase">
                      Gast: {ticket.name}
                    </div>
                 </div>
               ))
             )}
           </div>
        </Card>

      </div>
    </div>
  );
};
