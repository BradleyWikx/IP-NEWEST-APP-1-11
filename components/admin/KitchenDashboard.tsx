
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Utensils, Wine, Clock, RefreshCw, 
  ChefHat, AlertTriangle, Calendar, Printer, 
  ChevronLeft, ChevronRight, BarChart3, Leaf, Wheat, Milk, Info,
  CheckCircle2
} from 'lucide-react';
import { Card, Button } from '../UI';
import { bookingRepo } from '../../utils/storage';
import { Reservation, BookingStatus } from '../../types';
import { MOCK_ADDONS } from '../../mock/data';

// --- TYPES ---

interface DailyStats {
  date: string;
  totalPax: number;
  standardPax: number;
  premiumPax: number;
  dietaryCounts: Record<string, number>;
  dietaryDetails: { type: string; guest: string; table: string; note: string }[];
  addons: Record<string, number>;
}

// --- HELPER COMPONENTS ---

const StatBox = ({ label, value, icon: Icon, color = "slate", sub }: any) => (
  <Card className={`p-4 border-${color}-900/30 bg-${color}-900/10 flex items-center justify-between`}>
    <div>
      <p className={`text-[10px] font-bold uppercase tracking-widest text-${color}-400 mb-1`}>{label}</p>
      <p className="text-3xl font-black text-white">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
    <div className={`p-3 rounded-xl bg-${color}-900/20 text-${color}-500`}>
      <Icon size={24} />
    </div>
  </Card>
);

interface AllergyCardProps {
  type: string;
  count: number;
  details: { type: string; guest: string; table: string; note: string }[];
}

const AllergyCard: React.FC<AllergyCardProps> = ({ type, count, details }) => {
  const [expanded, setExpanded] = useState(false);
  
  // Icon mapping
  let Icon = AlertTriangle;
  let colorClass = "text-red-500 bg-red-900/20 border-red-900/50";
  
  if (type.toLowerCase().includes('vega')) { Icon = Leaf; colorClass = "text-emerald-500 bg-emerald-900/20 border-emerald-900/50"; }
  if (type.toLowerCase().includes('gluten')) { Icon = Wheat; colorClass = "text-amber-500 bg-amber-900/20 border-amber-900/50"; }
  if (type.toLowerCase().includes('lacto')) { Icon = Milk; colorClass = "text-blue-400 bg-blue-900/20 border-blue-900/50"; }

  return (
    <div className={`rounded-xl border transition-all ${colorClass} ${expanded ? 'row-span-2' : ''}`}>
      <div 
        className="p-4 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center space-x-3">
          <Icon size={20} />
          <span className="font-bold text-white uppercase tracking-wider">{type}</span>
        </div>
        <span className="text-2xl font-black">{count}x</span>
      </div>
      
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-white/10 mt-2">
          <p className="text-[10px] font-bold uppercase text-white/50 mb-2 pt-2">Tafels & Gasten</p>
          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
            {details.map((d, i) => (
              <div key={i} className="flex justify-between text-xs text-white/90">
                <span>{d.guest} {d.table !== '?' ? `(Tafel ${d.table})` : ''}</span>
                {d.note && <span className="italic opacity-70">- {d.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const KitchenDashboard = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [forecast, setForecast] = useState<{date: Date, count: number}[]>([]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 30000); // 30s poll
    window.addEventListener('storage-update', refreshData);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage-update', refreshData);
    };
  }, [selectedDate]);

  const refreshData = () => {
    setLoading(true);
    const allReservations = bookingRepo.getAll();
    const dateStr = selectedDate.toISOString().split('T')[0];

    // 1. PROCESS DAILY STATS
    const activeRes = allReservations.filter(r => 
      r.date === dateStr && 
      !['CANCELLED', 'ARCHIVED', 'NOSHOW', 'WAITLIST'].includes(r.status)
    );

    const newStats: DailyStats = {
      date: dateStr,
      totalPax: 0,
      standardPax: 0,
      premiumPax: 0,
      dietaryCounts: {},
      dietaryDetails: [],
      addons: {}
    };

    activeRes.forEach(r => {
      newStats.totalPax += r.partySize;
      if (r.packageType === 'premium') newStats.premiumPax += r.partySize;
      else newStats.standardPax += r.partySize;

      // Process Addons (Flatten logic)
      r.addons.forEach(addon => {
        const def = MOCK_ADDONS.find(a => a.id === addon.id);
        const name = def ? def.name : addon.id;
        newStats.addons[name] = (newStats.addons[name] || 0) + addon.quantity;
      });

      // Process Dietary (Structured + Comments)
      const tableNum = (r as any).tableNumber || (r.tableId ? r.tableId.replace('TAB-', '') : '?');
      const guestName = r.customer.companyName || r.customer.lastName;

      // 1. Structured
      if (r.notes.structuredDietary) {
        Object.entries(r.notes.structuredDietary).forEach(([type, count]) => {
          if (count > 0) {
            newStats.dietaryCounts[type] = (newStats.dietaryCounts[type] || 0) + count;
            // Add entry for detail view
            for(let i=0; i<count; i++) {
                newStats.dietaryDetails.push({ 
                    type, 
                    guest: guestName, 
                    table: tableNum, 
                    note: '' 
                });
            }
          }
        });
      }

      // 2. Free Text (If present and NOT just summarizing structured)
      // Simple logic: if text exists, add it as a "Special Note" category
      if (r.notes.dietary && (!r.notes.structuredDietary || Object.keys(r.notes.structuredDietary).length === 0)) {
         const type = "Overig / Specifiek";
         newStats.dietaryCounts[type] = (newStats.dietaryCounts[type] || 0) + 1; // Count as 1 entry/group
         newStats.dietaryDetails.push({
             type,
             guest: guestName,
             table: tableNum,
             note: r.notes.dietary
         });
      }
    });

    setStats(newStats);

    // 2. PROCESS FORECAST (Next 7 days)
    const nextWeek = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + i);
      const dStr = d.toISOString().split('T')[0];
      
      const dayCount = allReservations
        .filter(r => r.date === dStr && !['CANCELLED', 'ARCHIVED', 'NOSHOW', 'WAITLIST'].includes(r.status))
        .reduce((sum, r) => sum + r.partySize, 0);
      
      nextWeek.push({ date: d, count: dayCount });
    }
    setForecast(nextWeek);
    
    setTimeout(() => setLoading(false), 300);
  };

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-black text-slate-100 p-4 md:p-8 font-sans">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 print:hidden">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-amber-500">
            <ChefHat size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-white">Keuken Rapportage</h1>
            <p className="text-slate-500 text-sm">Buffet & Productie Overzicht</p>
          </div>
        </div>

        <div className="flex items-center bg-slate-900 rounded-xl p-1 border border-slate-800">
           <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d); }} className="p-3 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><ChevronLeft size={20}/></button>
           <div className="px-6 text-center">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">{selectedDate.toLocaleDateString('nl-NL', { weekday: 'long' })}</div>
              <div className="text-xl font-bold text-white">{selectedDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}</div>
           </div>
           <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d); }} className="p-3 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><ChevronRight size={20}/></button>
        </div>

        <div className="flex space-x-2">
           <Button onClick={refreshData} variant="ghost" className="h-12 w-12 p-0 rounded-xl border-slate-800 text-slate-400">
             <RefreshCw size={20} className={loading ? 'animate-spin' : ''}/>
           </Button>
           <Button onClick={handlePrint} className="h-12 bg-white text-black hover:bg-slate-200 border-none px-6 font-bold shadow-lg shadow-white/10">
             <Printer size={18} className="mr-2"/> Print Lijst
           </Button>
        </div>
      </div>

      {/* PRINT HEADER ONLY */}
      <div className="hidden print:block mb-8 border-b-4 border-black pb-4 text-black">
         <h1 className="text-4xl font-black uppercase">Keuken Productie</h1>
         <p className="text-xl">{selectedDate.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* MAIN CONTENT (Left 2/3) */}
        <div className="lg:col-span-2 space-y-8">
           
           {/* TOP STATS */}
           <div className="grid grid-cols-3 gap-4">
              <StatBox label="Totaal Pax" value={stats?.totalPax} icon={Users} color="emerald" sub="Productie Aantal" />
              <StatBox label="Dieetwensen" value={Object.values(stats?.dietaryCounts || {}).reduce((a: number, b: number) => a + b, 0)} icon={AlertTriangle} color="red" sub="Speciale Aandacht" />
              <StatBox label="Add-ons" value={Object.values(stats?.addons || {}).reduce((a: number, b: number) => a + b, 0)} icon={Wine} color="blue" sub="Drank/Extra" />
           </div>

           {/* DIETARY MATRIX */}
           <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-2">
                 <AlertTriangle className="text-amber-500" size={20} />
                 <h2 className="text-xl font-bold text-white uppercase tracking-wider print:text-black">Allergieën & Dieetwensen</h2>
              </div>
              
              {Object.keys(stats?.dietaryCounts || {}).length === 0 ? (
                 <div className="p-8 border-2 border-dashed border-slate-800 rounded-2xl text-center text-slate-500 bg-slate-900/30 print:border-gray-300 print:text-black">
                    <CheckCircle2 size={32} className="mx-auto mb-2 opacity-50"/>
                    <p>Geen dieetwensen voor deze dag.</p>
                 </div>
              ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(stats?.dietaryCounts || {}).map(([type, count]) => (
                        <AllergyCard 
                           key={type} 
                           type={type} 
                           count={count as number} 
                           details={(stats?.dietaryDetails || []).filter(d => d.type === type)}
                        />
                    ))}
                 </div>
              )}
           </div>

           {/* ADDONS / BAR INFO */}
           <div className="space-y-4 pt-4 border-t border-slate-800 print:border-black">
              <div className="flex items-center space-x-2 mb-2">
                 <Wine className="text-blue-500" size={20} />
                 <h2 className="text-xl font-bold text-white uppercase tracking-wider print:text-black">Bar & Extra's</h2>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 print:border-gray-300 print:bg-white print:text-black">
                    <p className="text-[10px] text-slate-500 uppercase font-bold print:text-gray-600">Standard</p>
                    <p className="text-2xl font-bold text-white print:text-black">{stats?.standardPax}</p>
                 </div>
                 <div className="p-4 bg-amber-900/10 rounded-xl border border-amber-900/30 print:border-gray-300 print:bg-white print:text-black">
                    <p className="text-[10px] text-amber-500 uppercase font-bold print:text-gray-600">Premium</p>
                    <p className="text-2xl font-bold text-amber-500 print:text-black">{stats?.premiumPax}</p>
                 </div>
                 {Object.entries(stats?.addons || {}).map(([name, count]) => (
                    <div key={name} className="p-4 bg-blue-900/10 rounded-xl border border-blue-900/30 print:border-gray-300 print:bg-white print:text-black">
                        <p className="text-[10px] text-blue-400 uppercase font-bold print:text-gray-600">{name}</p>
                        <p className="text-2xl font-bold text-blue-400 print:text-black">{count as number}</p>
                    </div>
                 ))}
              </div>
           </div>

        </div>

        {/* SIDEBAR: WEEK FORECAST (Hidden on print) */}
        <div className="space-y-6 print:hidden">
           <Card className="p-6 bg-slate-900 border-slate-800">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center">
                 <Calendar size={16} className="mr-2"/> Week Productie
              </h3>
              
              <div className="space-y-4">
                 {forecast.map((day, i) => (
                    <div key={i} className="flex items-center justify-between group">
                       <div>
                          <div className={`text-sm font-bold ${i===0 ? 'text-white' : 'text-slate-400'}`}>
                             {day.date.toLocaleDateString('nl-NL', { weekday: 'long' })}
                          </div>
                          <div className="text-[10px] text-slate-600 font-mono">
                             {day.date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                          </div>
                       </div>
                       <div className="flex items-center">
                          <span className={`text-lg font-bold font-mono mr-3 ${day.count > 150 ? 'text-amber-500' : 'text-white'}`}>
                             {day.count}
                          </span>
                          <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                             <div 
                                className={`h-full ${day.count > 150 ? 'bg-amber-500' : 'bg-blue-600'}`} 
                                style={{ width: `${Math.min(100, (day.count/230)*100)}%` }}
                             />
                          </div>
                       </div>
                    </div>
                 ))}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800 text-xs text-slate-500">
                 <p className="flex items-start">
                    <Info size={14} className="mr-2 shrink-0 mt-0.5" />
                    Gebaseerd op huidige reserveringen. Last-minute boekingen kunnen deze aantallen wijzigen.
                 </p>
              </div>
           </Card>
        </div>

      </div>
    </div>
  );
};
