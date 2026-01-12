
import React, { useState, useEffect } from 'react';
import { 
  Clock, Plus, Edit3, Trash2, CheckCircle2, 
  AlertCircle, DollarSign, Mail, MessageSquare 
} from 'lucide-react';
import { getAuditLogs, AuditLogEntry } from '../../utils/auditLogger';

interface AuditTimelineProps {
  entityId: string;
}

export const AuditTimeline: React.FC<AuditTimelineProps> = ({ entityId }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    const all = getAuditLogs();
    const filtered = all
      .filter(l => l.entityId === entityId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setLogs(filtered);
  }, [entityId]);

  const getIcon = (action: string) => {
    if (action.includes('CREATE')) return <Plus size={14} className="text-emerald-500" />;
    if (action.includes('UPDATE')) return <Edit3 size={14} className="text-blue-500" />;
    if (action.includes('DELETE') || action.includes('TRASH')) return <Trash2 size={14} className="text-red-500" />;
    if (action.includes('PAYMENT')) return <DollarSign size={14} className="text-emerald-500" />;
    if (action.includes('EMAIL')) return <Mail size={14} className="text-purple-500" />;
    if (action.includes('STATUS')) return <CheckCircle2 size={14} className="text-amber-500" />;
    return <Clock size={14} className="text-slate-500" />;
  };

  const getBgColor = (action: string) => {
    if (action.includes('CREATE')) return 'bg-emerald-900/20 border-emerald-900/50';
    if (action.includes('DELETE')) return 'bg-red-900/20 border-red-900/50';
    return 'bg-slate-900 border-slate-800';
  };

  if (logs.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm italic">
        Geen geschiedenis gevonden.
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-slate-800">
      {logs.map((log) => (
        <div key={log.id} className="relative animate-in slide-in-from-left-2 duration-300">
          {/* Dot */}
          <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-slate-800 border-2 border-slate-600 z-10" />
          
          <div className={`p-3 rounded-xl border ${getBgColor(log.action)}`}>
            <div className="flex justify-between items-start mb-1">
              <div className="flex items-center space-x-2">
                <div className="p-1 rounded bg-black/40 border border-white/5">
                  {getIcon(log.action)}
                </div>
                <span className="text-xs font-bold text-white uppercase tracking-wide">
                  {log.action.replace('_', ' ')}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {new Date(log.timestamp).toLocaleString()}
              </span>
            </div>
            
            <p className="text-xs text-slate-300 mb-2">
              {log.changes?.description || 'Geen details'}
            </p>

            <div className="flex items-center space-x-2 pt-2 border-t border-white/5">
              <div className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-400">
                {log.user.name.charAt(0)}
              </div>
              <span className="text-[10px] text-slate-500">{log.user.name} ({log.user.role})</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
