
import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminRole } from './types';
import { useIframeResizer } from './hooks/useIframeResizer';

// --- Modules ---
import { BookingWizard } from './components/BookingWizard';
import { CustomerCalendar } from './components/Calendar';
import { ConfirmationScreen } from './components/ConfirmationScreen';
import { CustomerPortal } from './components/CustomerPortal';
import { NewsletterSignup } from './components/NewsletterSignup';
import { VoucherShop } from './components/VoucherShop';
// Admin
import { DashboardHome } from './components/admin/DashboardHome'; 
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
import { TaskManager } from './components/admin/TaskManager';
import { PaymentsManager } from './components/admin/PaymentsManager';
import { PromoManager } from './components/admin/PromoManager';
import { AdminBookingWizard } from './components/admin/AdminBookingWizard';
import { DataImporter } from './components/admin/DataImporter';
import { KitchenDashboard } from './components/admin/KitchenDashboard';
import { TrashManager } from './components/admin/TrashManager'; 
import { DemoControlPanel } from './components/admin/DemoControlPanel';

import { ToastContainer } from './components/UI/Toast';

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

const MainContent = () => {
  const [adminRole, setAdminRole] = useState<AdminRole>('ADMIN');
  const location = useLocation();
  const navigate = useNavigate();

  // Determine current view for active button state
  const isHost = location.pathname.startsWith('/host');
  const isAdmin = location.pathname.startsWith('/admin');
  const isCustomer = !isHost && !isAdmin;

  return (
    <div className="min-h-screen bg-black">
      <ToastContainer /> 
      
      {/* Dev Switcher - Hidden in iframe ideally, or bottom fixed */}
      <div className="fixed bottom-4 left-4 z-[100] group print:hidden">
         <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-full p-1.5 flex space-x-1 shadow-2xl opacity-30 hover:opacity-100 transition-opacity">
           <button 
              onClick={() => navigate('/book')} 
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${isCustomer && !location.pathname.includes('vouchers') ? 'bg-red-700 text-white' : 'text-slate-400'}`}
           >
              Klant
           </button>
           <button 
              onClick={() => navigate('/vouchers')} 
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${isCustomer && location.pathname.includes('vouchers') ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
           >
              Vouchers
           </button>
           <button onClick={() => navigate('/admin')} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${isAdmin ? 'bg-amber-600 text-white' : 'text-slate-400'}`}>Admin</button>
           <button onClick={() => navigate('/host')} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${isHost ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Host</button>
         </div>
      </div>

      <Routes>
        {/* Host View */}
        <Route path="/host" element={<HostLayout />} />

        {/* Admin Section */}
        <Route path="/admin/*" element={
          <AdminLayout currentRole={adminRole} onRoleChange={setAdminRole}>
            <Routes>
              <Route path="/" element={<DashboardHome />} />
              <Route path="/calendar" element={<CalendarManager />} />
              <Route path="/planning" element={<PlanningManager />} />
              <Route path="/reservations" element={<ReservationManager />} />
              <Route path="/reservations/new" element={<AdminBookingWizard />} />
              <Route path="/import" element={<DataImporter />} /> 
              <Route path="/kitchen" element={<KitchenDashboard />} /> 
              <Route path="/inbox" element={<ChangeRequestInbox />} />
              <Route path="/tasks" element={<TaskManager />} /> 
              <Route path="/shows" element={<ShowsManager />} />
              <Route path="/waitlist" element={<WaitlistManager />} />
              <Route path="/merchandise" element={<MerchandiseManager />} />
              <Route path="/vouchers" element={<VoucherManager />} />
              <Route path="/customers" element={<CustomerDatabase />} />
              <Route path="/reports" element={<ReportsManager />} />
              <Route path="/audit" element={<AuditLogViewer />} />
              <Route path="/email" element={<EmailCenter />} />
              <Route path="/newsletter" element={<NewsletterManager />} />
              <Route path="/settings" element={<SettingsManager />} />
              <Route path="/embed" element={<EmbedManager />} />
              <Route path="/host" element={<HostView />} /> {/* Also available inside admin if needed */}
              <Route path="/payments" element={<PaymentsManager />} />
              <Route path="/promos" element={<PromoManager />} />
              <Route path="/trash" element={<TrashManager />} /> 
              <Route path="/demo" element={<DemoControlPanel />} /> 
              <Route path="*" element={<DashboardHome />} />
            </Routes>
          </AdminLayout>
        } />

        {/* Customer Section (Catch-all) */}
        <Route path="/*" element={<CustomerLayout />} />
      </Routes>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <MainContent />
    </Router>
  );
};

export default App;
