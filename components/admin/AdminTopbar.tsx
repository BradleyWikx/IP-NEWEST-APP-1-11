
import React, { useState, useEffect, useRef } from 'react';
import { Bell, Shield, ChevronDown, RotateCcw, Clock, Sun, Moon } from 'lucide-react';
import { AdminRole } from '../../types';
import { GlobalSearch } from './GlobalSearch';
import { NotificationCenter } from './NotificationCenter';
import { notificationsRepo } from '../../utils/storage';
import { undoManager } from '../../utils/undoManager';

interface AdminTopbarProps {
  currentRole: AdminRole;
  onRoleChange: (role: AdminRole) => void;
}

export const AdminTopbar: React.FC<AdminTopbarProps> = ({ currentRole, onRoleChange }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [undoHistory, setUndoHistory] = useState<any[]>([]);
  const [isLightMode, setIsLightMode] = useState(false);
  
  const notifRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const updateHistory = () => setUndoHistory(undoManager.getHistory());
    window.addEventListener('undo-update', updateHistory);
    return () => window.removeEventListener('undo-update', updateHistory);
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTheme = () => {
    setIsLightMode(!isLightMode);
    document.body.classList.toggle('light-mode');
  };

  return (
    <header className="h-20 bg-black/50 backdrop-blur-md border-b border-slate-900 flex items-center justify-between px-8 sticky top-0 z-40">
      {/* Search Bar (Global Command Palette) */}
      <div className="relative w-96 group bg-slate-900/50 border border-slate-800 rounded-full pl-4 pr-4 py-2 transition-all hover:border-amber-500/30 focus-within:ring-2 focus-within:ring-amber-500/20">
        <GlobalSearch />
      </div>

      {/* Right Actions */}
      <div className="flex items-center space-x-6">
        
        {/* Theme Toggle */}
        <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-slate-500 hover:text-white transition-colors"
            title={isLightMode ? "Donkere modus" : "Lichte modus (Zonlicht)"}
        >
            {isLightMode ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        {/* Undo History */}
        <div className="relative" ref={historyRef}>
           <button
             onClick={() => setShowHistory(!showHistory)}
             className={`relative p-2 rounded-full transition-colors ${showHistory ? 'text-amber-500 bg-slate-800' : 'text-slate-500 hover:text-white'}`}
             title="Actie Historie"
           >
             <RotateCcw size={20} />
             {undoHistory.length > 0 && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-amber-500 rounded-full shadow-lg border border-black" />
             )}
           </button>

           {showHistory && (
             <div className="absolute right-0 top-full mt-2 w-72 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 origin-top-right">
                <div className="p-3 border-b border-slate-900 bg-slate-900/50">
                   <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recente Acties</h4>
                </div>
                <div className="max-h-60 overflow-y-auto">
                   {undoHistory.length === 0 ? (
                     <div className="p-4 text-center text-slate-600 text-xs italic">Geen acties om te herstellen.</div>
                   ) : (
                     undoHistory.map((record) => (
                       <button
                         key={record.id}
                         onClick={() => { undoManager.performUndo(record.id); setShowHistory(false); }}
                         className="w-full text-left p-3 hover:bg-slate-900 border-b border-slate-900 last:border-0 transition-colors group"
                       >
                          <div className="flex items-center justify-between mb-1">
                             <span className="text-xs font-bold text-white group-hover:text-amber-500">{record.actionType}</span>
                             <span className="text-[10px] text-slate-600 flex items-center">
                                <Clock size={10} className="mr-1"/> 
                                {Math.round((record.expiresAt - Date.now()) / 1000)}s
                             </span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                             {record.entityType} {record.entityId}
                          </div>
                       </button>
                     ))
                   )}
                </div>
             </div>
           )}
        </div>

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
