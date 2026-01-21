
import React, { useState, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './utils/queryClient';
import { AdminRole } from './types';
import { useIframeResizer } from './hooks/useIframeResizer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Loader2 } from 'lucide-react';

// --- Eager Loaded Modules (Customer Facing) ---
import { BookingWizard } from './components/BookingWizard';
import { CustomerCalendar } from './components/Calendar';
import { ConfirmationScreen } from './components/ConfirmationScreen';
import { CustomerPortal } from './components/CustomerPortal';
import { NewsletterSignup } from './components/NewsletterSignup';
import { VoucherShop } from './components/VoucherShop';
import { ToastContainer } from './components/UI/Toast';

// --- Lazy Loaded Modules (Admin) ---
// Splitting the admin bundle significantly reduces initial load time for customers
const AdminLayout = React.lazy(() => import('./components/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));
const DashboardHome = React.lazy(() => import('./components/admin/DashboardHome').then(m => ({ default: m.DashboardHome })));
const ReservationManager = React.lazy(() => import('./components/admin/ReservationManager').then(m => ({ default: m.ReservationManager })));
const CalendarManager = React.lazy(() => import('./components/admin/CalendarManager').then(m => ({ default: m.CalendarManager })));
const PlanningManager = React.lazy(() => import('./components/admin/PlanningManager').then(m => ({ default: m.PlanningManager })));
const ShowsManager = React.lazy(() => import('./components/admin/ShowsManager').then(m => ({ default: m.ShowsManager })));
const WaitlistManager = React.lazy(() => import('./components/admin/WaitlistManager').then(m => ({ default: m.WaitlistManager })));
const MerchandiseManager = React.lazy(() => import('./components/admin/MerchandiseManager').then(m => ({ default: m.MerchandiseManager })));
const VoucherManager = React.lazy(() => import('./components/admin/VoucherManager').then(m => ({ default: m.VoucherManager })));
const NewsletterManager = React.lazy(() => import('./components/admin/NewsletterManager').then(m => ({ default: m.NewsletterManager })));
const CustomerDatabase = React.lazy(() => import('./components/admin/CustomerDatabase').then(m => ({ default: m.CustomerDatabase })));
const ChangeRequestInbox = React.lazy(() => import('./components/admin/ChangeRequestInbox').then(m => ({ default: m.ChangeRequestInbox })));
const EmailCenter = React.lazy(() => import('./components/admin/EmailCenter').then(m => ({ default: m.EmailCenter })));
const EmbedManager = React.lazy(() => import('./components/admin/EmbedManager').then(m => ({ default: m.EmbedManager })));
const SettingsManager = React.lazy(() => import('./components/admin/SettingsManager').then(m => ({ default: m.SettingsManager })));
const ReportsManager = React.lazy(() => import('./components/admin/ReportsManager').then(m => ({ default: m.ReportsManager })));
const AuditLogViewer = React.lazy(() => import('./components/admin/AuditLogViewer').then(m => ({ default: m.AuditLogViewer })));
const HostView = React.lazy(() => import('./components/admin/HostView').then(m => ({ default: m.HostView })));
const TaskManager = React.lazy(() => import('./components/admin/TaskManager').then(m => ({ default: m.TaskManager })));
const PaymentsManager = React.lazy(() => import('./components/admin/PaymentsManager').then(m => ({ default: m.PaymentsManager })));
const PromoManager = React.lazy(() => import('./components/admin/PromoManager').then(m => ({ default: m.PromoManager })));
const AdminBookingWizard = React.lazy(() => import('./components/admin/AdminBookingWizard').then(m => ({ default: m.AdminBookingWizard })));
const DataImporter = React.lazy(() => import('./components/admin/DataImporter').then(m => ({ default: m.DataImporter })));
const KitchenDashboard = React.lazy(() => import('./components/admin/KitchenDashboard').then(m => ({ default: m.KitchenDashboard })));
const TrashManager = React.lazy(() => import('./components/admin/TrashManager').then(m => ({ default: m.TrashManager })));
const DemoControlPanel = React.lazy(() => import('./components/admin/DemoControlPanel').then(m => ({ default: m.DemoControlPanel })));
const InvoiceManager = React.lazy(() => import('./components/admin/InvoiceManager').then(m => ({ default: m.InvoiceManager })));
const StaffScheduler = React.lazy(() => import('./components/admin/StaffScheduler').then(m => ({ default: m.StaffScheduler })));

// Loading Fallback
const PageLoader = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <Loader2 className="animate-spin text-amber-500" size={48} />
  </div>
);

// --- Layout Wrappers ---

const CustomerLayout = () => {
  useIframeResizer(); 
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
      <Suspense fallback={<PageLoader />}>
        <HostView />
      </Suspense>
    </div>
  );
};

const MainContent = () => {
  const [adminRole, setAdminRole] = useState<AdminRole>('ADMIN');
  const location = useLocation();
  const navigate = useNavigate();

  const isHost = location.pathname.startsWith('/host');
  const isAdmin = location.pathname.startsWith('/admin');
  const isCustomer = !isHost && !isAdmin;

  return (
    <div className="min-h-screen bg-black">
      <ToastContainer /> 
      
      {/* Dev Switcher */}
      <div className="fixed bottom-4 left-4 z-[100] group print:hidden">
         <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-full p-1.5 flex space-x-1 shadow-2xl opacity-30 hover:opacity-100 transition-opacity">
           <button onClick={() => navigate('/book')} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${isCustomer && !location.pathname.includes('vouchers') ? 'bg-red-700 text-white' : 'text-slate-400'}`}>Klant</button>
           <button onClick={() => navigate('/vouchers')} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${isCustomer && location.pathname.includes('vouchers') ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>Vouchers</button>
           <button onClick={() => navigate('/admin')} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${isAdmin ? 'bg-amber-600 text-white' : 'text-slate-400'}`}>Admin</button>
           <button onClick={() => navigate('/host')} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${isHost ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Host</button>
         </div>
      </div>

      <Routes>
        <Route path="/host" element={<HostLayout />} />

        {/* Admin Section (Lazy) */}
        <Route path="/admin/*" element={
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <AdminLayout currentRole={adminRole} onRoleChange={setAdminRole}>
                <Routes>
                  <Route path="/" element={<DashboardHome />} />
                  <Route path="/calendar" element={<CalendarManager />} />
                  <Route path="/planning" element={<PlanningManager />} />
                  <Route path="/staff" element={<StaffScheduler />} /> 
                  <Route path="/reservations" element={<ReservationManager />} />
                  <Route path="/reservations/new" element={<AdminBookingWizard />} />
                  <Route path="/invoices" element={<InvoiceManager />} /> 
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
                  <Route path="/host" element={<HostView />} /> 
                  <Route path="/payments" element={<PaymentsManager />} />
                  <Route path="/promos" element={<PromoManager />} />
                  <Route path="/trash" element={<TrashManager />} /> 
                  <Route path="/demo" element={<DemoControlPanel />} /> 
                  <Route path="*" element={<DashboardHome />} />
                </Routes>
              </AdminLayout>
            </Suspense>
          </ErrorBoundary>
        } />

        <Route path="/*" element={<CustomerLayout />} />
      </Routes>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <MainContent />
      </Router>
    </QueryClientProvider>
  );
};

export default App;
