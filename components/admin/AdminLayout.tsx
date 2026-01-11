
import React, { useState, useEffect } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';
import { AdminRole } from '../../types';
import { Menu, X } from 'lucide-react';
import { notificationsRepo, tasksRepo } from '../../utils/storage';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentRole: AdminRole;
  onRoleChange: (role: AdminRole) => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, currentRole, onRoleChange }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    // Check for computed notifications (Overdue, Options Expiring) on admin load
    notificationsRepo.runComputedChecks();
    // Check for automated tasks
    tasksRepo.runComputedChecks();
  }, []);

  return (
    <div className="flex h-screen bg-black text-slate-100 overflow-hidden font-sans print:h-auto print:overflow-visible relative">
      
      {/* Mobile Overlay Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Fixed on Desktop, Slide-over on Mobile */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-slate-950 border-r border-slate-900 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:h-full lg:flex lg:shrink-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        print:hidden
      `}>
        <div className="relative h-full flex flex-col">
          {/* Close Button Mobile */}
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="absolute top-4 right-4 p-2 text-slate-500 lg:hidden"
          >
            <X size={24} />
          </button>
          
          <AdminSidebar currentRole={currentRole} />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col flex-grow h-full w-full overflow-hidden print:overflow-visible print:h-auto">
        
        {/* Topbar with Mobile Menu Trigger */}
        <div className="print:hidden flex-shrink-0">
          <div className="lg:hidden h-16 border-b border-slate-900 flex items-center px-4 bg-slate-950">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 mr-4 text-slate-400">
              <Menu size={24} />
            </button>
            <span className="font-serif text-xl text-white">Inspiration Point</span>
          </div>
          <div className="hidden lg:block">
            <AdminTopbar currentRole={currentRole} onRoleChange={onRoleChange} />
          </div>
        </div>
        
        {/* Scrollable Page Content */}
        <main className="flex-grow overflow-y-auto bg-black p-4 lg:p-8 print:p-0 print:bg-white print:text-black print:overflow-visible custom-scrollbar">
          <div className="max-w-7xl mx-auto animate-in fade-in duration-500 print:max-w-none print:mx-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
