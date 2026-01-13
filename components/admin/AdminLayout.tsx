
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';
import { AdminRole } from '../../types';
import { Menu, X, Minimize2, Maximize2, XCircle } from 'lucide-react';
import { notificationsRepo, tasksRepo } from '../../utils/storage';
import { runAutomations } from '../../utils/automation';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentRole: AdminRole;
  onRoleChange: (role: AdminRole) => void;
}

interface TaskTab {
  id: string;
  title: string;
  link: string;
  iconType?: string;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, currentRole, onRoleChange }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [tabs, setTabs] = useState<TaskTab[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Initial checks
    notificationsRepo.runComputedChecks();
    tasksRepo.runComputedChecks();
    
    // Run Automations
    runAutomations();

    // Listen for tab open events
    const handleOpenTab = (e: any) => {
        const { id, title, link, iconType } = e.detail;
        addTab({ id, title, link, iconType });
    };

    window.addEventListener('grand-stage-open-tab', handleOpenTab);
    return () => window.removeEventListener('grand-stage-open-tab', handleOpenTab);
  }, []);

  const addTab = (tab: TaskTab) => {
    setTabs(prev => {
        // If tab exists, don't duplicate
        if (prev.find(t => t.id === tab.id)) return prev;
        return [...prev, tab];
    });
  };

  const removeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTabs(prev => prev.filter(t => t.id !== id));
  };

  const activateTab = (tab: TaskTab) => {
    navigate(tab.link);
  };

  return (
    <div className="flex h-screen bg-black text-slate-100 overflow-hidden font-sans print:h-auto print:overflow-visible relative">
      
      {/* Mobile Overlay Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-slate-950 border-r border-slate-900 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:h-full lg:flex lg:shrink-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        print:hidden
      `}>
        <div className="relative h-full flex flex-col">
          <button onClick={() => setIsSidebarOpen(false)} className="absolute top-4 right-4 p-2 text-slate-500 lg:hidden">
            <X size={24} />
          </button>
          <AdminSidebar currentRole={currentRole} />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col flex-grow h-full w-full overflow-hidden print:overflow-visible print:h-auto relative">
        
        {/* Topbar */}
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
        <main className="flex-grow overflow-y-auto bg-black p-4 lg:p-8 print:p-0 print:bg-white print:text-black print:overflow-visible custom-scrollbar pb-20">
          <div className="max-w-7xl mx-auto animate-in fade-in duration-500 print:max-w-none print:mx-0">
            {children}
          </div>
        </main>

        {/* TaskBar (Multi-Tab Interface) */}
        {tabs.length > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-full p-1 shadow-2xl flex items-center space-x-2 max-w-[90%] overflow-x-auto no-scrollbar animate-in slide-in-from-bottom-6">
                {tabs.map(tab => (
                    <div 
                        key={tab.id}
                        onClick={() => activateTab(tab)}
                        className="flex items-center space-x-2 px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer transition-colors group min-w-[120px] max-w-[200px]"
                    >
                        <span className="text-xs font-bold text-white truncate">{tab.title}</span>
                        <button 
                            onClick={(e) => removeTab(tab.id, e)}
                            className="text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <XCircle size={14} />
                        </button>
                    </div>
                ))}
                <div className="w-px h-6 bg-slate-700 mx-2" />
                <button onClick={() => setTabs([])} className="px-3 py-2 text-xs text-slate-500 hover:text-white uppercase font-bold">
                    Alles Sluiten
                </button>
            </div>
        )}

      </div>
    </div>
  );
};
