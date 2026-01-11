
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, Check, Trash2, Ticket, Clock, AlertTriangle, 
  CreditCard, MessageSquare, ShoppingBag, X, CheckCircle2 
} from 'lucide-react';
import { notificationsRepo } from '../../utils/storage';
import { AdminNotification, NotificationSeverity } from '../../types';
import { Button } from '../UI';

interface NotificationCenterProps {
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ onClose }) => {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Polling for updates
    return () => clearInterval(interval);
  }, []);

  const loadData = () => {
    setNotifications(notificationsRepo.getAll());
  };

  const handleMarkRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    notificationsRepo.markRead(id);
    loadData();
  };

  const handleMarkAllRead = () => {
    notificationsRepo.markAllRead();
    loadData();
  };

  const handleClick = (n: AdminNotification) => {
    if (!n.readAt) notificationsRepo.markRead(n.id);
    onClose();
    // Deep link navigation
    const target = n.link.includes('?') 
      ? `${n.link}&open=${n.entityId}`
      : `${n.link}?open=${n.entityId}`;
    navigate(target);
  };

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, AdminNotification[]> = {};
    notifications.forEach(n => {
      const date = new Date(n.createdAt);
      const today = new Date();
      let key = date.toLocaleDateString();
      
      if (date.toDateString() === today.toDateString()) key = 'Vandaag';
      else if (date.getDate() === today.getDate() - 1 && date.getMonth() === today.getMonth()) key = 'Gisteren';
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    });
    return groups;
  }, [notifications]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'NEW_BOOKING': return <Ticket size={16} className="text-blue-500" />;
      case 'NEW_CHANGE_REQUEST': return <MessageSquare size={16} className="text-amber-500" />;
      case 'NEW_WAITLIST': return <Clock size={16} className="text-purple-500" />;
      case 'NEW_VOUCHER_ORDER': return <ShoppingBag size={16} className="text-emerald-500" />;
      case 'OPTION_EXPIRING': return <AlertTriangle size={16} className="text-orange-500" />;
      case 'PAYMENT_OVERDUE': return <CreditCard size={16} className="text-red-500" />;
      default: return <Bell size={16} className="text-slate-500" />;
    }
  };

  const getSeverityClass = (s: NotificationSeverity) => {
    if (s === 'URGENT') return 'bg-red-900/10 border-red-900/30';
    if (s === 'WARNING') return 'bg-amber-900/10 border-amber-900/30';
    return 'bg-slate-900 border-slate-800'; // Info
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-96 max-h-[80vh] bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-top-2 origin-top-right">
      <div className="p-4 border-b border-slate-900 flex justify-between items-center bg-slate-900/50">
        <h3 className="font-bold text-white text-sm">Notificaties</h3>
        <div className="flex space-x-2">
          <button 
            onClick={handleMarkAllRead} 
            className="text-[10px] text-slate-400 hover:text-white uppercase font-bold tracking-wider flex items-center"
          >
            <CheckCircle2 size={12} className="mr-1"/> Alles Lezen
          </button>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto custom-scrollbar p-2">
        {Object.keys(grouped).length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <Bell size={24} className="mx-auto mb-2 opacity-50"/>
            Geen notificaties.
          </div>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date} className="mb-4 last:mb-0">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest sticky top-0 bg-slate-950/90 backdrop-blur-sm z-10">
                {date}
              </div>
              <div className="space-y-1 mt-1">
                {items.map(n => (
                  <div 
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`
                      relative p-3 rounded-xl border cursor-pointer group transition-all
                      ${getSeverityClass(n.severity)}
                      ${n.readAt ? 'opacity-60 grayscale hover:grayscale-0 hover:opacity-100' : 'hover:bg-slate-800'}
                    `}
                  >
                    {!n.readAt && (
                      <div className="absolute top-3 right-3 w-2 h-2 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                    )}
                    
                    <div className="flex items-start space-x-3">
                      <div className="mt-0.5 p-1.5 bg-black/40 rounded-lg border border-white/5">
                        {getIcon(n.type)}
                      </div>
                      <div className="flex-grow min-w-0 pr-4">
                        <h4 className={`text-xs font-bold truncate ${n.readAt ? 'text-slate-400' : 'text-white'}`}>
                          {n.title}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                          {n.message}
                        </p>
                        <p className="text-[9px] text-slate-600 mt-2 font-mono">
                          {new Date(n.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                    </div>

                    {!n.readAt && (
                      <button 
                        onClick={(e) => handleMarkRead(n.id, e)}
                        className="absolute bottom-3 right-3 p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Markeer als gelezen"
                      >
                        <Check size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
