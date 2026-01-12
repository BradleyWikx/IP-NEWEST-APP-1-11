
import React from 'react';
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
  ShieldAlert, 
  UserCheck,
  Zap,
  Mail,
  Inbox,
  Code,
  Settings,
  LogOut,
  Printer,
  CheckSquare,
  DollarSign,
  Tag,
  UploadCloud,
  ChefHat,
  Trash2
} from 'lucide-react';
import { AdminRole } from '../../types';

interface NavItem {
  label: string;
  icon: any;
  path: string;
  roles: AdminRole[];
}

interface NavGroup {
  title?: string; // Optional for the first group
  items: NavItem[];
}

const MENU_STRUCTURE: NavGroup[] = [
  {
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/admin', roles: ['ADMIN', 'EDITOR', 'HOST'] },
      { label: 'Inbox', icon: Inbox, path: '/admin/inbox', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Taken', icon: CheckSquare, path: '/admin/tasks', roles: ['ADMIN', 'EDITOR'] },
    ]
  },
  {
    title: 'Planning & Boekingen',
    items: [
      { label: 'Agenda', icon: Calendar, path: '/admin/calendar', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Planning & Print', icon: Printer, path: '/admin/planning', roles: ['ADMIN', 'EDITOR', 'HOST'] },
      { label: 'Reserveringen', icon: Ticket, path: '/admin/reservations', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Wachtlijst', icon: Clock, path: '/admin/waitlist', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Host View', icon: UserCheck, path: '/admin/host', roles: ['ADMIN', 'EDITOR', 'HOST'] },
      { label: 'Keuken & Bar', icon: ChefHat, path: '/admin/kitchen', roles: ['ADMIN', 'EDITOR', 'HOST'] },
    ]
  },
  {
    title: 'Product & Financiën',
    items: [
      { label: 'Betalingen', icon: DollarSign, path: '/admin/payments', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Shows', icon: Zap, path: '/admin/shows', roles: ['ADMIN'] },
      { label: 'Promoties', icon: Tag, path: '/admin/promos', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Merchandise', icon: ShoppingBag, path: '/admin/merchandise', roles: ['ADMIN'] },
      { label: 'Vouchers', icon: Wallet, path: '/admin/vouchers', roles: ['ADMIN'] },
    ]
  },
  {
    title: 'Relatiebeheer',
    items: [
      { label: 'Klanten', icon: Users, path: '/admin/customers', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Email Center', icon: Mail, path: '/admin/email', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Nieuwsbrief', icon: Mail, path: '/admin/newsletter', roles: ['ADMIN', 'EDITOR'] },
    ]
  },
  {
    title: 'Systeem & Rapportage',
    items: [
      { label: 'Rapporten', icon: ClipboardList, path: '/admin/reports', roles: ['ADMIN'] },
      { label: 'Data Import', icon: UploadCloud, path: '/admin/import', roles: ['ADMIN'] },
      { label: 'Audit Log', icon: ShieldAlert, path: '/admin/audit', roles: ['ADMIN'] },
      { label: 'Embed Center', icon: Code, path: '/admin/embed', roles: ['ADMIN'] },
      { label: 'Instellingen', icon: Settings, path: '/admin/settings', roles: ['ADMIN'] },
      { label: 'Prullenbak', icon: Trash2, path: '/admin/trash', roles: ['ADMIN'] },
    ]
  }
];

export const AdminSidebar = ({ currentRole }: { currentRole: AdminRole }) => {
  const location = useLocation();

  return (
    <aside className="w-72 bg-black border-r border-slate-900 flex flex-col h-full shrink-0 transition-all duration-300">
      {/* Brand Header */}
      <div className="p-8 pb-4 border-b border-slate-900/50">
        <h1 className="text-3xl font-serif text-white tracking-tighter italic">Inspiration Point</h1>
        <p className="text-slate-500 text-sm mt-1 uppercase tracking-widest font-bold">Dinner Theater</p>
      </div>

      {/* Navigation */}
      <nav className="flex-grow px-4 py-6 space-y-8 overflow-y-auto custom-scrollbar">
        {MENU_STRUCTURE.map((group, groupIdx) => {
          // Filter items based on role
          const visibleItems = group.items.filter(item => item.roles.includes(currentRole));
          
          if (visibleItems.length === 0) return null;

          return (
            <div key={groupIdx}>
              {group.title && (
                <h3 className="px-4 mb-3 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                  {group.title}
                </h3>
              )}
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  // Active logic: Exact match OR sub-path match (but handle root /admin carefully)
                  const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
                  
                  return (
                    <Link 
                      key={item.path} 
                      to={item.path}
                      className={`
                        flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-200 group
                        ${isActive 
                          ? 'bg-slate-900 text-white border border-slate-800 shadow-lg' 
                          : 'text-slate-500 hover:bg-slate-900/50 hover:text-slate-300 border border-transparent'}
                      `}
                    >
                      <item.icon 
                        size={18} 
                        className={`transition-colors ${isActive ? 'text-amber-500' : 'text-slate-600 group-hover:text-slate-400'}`} 
                      />
                      <span className="font-medium text-sm tracking-wide">{item.label}</span>
                      
                      {isActive && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                      )}
                    </Link>
                  );
                })}
              </div>
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
          <LogOut size={16} className="text-slate-600 hover:text-white cursor-pointer transition-colors"/>
        </div>
      </div>
    </aside>
  );
};
