
import React, { useState, useEffect } from 'react';
import { 
  Users, Utensils, Wine, Clock, RefreshCw, 
  ChefHat, AlertTriangle
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
    dietary: [] as { name: string; count: number }[],
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

    // 2. Aggregate Dietary
    // Use structured data if available, fallback to manual string parsing if needed (simple aggregation here)
    const dietaryMap = new Map<string, number>();
    
    relevant.forEach(r => {
      // Priority: Structured Data
      if (r.notes.structuredDietary) {
        Object.entries(r.notes.structuredDietary).forEach(([key, count]) => {
          dietaryMap.set(key, (dietaryMap.get(key) || 0) + count);
        });
      } 
      // Fallback or additional: Free text notes if present and NOT covered by structured
      // This is tricky, for now we list distinct free-text notes as individual lines if no structured data exists
      else if (r.notes.dietary) {
        const key = r.notes.dietary.trim(); // Simplified grouping by exact string match
        dietaryMap.set(key, (dietaryMap.get(key) || 0) + 1); // Count occurrences of the NOTE, not guests (as string might say "2x Vegan")
      }
    });

    const dietaryList = Array.from(dietaryMap.entries()).map(([name, count]) => ({ name, count }));

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
      dietary: dietaryList,
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Column 1: Main Covers */}
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

        {/* Column 2: Dietary */}
        <Card className="lg:col-span-1 bg-red-950/20 border-red-900/30 border p-0 overflow-hidden flex flex-col">
           <div className="p-6 border-b border-red-900/30 bg-red-900/10 flex items-center space-x-3">
             <Utensils size={24} className="text-red-500" />
             <h2 className="text-xl font-bold text-red-100 uppercase tracking-wide">Dieetwensen</h2>
           </div>
           <div className="flex-grow p-6 overflow-y-auto max-h-[600px]">
             {stats.dietary.length === 0 ? (
               <div className="h-full flex items-center justify-center text-red-800 italic">Geen bijzonderheden.</div>
             ) : (
               <div className="space-y-3">
                 {stats.dietary.map((item, idx) => (
                   <div key={idx} className="flex justify-between items-center text-lg p-3 rounded-lg bg-red-900/10 border border-red-900/20">
                      <span className="font-bold text-red-200">{item.name}</span>
                      <span className="font-black text-2xl text-red-500 bg-black/30 px-3 py-1 rounded-lg min-w-[3rem] text-center">{item.count}</span>
                   </div>
                 ))}
               </div>
             )}
           </div>
        </Card>

        {/* Column 3: Add-ons */}
        <Card className="lg:col-span-1 bg-blue-950/20 border-blue-900/30 border p-0 overflow-hidden flex flex-col">
           <div className="p-6 border-b border-blue-900/30 bg-blue-900/10 flex items-center space-x-3">
             <Wine size={24} className="text-blue-500" />
             <h2 className="text-xl font-bold text-blue-100 uppercase tracking-wide">Add-ons & Dranken</h2>
           </div>
           <div className="flex-grow p-6 overflow-y-auto max-h-[600px]">
             {stats.addons.length === 0 ? (
               <div className="h-full flex items-center justify-center text-blue-800 italic">Geen extra's geboekt.</div>
             ) : (
               <div className="space-y-3">
                 {stats.addons.map((item, idx) => (
                   <div key={idx} className="flex justify-between items-center text-lg p-3 rounded-lg bg-blue-900/10 border border-blue-900/20">
                      <span className="font-bold text-blue-200">{item.name}</span>
                      <span className="font-black text-2xl text-blue-500 bg-black/30 px-3 py-1 rounded-lg min-w-[3rem] text-center">{item.count}</span>
                   </div>
                 ))}
               </div>
             )}
           </div>
        </Card>

      </div>
    </div>
  );
};
