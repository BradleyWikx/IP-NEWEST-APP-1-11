
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  Ticket, 
  Clock, 
  ShoppingBag, 
  Wallet, 
  Users, 
  ClipboardList, 
  UserCheck,
  Zap,
  Mail,
  Inbox,
  Settings,
  LogOut,
  Printer,
  CheckSquare,
  DollarSign,
  Tag,
  UploadCloud,
  ChefHat,
  Trash2,
  Database,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { AdminRole } from '../../types';

interface NavItem {
  label: string;
  icon: any;
  path: string;
  roles: AdminRole[];
  specialClass?: string;
}

interface NavGroup {
  id?: string;
  title?: string; // If present, renders as collapsible group
  items: NavItem[];
}

const MENU_STRUCTURE: NavGroup[] = [
  {
    // CORE: Always visible
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/admin', roles: ['ADMIN', 'EDITOR', 'HOST'] },
      { label: 'Agenda', icon: Calendar, path: '/admin/calendar', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Reserveringen', icon: Ticket, path: '/admin/reservations', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Host Mode', icon: UserCheck, path: '/host', roles: ['ADMIN', 'EDITOR', 'HOST'], specialClass: 'text-amber-400 font-bold animate-pulse' },
    ]
  },
  {
    id: 'crm',
    title: 'Communicatie & CRM',
    items: [
      { label: 'Inbox', icon: Inbox, path: '/admin/inbox', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Taken', icon: CheckSquare, path: '/admin/tasks', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Wachtlijst', icon: Clock, path: '/admin/waitlist', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Klanten', icon: Users, path: '/admin/customers', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Email Center', icon: Mail, path: '/admin/email', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Nieuwsbrief', icon: Mail, path: '/admin/newsletter', roles: ['ADMIN', 'EDITOR'] },
    ]
  },
  {
    id: 'ops',
    title: 'Operatie & Keuken',
    items: [
      { label: 'Planning & Print', icon: Printer, path: '/admin/planning', roles: ['ADMIN', 'EDITOR', 'HOST'] },
      { label: 'Keuken & Bar', icon: ChefHat, path: '/admin/kitchen', roles: ['ADMIN', 'EDITOR', 'HOST'] },
    ]
  },
  {
    id: 'finance',
    title: 'Financiën & Product',
    items: [
      { label: 'Betalingen', icon: DollarSign, path: '/admin/payments', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Vouchers', icon: Wallet, path: '/admin/vouchers', roles: ['ADMIN'] },
      { label: 'Merchandise', icon: ShoppingBag, path: '/admin/merchandise', roles: ['ADMIN'] },
      { label: 'Promoties', icon: Tag, path: '/admin/promos', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Shows', icon: Zap, path: '/admin/shows', roles: ['ADMIN'] },
    ]
  },
  {
    id: 'system',
    title: 'Systeem & Beheer',
    items: [
      { label: 'Rapporten', icon: ClipboardList, path: '/admin/reports', roles: ['ADMIN'] },
      { label: 'Instellingen', icon: Settings, path: '/admin/settings', roles: ['ADMIN'] },
      { label: 'Data Import', icon: UploadCloud, path: '/admin/import', roles: ['ADMIN'] },
      { label: 'Prullenbak', icon: Trash2, path: '/admin/trash', roles: ['ADMIN'] },
      { label: 'Demo & Debug', icon: Database, path: '/admin/demo', roles: ['ADMIN'] },
    ]
  }
];

export const AdminSidebar = ({ currentRole }: { currentRole: AdminRole }) => {
  const location = useLocation();
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  // Auto-expand section if active link is inside it
  useEffect(() => {
    const activeGroup = MENU_STRUCTURE.find(g => 
        g.id && g.items.some(item => location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path)))
    );
    if (activeGroup && activeGroup.id) {
        setOpenSections(prev => {
            const next = new Set(prev);
            next.add(activeGroup.id!);
            return next;
        });
    }
  }, [location.pathname]);

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderItem = (item: NavItem, isChild = false) => {
    const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
    
    return (
      <Link 
        key={item.path} 
        to={item.path}
        className={`
          flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-200 group relative
          ${isChild ? 'ml-4 text-xs' : ''}
          ${isActive 
            ? 'bg-slate-900 text-white border border-slate-800 shadow-lg' 
            : 'text-slate-500 hover:bg-slate-900/50 hover:text-slate-300 border border-transparent'}
        `}
      >
        <item.icon 
          size={isChild ? 16 : 18} 
          className={`transition-colors ${item.specialClass ? item.specialClass : (isActive ? 'text-amber-500' : 'text-slate-600 group-hover:text-slate-400')}`} 
        />
        <span className={`font-medium tracking-wide ${item.specialClass ? item.specialClass : ''}`}>{item.label}</span>
        
        {isActive && (
          <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
        )}
      </Link>
    );
  };

  return (
    <aside className="w-72 bg-black border-r border-slate-900 flex flex-col h-full shrink-0 transition-all duration-300 select-none">
      {/* Brand Header with Logo */}
      <div className="p-6 border-b border-slate-900/50 flex flex-col items-center">
        <img 
          src="https://irp.cdn-website.com/e8046ea7/dms3rep/multi/logo-ip.png" 
          alt="Inspiration Point" 
          className="w-32 mb-4 opacity-90 hover:opacity-100 transition-opacity"
        />
        <p className="text-slate-600 text-[10px] uppercase tracking-[0.2em] font-bold">Admin Panel</p>
      </div>

      {/* Navigation */}
      <nav className="flex-grow px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
        {MENU_STRUCTURE.map((group, groupIdx) => {
          const visibleItems = group.items.filter(item => item.roles.includes(currentRole));
          if (visibleItems.length === 0) return null;

          // Render Core Items (No Title)
          if (!group.title) {
            return (
              <div key={groupIdx} className="space-y-1 mb-6">
                {visibleItems.map(item => renderItem(item))}
              </div>
            );
          }

          // Render Collapsible Group
          const isOpen = group.id ? openSections.has(group.id) : true;
          
          return (
            <div key={group.id || groupIdx} className="space-y-1">
              <button 
                onClick={() => group.id && toggleSection(group.id)}
                className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-black text-slate-600 uppercase tracking-widest hover:text-slate-400 transition-colors"
              >
                <span>{group.title}</span>
                {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              
              {isOpen && (
                <div className="space-y-1 animate-in slide-in-from-top-1 duration-200">
                  {visibleItems.map(item => renderItem(item, true))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Role Badge Footer */}
      <div className="p-6 border-t border-slate-900 bg-slate-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${
              currentRole === 'ADMIN' ? 'bg-red-900/20 text-red-500 border-red-900/50' : 
              'bg-blue-900/20 text-blue-500 border-blue-900/50'
            }`}>
              {currentRole.charAt(0)}
            </div>
            <div>
              <p className="text-xs font-bold text-white uppercase">{currentRole}</p>
              <p className="text-xs text-slate-500">Ingelogd</p>
            </div>
          </div>
          <Link to="/book" className="text-slate-600 hover:text-white cursor-pointer transition-colors" title="Naar Frontend">
             <LogOut size={16} />
          </Link>
        </div>
      </div>
    </aside>
  );
};
