
import React, { useState, useEffect, useRef } from 'react';
import { Bell, Shield, ChevronDown } from 'lucide-react';
import { AdminRole } from '../../types';
import { GlobalSearch } from './GlobalSearch';
import { NotificationCenter } from './NotificationCenter';
import { notificationsRepo } from '../../utils/storage';

interface AdminTopbarProps {
  currentRole: AdminRole;
  onRoleChange: (role: AdminRole) => void;
}

export const AdminTopbar: React.FC<AdminTopbarProps> = ({ currentRole, onRoleChange }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkUnread = () => setUnreadCount(notificationsRepo.getUnreadCount());
    checkUnread();
    
    // Listen for storage updates
    window.addEventListener('storage-update', checkUnread);
    const interval = setInterval(checkUnread, 5000);
    
    return () => {
      window.removeEventListener('storage-update', checkUnread);
      clearInterval(interval);
    };
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-20 bg-black/50 backdrop-blur-md border-b border-slate-900 flex items-center justify-between px-8 sticky top-0 z-40">
      {/* Search Bar (Global Command Palette) */}
      <div className="relative w-96 group bg-slate-900/50 border border-slate-800 rounded-full pl-4 pr-4 py-2 transition-all hover:border-amber-500/30 focus-within:ring-2 focus-within:ring-amber-500/20">
        <GlobalSearch />
      </div>

      {/* Right Actions */}
      <div className="flex items-center space-x-6">
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className={`relative p-2 rounded-full transition-colors ${showNotifications ? 'text-white bg-slate-800' : 'text-slate-500 hover:text-white'}`}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-red-600 rounded-full shadow-[0_0_8px_rgba(220,38,38,0.5)] text-[9px] font-bold flex items-center justify-center text-white border border-black">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          
          {showNotifications && <NotificationCenter onClose={() => setShowNotifications(false)} />}
        </div>

        <div className="h-6 w-px bg-slate-800" />

        {/* Role Switcher (Mock Login) */}
        <div className="relative group">
           <button className="flex items-center space-x-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors">
             <Shield size={14} />
             <span>Rol: {currentRole}</span>
             <ChevronDown size={14} />
           </button>
           
           <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1 opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all transform origin-top-right">
             {(['ADMIN', 'EDITOR', 'HOST'] as AdminRole[]).map(role => (
               <button
                 key={role}
                 onClick={() => onRoleChange(role)}
                 className={`w-full text-left px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors ${currentRole === role ? 'text-amber-500 bg-slate-800/50' : 'text-slate-400'}`}
               >
                 {role}
               </button>
             ))}
           </div>
        </div>
      </div>
    </header>
  );
};
