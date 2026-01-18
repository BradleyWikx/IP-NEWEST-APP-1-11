import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, Users, Calendar, AlertCircle, 
  DollarSign, Clock, ArrowRight, CheckCircle2,
  Ticket, ChefHat, Activity, BarChart3, Database,
  ChevronLeft, ChevronRight, RotateCcw
} from 'lucide-react';
import { Card, Button, Badge } from '../UI';
import { 
  bookingRepo, waitlistRepo, calendarRepo, 
  getShowDefinitions 
} from '../../utils/storage';
import { Reservation } from '../../types';

export const DashboardHome = () => {
  const navigate = useNavigate();
  
  // Time Travel State
  const [viewDate, setViewDate] = useState(new Date());

  // Stats State
  const [stats, setStats] = useState({
    monthlyRevenue: 0,
    monthlyGuests: 0,
    occupancyRate: 0,
    waitlistCount: 0
  });
  const [forecast, setForecast] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<Reservation[]>([]);
  const [todayStats, setTodayStats] = useState<any>(null);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Live update
    return () => clearInterval(interval);
  }, []); // Run once on mount

  // Reload data whenever viewDate changes
  useEffect(() => {
    loadDashboardData();
  }, [viewDate]);

  const loadDashboardData = () => {
    const currentMonth = viewDate.getMonth();
    const currentYear = viewDate.getFullYear();
    const viewDateStr = viewDate.toISOString().split('T')[0];

    const allRes = bookingRepo.getAll();
    const allWaitlist = waitlistRepo.getAll();
    const allEvents = calendarRepo.getAll(); // Changed from getLegacyEvents

    // 1. KPI Stats (Selected Month)
    const thisMonthRes = allRes.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && r.status !== 'CANCELLED' && r.status !== 'ARCHIVED';
    });

    const revenue = thisMonthRes.reduce((sum, r) => sum + (r.financials.finalTotal || 0), 0);
    const guests = thisMonthRes.reduce((sum, r) => sum + r.partySize, 0);
    const activeWaitlist = allWaitlist.filter(w => w.status === 'PENDING').length;

    // Occupancy (Avg of Shows this month)
    const monthEvents = allEvents.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    let totalCap = 0;
    let totalBooked = 0;
    monthEvents.forEach(e => {
      if (e.type === 'SHOW') {
        totalCap += (e.capacity || 230);
        const dayRes = allRes.filter(r => r.date === e.date && r.status !== 'CANCELLED');
        totalBooked += dayRes.reduce((s, r) => s + r.partySize, 0);
      }
    });
    const occupancy = totalCap > 0 ? Math.round((totalBooked / totalCap) * 100) : 0;

    setStats({
      monthlyRevenue: revenue,
      monthlyGuests: guests,
      occupancyRate: occupancy,
      waitlistCount: activeWaitlist
    });

    // 2. Forecast (Next 14 Days from View Date)
    const next14Days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(viewDate);
      d.setDate(d.getDate() + i);
      const dStr = d.toISOString().split('T')[0];
      
      const event = allEvents.find(e => e.date === dStr);
      if (event && event.type === 'SHOW') {
        const dayRes = allRes.filter(r => r.date === dStr && r.status !== 'CANCELLED');
        const booked = dayRes.reduce((s, r) => s + r.partySize, 0);
        const capacity = event.capacity || 230;
        next14Days.push({
          date: d,
          dayName: d.toLocaleDateString('nl-NL', { weekday: 'short' }),
          booked,
          capacity,
          percentage: Math.min(100, Math.round((booked / capacity) * 100)),
          isToday: i === 0
        });
      }
    }
    setForecast(next14Days);

    // 3. Recent Activity (Global - Last 6 created)
    const sortedRes = [...allRes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setRecentActivity(sortedRes.slice(0, 6));

    // 4. Operational View (Specific View Date)
    const todayRes = allRes.filter(r => r.date === viewDateStr && r.status !== 'CANCELLED');
    const todayEvent = allEvents.find(e => e.date === viewDateStr);
    
    setTodayStats({
      count: todayRes.reduce((s, r) => s + r.partySize, 0),
      dietary: todayRes.filter(r => r.notes.dietary).length,
      vip: todayRes.filter(r => r.packageType === 'premium').length,
      event: todayEvent
    });
  };

  const navigateMonth = (delta: number) => {
    const newDate = new Date(viewDate);
    newDate.setMonth(newDate.getMonth() + delta);
    newDate.setDate(1); // Reset to first of month to avoid overflow issues
    setViewDate(newDate);
  };

  const jumpToToday = () => {
    setViewDate(new Date());
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h2 className="text-3xl font-serif text-white flex items-center">
            Dashboard
          </h2>
          <p className="text-slate-500 text-sm">Real-time overzicht.</p>
        </div>
        
        <div className="flex items-center space-x-4">
            {/* Time Travel Controls */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
                <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors">
                    <ChevronLeft size={16} />
                </button>
                <div className="px-4 text-sm font-bold text-white min-w-[140px] text-center capitalize">
                    {viewDate.toLocaleString('nl-NL', { month: 'long', year: 'numeric' })}
                </div>
                <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors">
                    <ChevronRight size={16} />
                </button>
            </div>

            {viewDate.getMonth() !== new Date().getMonth() && (
                <Button variant="ghost" onClick={jumpToToday} className="text-xs h-10 px-3 border border-slate-800">
                    <RotateCcw size={14} className="mr-2"/> Vandaag
                </Button>
            )}

            <div className="h-8 w-px bg-slate-800 mx-2" />

            <Button onClick={() => navigate('/admin/calendar')} className="flex items-center text-xs h-10">
                <Calendar size={16} className="mr-2"/> Agenda
            </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 bg-slate-900 border-slate-800 flex flex-col justify-between h-32 relative overflow-hidden group hover:border-emerald-500/50 transition-all">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
             <DollarSign size={64} />
           </div>
           <div className="flex justify-between items-start z-10">
             <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Omzet ({viewDate.toLocaleString('default', {month:'short'})})</span>
             <TrendingUp size={16} className="text-emerald-500"/>
           </div>
           <div className="z-10">
             <span className="text-3xl font-serif text-white font-bold">€{stats.monthlyRevenue.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}</span>
             <span className="text-[10px] text-slate-500 block mt-1">Geselecteerde maand</span>
           </div>
        </Card>

        <Card className="p-6 bg-slate-900 border-slate-800 flex flex-col justify-between h-32 relative overflow-hidden group hover:border-blue-500/50 transition-all">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
             <Users size={64} />
           </div>
           <div className="flex justify-between items-start z-10">
             <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">Gasten ({viewDate.toLocaleString('default', {month:'short'})})</span>
             <Activity size={16} className="text-blue-500"/>
           </div>
           <div className="z-10">
             <span className="text-3xl font-serif text-white font-bold">{stats.monthlyGuests}</span>
             <span className="text-[10px] text-slate-500 block mt-1">Geselecteerde maand</span>
           </div>
        </Card>

        <Card className="p-6 bg-slate-900 border-slate-800 flex flex-col justify-between h-32 relative overflow-hidden group hover:border-amber-500/50 transition-all">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
             <BarChart3 size={64} />
           </div>
           <div className="flex justify-between items-start z-10">
             <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">Bezetting</span>
             <Clock size={16} className="text-amber-500"/>
           </div>
           <div className="z-10">
             <span className="text-3xl font-serif text-white font-bold">{stats.occupancyRate}%</span>
             <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
               <div className="h-full bg-amber-500" style={{ width: `${stats.occupancyRate}%` }} />
             </div>
           </div>
        </Card>

        <Card className="p-6 bg-slate-900 border-slate-800 flex flex-col justify-between h-32 relative overflow-hidden group hover:border-purple-500/50 transition-all cursor-pointer" onClick={() => navigate('/admin/waitlist')}>
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
             <AlertCircle size={64} />
           </div>
           <div className="flex justify-between items-start z-10">
             <span className="text-xs font-bold text-purple-500 uppercase tracking-widest">Wachtlijst</span>
             <ArrowRight size={16} className="text-purple-500"/>
           </div>
           <div className="z-10">
             <span className="text-3xl font-serif text-white font-bold">{stats.waitlistCount}</span>
             <span className="text-[10px] text-slate-500 block mt-1">Openstaande verzoeken</span>
           </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Forecast & Ops (2/3) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Visual Forecast Chart */}
          <Card className="p-6 bg-slate-900 border-slate-800">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">Bezetting 14 Dagen (vanaf {viewDate.getDate()} {viewDate.toLocaleString('default',{month:'short'})})</h3>
              <div className="flex items-center space-x-3 text-[10px] uppercase font-bold text-slate-500">
                <span className="flex items-center"><div className="w-2 h-2 bg-emerald-500 rounded-full mr-1"/> Ruimte</span>
                <span className="flex items-center"><div className="w-2 h-2 bg-amber-500 rounded-full mr-1"/> Druk</span>
                <span className="flex items-center"><div className="w-2 h-2 bg-red-500 rounded-full mr-1"/> Vol</span>
              </div>
            </div>
            
            <div className="h-48 flex items-end space-x-2 md:space-x-4 overflow-x-auto pb-2 custom-scrollbar">
              {forecast.length === 0 && <p className="text-slate-500 text-sm w-full text-center py-10">Geen shows gepland in deze periode.</p>}
              {forecast.map((day, i) => (
                <div key={i} className="flex-1 min-w-[30px] flex flex-col items-center group relative">
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] px-2 py-1 rounded whitespace-nowrap pointer-events-none z-10 border border-slate-700">
                    {new Date(day.date).toLocaleDateString()} • {day.booked} gasten
                  </div>
                  
                  <div className="w-full bg-slate-800 rounded-t-lg relative overflow-hidden" style={{ height: '140px' }}>
                    <div 
                      className={`absolute bottom-0 w-full transition-all duration-1000 ease-out ${
                        day.percentage > 95 ? 'bg-red-500' : 
                        day.percentage > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ height: `${day.percentage}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-bold mt-2 uppercase ${day.isToday ? 'text-white bg-slate-700 px-1.5 rounded' : 'text-slate-500'}`}>
                    {day.dayName}
                  </span>
                  <span className="text-[9px] text-slate-600">{new Date(day.date).getDate()}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Operational Day Panel */}
          {todayStats && todayStats.event ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <Card className="p-6 bg-slate-900 border-slate-800 relative overflow-hidden">
                  <div className="relative z-10">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center">
                      <ChefHat size={16} className="mr-2"/> Keuken ({viewDate.toLocaleDateString()})
                    </h3>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-4xl font-black text-white">{todayStats.count}</span>
                      <span className="text-sm text-slate-500">Covers</span>
                    </div>
                    <div className="mt-4 flex space-x-4 text-xs font-bold">
                      <span className="px-2 py-1 bg-red-900/20 text-red-400 rounded border border-red-900/30">{todayStats.dietary} Dieet</span>
                      <span className="px-2 py-1 bg-amber-900/20 text-amber-400 rounded border border-amber-900/30">{todayStats.vip} Premium</span>
                    </div>
                  </div>
                  <Button variant="ghost" onClick={() => navigate('/admin/kitchen')} className="absolute bottom-4 right-4 text-xs h-8">
                    Open Display <ArrowRight size={12} className="ml-1"/>
                  </Button>
               </Card>

               <Card className="p-6 bg-slate-900 border-slate-800 relative overflow-hidden">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center">
                    <Ticket size={16} className="mr-2"/> Host ({viewDate.toLocaleDateString()})
                  </h3>
                  <p className="text-lg font-bold text-white truncate">{todayStats.event.title}</p>
                  <p className="text-sm text-slate-500">{todayStats.event.times?.start} Aanvang</p>
                  
                  <Button variant="ghost" onClick={() => navigate('/admin/host')} className="absolute bottom-4 right-4 text-xs h-8">
                    Open Host Mode <ArrowRight size={12} className="ml-1"/>
                  </Button>
               </Card>
            </div>
          ) : (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-500 italic">
               Geen voorstelling op {viewDate.toLocaleDateString()}.
            </div>
          )}
        </div>

        {/* Right Column: Activity & Quick Lists (1/3) */}
        <div className="space-y-8">
           <Card className="bg-slate-900 border-slate-800 flex flex-col h-full max-h-[600px]">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <h3 className="font-bold text-white text-sm">Recente Activiteit (Globaal)</h3>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <div className="flex-grow overflow-y-auto custom-scrollbar p-2">
                 {recentActivity.map(res => (
                   <div 
                     key={res.id} 
                     onClick={() => navigate(`/admin/reservations?open=${res.id}`)}
                     className="p-3 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors group border-b border-slate-800/50 last:border-0"
                   >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-bold text-white group-hover:text-amber-500 transition-colors">
                          {res.customer.lastName}, {res.customer.firstName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">{new Date(res.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-400">
                        <span>{new Date(res.date).toLocaleDateString('nl-NL', {day:'numeric', month:'short'})} • {res.partySize}p</span>
                        <Badge status={res.status} className="scale-75 origin-right">{res.status}</Badge>
                      </div>
                   </div>
                 ))}
                 {recentActivity.length === 0 && <p className="text-center text-slate-500 text-xs py-8">Geen recente activiteit.</p>}
              </div>
              <div className="p-3 border-t border-slate-800 bg-slate-950/50">
                <Button variant="ghost" onClick={() => navigate('/admin/reservations')} className="w-full text-xs h-8">
                  Alle Reserveringen
                </Button>
              </div>
           </Card>
        </div>

      </div>
    </div>
  );
};