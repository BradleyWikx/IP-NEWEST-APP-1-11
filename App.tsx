
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminRole, BookingStatus } from './types';
import { useIframeResizer } from './hooks/useIframeResizer';

// --- Modules ---
import { BookingWizard } from './components/BookingWizard';
import { CustomerCalendar } from './components/Calendar';
import { ConfirmationScreen } from './components/ConfirmationScreen';
import { CustomerPortal } from './components/CustomerPortal';
import { NewsletterSignup } from './components/NewsletterSignup';
import { VoucherShop } from './components/VoucherShop';
// Admin
import { ReservationManager } from './components/admin/ReservationManager';
import { CalendarManager } from './components/admin/CalendarManager';
import { PlanningManager } from './components/admin/PlanningManager';
import { ShowsManager } from './components/admin/ShowsManager';
import { WaitlistManager } from './components/admin/WaitlistManager';
import { MerchandiseManager } from './components/admin/MerchandiseManager';
import { VoucherManager } from './components/admin/VoucherManager';
import { NewsletterManager } from './components/admin/NewsletterManager';
import { CustomerDatabase } from './components/admin/CustomerDatabase';
import { ChangeRequestInbox } from './components/admin/ChangeRequestInbox';
import { EmailCenter } from './components/admin/EmailCenter';
import { EmbedManager } from './components/admin/EmbedManager';
import { SettingsManager } from './components/admin/SettingsManager';
import { ReportsManager } from './components/admin/ReportsManager';
import { AuditLogViewer } from './components/admin/AuditLogViewer';
import { HostView } from './components/admin/HostView';
import { DemoControlPanel } from './components/admin/DemoControlPanel';
import { TaskManager } from './components/admin/TaskManager';
import { PaymentsManager } from './components/admin/PaymentsManager';
import { PromoManager } from './components/admin/PromoManager';
import { AdminBookingWizard } from './components/admin/AdminBookingWizard'; // NEW

// --- Dashboard Specifics ---
import { PaymentWidget } from './components/admin/PaymentWidget';
import { TasksWidget } from './components/admin/TasksWidget';
import { Card, Button } from './components/UI';
import { bookingRepo, isSeeded, requestRepo, getWaitlist, getEvents, getShowDefinitions } from './utils/storage';
import { seedDemoData } from './utils/seed';
import { 
  TrendingUp, Users, Calendar, AlertCircle, Plus, 
  ArrowRight, Activity, Clock, DollarSign, BarChart3
} from 'lucide-react';
import { ToastContainer } from './components/UI/Toast';

const StatCard = ({ label, value, sub, icon: Icon, color }: any) => (
  <Card className="p-6 bg-slate-900/50 border-slate-800 relative overflow-hidden group hover:border-slate-700 transition-all">
    <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-${color}-500`}>
      <Icon size={64} />
    </div>
    <div className="relative z-10">
      <div className={`p-2 rounded-lg bg-${color}-900/20 text-${color}-500 inline-block mb-4 border border-${color}-900/30`}>
        <Icon size={20} />
      </div>
      <p className="text-3xl font-serif text-white mb-1">{value}</p>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{label}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  </Card>
);

const QuickAction = ({ to, icon: Icon, label, desc }: any) => (
  <Link to={to} className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900 transition-all group text-left">
    <div className="flex items-center justify-between mb-2">
      <div className="p-2 bg-slate-900 rounded-lg text-slate-400 group-hover:text-amber-500 transition-colors">
        <Icon size={18} />
      </div>
      <ArrowRight size={14} className="text-slate-600 group-hover:text-white -translate-x-2 group-hover:translate-x-0 transition-transform opacity-0 group-hover:opacity-100" />
    </div>
    <p className="font-bold text-white text-sm">{label}</p>
    <p className="text-[10px] text-slate-500 mt-1">{desc}</p>
  </Link>
);

const CapacityMonitor = () => {
  const [upcoming, setUpcoming] = useState<any[]>([]);

  useEffect(() => {
    const allEvents = getEvents();
    const allShows = getShowDefinitions();
    const today = new Date().toISOString().split('T')[0];

    const upcomingEvents = allEvents
      .filter(e => e.date >= today && e.availability !== 'CLOSED')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5) // Show top 5 upcoming
      .map(e => {
        const show = allShows.find(s => s.id === e.showId);
        const pct = e.capacity > 0 ? (e.bookedCount / e.capacity) * 100 : 0;
        return { ...e, showName: show?.name || 'Show', pct };
      });

    setUpcoming(upcomingEvents);
  }, []);

  return (
    <Card className="bg-slate-900 border-slate-800 overflow-hidden">
      <div className="p-6 border-b border-slate-800 flex justify-between items-center">
        <div>
          <h3 className="font-serif text-lg text-white">Capaciteits Monitor</h3>
          <p className="text-xs text-slate-500">Komende shows & bezetting</p>
        </div>
        <Link to="/admin/calendar" className="text-xs text-slate-400 hover:text-white uppercase font-bold tracking-wider">
          Agenda <ArrowRight size={12} className="inline ml-1"/>
        </Link>
      </div>
      <div className="divide-y divide-slate-800">
        {upcoming.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Geen geplande shows gevonden.</div>
        ) : (
          upcoming.map((item, idx) => {
            let barColor = 'bg-emerald-500';
            if (item.pct > 60) barColor = 'bg-amber-500';
            if (item.pct > 85) barColor = 'bg-red-500';

            return (
              <div key={item.date} className="p-4 hover:bg-slate-800/30 transition-colors">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <p className="text-white font-bold text-sm">{item.showName}</p>
                    <p className="text-slate-500 text-xs capitalize">
                      {new Date(item.date).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono text-sm font-bold ${item.pct > 90 ? 'text-red-500' : 'text-slate-300'}`}>
                      {item.bookedCount} <span className="text-slate-600 text-xs font-normal">/ {item.capacity}</span>
                    </p>
                  </div>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div className={`h-full ${barColor} transition-all duration-1000 ease-out`} style={{ width: `${item.pct}%` }} />
                </div>
                {item.pct > 90 && (
                  <p className="text-[9px] text-red-500 mt-1 font-bold uppercase tracking-wide flex items-center">
                    <AlertCircle size={10} className="mr-1"/> Bijna Vol
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};

const DashboardHome = () => {
  const [stats, setStats] = useState({ todayGuests: 0, todayRevenue: 0, pendingRequests: 0, waitlistCount: 0 });
  const [recentBookings, setRecentBookings] = useState<any[]>([]);

  useEffect(() => {
    // Basic stats calculation
    const reservations = bookingRepo.getAll();
    const requests = requestRepo.getAll();
    const waitlist = getWaitlist();
    const todayStr = new Date().toISOString().split('T')[0];
    
    const todayRes = reservations.filter(r => r.date === todayStr && r.status !== 'CANCELLED');
    const revenue = todayRes.reduce((sum, r) => sum + (r.financials?.finalTotal || 0), 0);
    const pending = requests.filter(r => r.status === 'NEW').length;
    
    setStats({ 
      todayGuests: todayRes.reduce((s,r) => s + r.partySize, 0), 
      todayRevenue: revenue, 
      pendingRequests: pending,
      waitlistCount: waitlist.filter(w => w.status === 'PENDING').length
    });

    setRecentBookings(reservations.slice(0, 5).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, []);

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h2 className="text-4xl font-serif text-white mb-2">Dashboard</h2>
          <p className="text-slate-500">Overzicht van vandaag en acties.</p>
        </div>
        <div className="flex space-x-3">
           {!isSeeded() && <Button onClick={() => { seedDemoData(); window.location.reload(); }}>Load Demo Data</Button>}
           <Link to="/admin/reservations"><Button variant="secondary">Alle Boekingen</Button></Link>
           <Link to="/admin/reservations/new"><Button className="flex items-center"><Plus size={16} className="mr-2"/> Nieuwe Boeking</Button></Link>
        </div>
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Gasten Vandaag" 
          value={stats.todayGuests} 
          sub="/ 230 Capaciteit" 
          icon={Users} 
          color="emerald" 
        />
        <StatCard 
          label="Verwachte Omzet" 
          value={`€${stats.todayRevenue.toLocaleString()}`} 
          sub="Voor vanavond" 
          icon={TrendingUp} 
          color="amber" 
        />
        <StatCard 
          label="Open Verzoeken" 
          value={stats.pendingRequests} 
          sub="Vereist actie" 
          icon={AlertCircle} 
          color="blue" 
        />
        <StatCard 
          label="Wachtlijst" 
          value={stats.waitlistCount} 
          sub="Mogelijke vulling" 
          icon={Clock} 
          color="purple" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-8">
           {/* Quick Actions */}
           <div>
             <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center">
               <Activity size={14} className="mr-2"/> Snelle Acties
             </h3>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <QuickAction to="/admin/calendar" icon={Calendar} label="Plan Show" desc="Beheer agenda" />
               <QuickAction to="/admin/inbox" icon={AlertCircle} label="Inbox" desc={`${stats.pendingRequests} meldingen`} />
               <QuickAction to="/admin/host" icon={Users} label="Host View" desc="Deurlijst" />
               <QuickAction to="/admin/reports" icon={DollarSign} label="Rapporten" desc="Dag & Week" />
             </div>
           </div>

           {/* Capacity Monitor */}
           <CapacityMonitor />

           {/* Recent Activity / Bookings */}
           <Card className="bg-slate-900 border-slate-800 overflow-hidden">
             <div className="p-6 border-b border-slate-800 flex justify-between items-center">
               <h3 className="font-serif text-lg text-white">Nieuwste Boekingen</h3>
               <Link to="/admin/reservations" className="text-xs text-amber-500 hover:text-amber-400 font-bold uppercase tracking-wider flex items-center">
                 Alles Bekijken <ArrowRight size={12} className="ml-1"/>
               </Link>
             </div>
             <div className="divide-y divide-slate-800">
               {recentBookings.map((res: any) => (
                 <div key={res.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-xs">
                        {res.customer.firstName.charAt(0)}{res.customer.lastName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm">{res.customer.firstName} {res.customer.lastName}</p>
                        <p className="text-slate-500 text-xs">{new Date(res.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-mono text-sm">€{res.financials?.finalTotal?.toFixed(2)}</p>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${
                        res.status === 'CONFIRMED' ? 'border-emerald-900 text-emerald-500 bg-emerald-900/20' : 
                        res.status === 'REQUEST' ? 'border-blue-900 text-blue-500 bg-blue-900/20' :
                        'border-slate-800 text-slate-500'
                      }`}>{res.status}</span>
                    </div>
                 </div>
               ))}
               {recentBookings.length === 0 && <div className="p-8 text-center text-slate-500">Geen recente activiteit.</div>}
             </div>
           </Card>
        </div>

        {/* Side Column */}
        <div className="space-y-8">
           <TasksWidget />
           <PaymentWidget reservations={bookingRepo.getAll()} />
           
           <div className="p-6 bg-black/40 border border-slate-800 rounded-2xl">
             <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Demo Tools</h3>
             <DemoControlPanel />
           </div>
        </div>

      </div>
    </div>
  );
};

// --- Layout Wrappers ---

const CustomerLayout = () => {
  useIframeResizer(); // Activate resizer for all customer pages
  return (
    <div className="min-h-screen bg-black text-slate-100 font-sans selection:bg-red-900 selection:text-white">
      <Routes>
        <Route path="/" element={<Navigate to="/book" replace />} />
        <Route path="/book" element={<CustomerCalendar />} />
        <Route path="/book/wizard" element={<BookingWizard />} />
        <Route path="/book/confirmation" element={<ConfirmationScreen />} />
        <Route path="/portal" element={<CustomerPortal />} />
        <Route path="/vouchers" element={<VoucherShop />} />
        <Route path="/newsletter" element={<div className="p-4 max-w-md mx-auto mt-20"><NewsletterSignup /></div>} />
        <Route path="*" element={<Navigate to="/book" replace />} />
      </Routes>
    </div>
  );
};

const HostLayout = () => {
  return (
    <div className="min-h-screen bg-black text-slate-100 p-4">
      <HostView />
    </div>
  );
};

// --- Main App ---

const App: React.FC = () => {
  // Global Dev/View Switcher Logic
  const [view, setView] = useState<'customer' | 'admin' | 'host'>('customer');
  const [adminRole, setAdminRole] = useState<AdminRole>('ADMIN');

  return (
    <Router>
      <div className="min-h-screen bg-black">
        <ToastContainer /> 
        
        {/* Dev Switcher - Hidden in iframe ideally, or bottom fixed */}
        <div className="fixed bottom-4 left-4 z-[100] group print:hidden">
           <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-full p-1.5 flex space-x-1 shadow-2xl opacity-30 hover:opacity-100 transition-opacity">
             <button 
                onClick={() => { setView('customer'); window.location.hash = '#/book'; }} 
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${view === 'customer' && !window.location.hash.includes('vouchers') ? 'bg-red-700 text-white' : 'text-slate-400'}`}
             >
                Klant
             </button>
             <button 
                onClick={() => { setView('customer'); window.location.hash = '#/vouchers'; }} 
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${view === 'customer' && window.location.hash.includes('vouchers') ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
             >
                Vouchers
             </button>
             <button onClick={() => setView('admin')} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${view === 'admin' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}>Admin</button>
             <button onClick={() => setView('host')} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${view === 'host' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Host</button>
           </div>
        </div>

        {view === 'customer' && <CustomerLayout />}
        
        {view === 'host' && <HostLayout />}

        {view === 'admin' && (
          <AdminLayout currentRole={adminRole} onRoleChange={setAdminRole}>
            <Routes>
              <Route path="/" element={<Navigate to="/admin" replace />} />
              <Route path="/admin" element={<DashboardHome />} />
              <Route path="/admin/calendar" element={<CalendarManager />} />
              <Route path="/admin/planning" element={<PlanningManager />} />
              <Route path="/admin/reservations" element={<ReservationManager />} />
              <Route path="/admin/reservations/new" element={<AdminBookingWizard />} /> {/* NEW ROUTE */}
              <Route path="/admin/inbox" element={<ChangeRequestInbox />} />
              <Route path="/admin/tasks" element={<TaskManager />} /> 
              <Route path="/admin/shows" element={<ShowsManager />} />
              <Route path="/admin/waitlist" element={<WaitlistManager />} />
              <Route path="/admin/merchandise" element={<MerchandiseManager />} />
              <Route path="/admin/vouchers" element={<VoucherManager />} />
              <Route path="/admin/customers" element={<CustomerDatabase />} />
              <Route path="/admin/reports" element={<ReportsManager />} />
              <Route path="/admin/audit" element={<AuditLogViewer />} />
              <Route path="/admin/email" element={<EmailCenter />} />
              <Route path="/admin/newsletter" element={<NewsletterManager />} />
              <Route path="/admin/settings" element={<SettingsManager />} />
              <Route path="/admin/embed" element={<EmbedManager />} />
              <Route path="/admin/host" element={<HostView />} />
              <Route path="/admin/payments" element={<PaymentsManager />} />
              <Route path="/admin/promos" element={<PromoManager />} />
              <Route path="*" element={<DashboardHome />} />
            </Routes>
          </AdminLayout>
        )}
      </div>
    </Router>
  );
};

export default App;
