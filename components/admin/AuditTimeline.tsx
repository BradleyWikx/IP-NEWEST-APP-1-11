
import React, { useState, useEffect } from 'react';
import { 
  Clock, Plus, Edit3, Trash2, CheckCircle2, 
  AlertCircle, DollarSign, Mail, MessageSquare,
  ArrowRight
} from 'lucide-react';
import { getAuditLogs, AuditLogEntry } from '../../utils/auditLogger';
import { formatCurrency } from '../../utils/formatters';

interface AuditTimelineProps {
  entityId: string;
}

// Helper to compare two objects and generate a list of changes
const generateDiff = (before: any, after: any): string[] => {
  if (!before || !after) return [];
  const changes: string[] = [];

  // Core Fields
  if (before.date !== after.date) {
    changes.push(`Datum: ${new Date(before.date).toLocaleDateString()} ➝ ${new Date(after.date).toLocaleDateString()}`);
  }
  if (before.status !== after.status) {
    changes.push(`Status: ${before.status} ➝ ${after.status}`);
  }
  if (before.partySize !== after.partySize) {
    changes.push(`Personen: ${before.partySize} ➝ ${after.partySize}`);
  }
  if (before.packageType !== after.packageType) {
    changes.push(`Arrangement: ${before.packageType} ➝ ${after.packageType}`);
  }
  if (before.startTime !== after.startTime) {
    changes.push(`Tijd: ${before.startTime} ➝ ${after.startTime}`);
  }

  // Financials
  if (before.financials?.finalTotal !== after.financials?.finalTotal) {
    changes.push(`Totaalbedrag: ${formatCurrency(before.financials?.finalTotal || 0)} ➝ ${formatCurrency(after.financials?.finalTotal || 0)}`);
  }
  if (before.financials?.paid !== after.financials?.paid) {
    changes.push(`Betaald: ${formatCurrency(before.financials?.paid || 0)} ➝ ${formatCurrency(after.financials?.paid || 0)}`);
  }

  // Customer
  if (before.customer?.firstName !== after.customer?.firstName || before.customer?.lastName !== after.customer?.lastName) {
    changes.push(`Naam gewijzigd: ${before.customer?.lastName} ➝ ${after.customer?.lastName}`);
  }
  if (before.customer?.email !== after.customer?.email) {
    changes.push(`Email gewijzigd`);
  }

  // Notes & Extras
  if (JSON.stringify(before.addons) !== JSON.stringify(after.addons)) {
    changes.push(`Extra opties aangepast`);
  }
  if (JSON.stringify(before.merchandise) !== JSON.stringify(after.merchandise)) {
    changes.push(`Merchandise aangepast`);
  }
  if (before.notes?.dietary !== after.notes?.dietary) {
    changes.push(`Dieetwensen aangepast`);
  }
  if (before.notes?.comments !== after.notes?.comments) {
    changes.push(`Opmerkingen aangepast`);
  }

  return changes;
};

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
    if (action.includes('UPDATE') || action.includes('EDIT')) return <Edit3 size={14} className="text-blue-500" />;
    if (action.includes('DELETE') || action.includes('TRASH')) return <Trash2 size={14} className="text-red-500" />;
    if (action.includes('PAYMENT')) return <DollarSign size={14} className="text-emerald-500" />;
    if (action.includes('EMAIL')) return <Mail size={14} className="text-purple-500" />;
    if (action.includes('STATUS')) return <CheckCircle2 size={14} className="text-amber-500" />;
    return <Clock size={14} className="text-slate-500" />;
  };

  const getBgColor = (action: string) => {
    if (action.includes('CREATE')) return 'bg-emerald-900/10 border-emerald-900/30';
    if (action.includes('DELETE')) return 'bg-red-900/10 border-red-900/30';
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
      {logs.map((log) => {
        const diffs = log.changes ? generateDiff(log.changes.before, log.changes.after) : [];
        
        return (
          <div key={log.id} className="relative animate-in slide-in-from-left-2 duration-300">
            {/* Dot */}
            <div className="absolute -left-[19px] top-3 w-2.5 h-2.5 rounded-full bg-slate-800 border-2 border-slate-600 z-10" />
            
            <div className={`p-3 rounded-xl border ${getBgColor(log.action)}`}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center space-x-2">
                  <div className="p-1 rounded bg-black/40 border border-white/5">
                    {getIcon(log.action)}
                  </div>
                  <span className="text-xs font-bold text-white uppercase tracking-wide">
                    {log.action.replace(/_/g, ' ')}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  {new Date(log.timestamp).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              
              {/* Description */}
              {log.changes?.description && (
                <p className="text-xs text-slate-400 mb-2">
                  {log.changes.description}
                </p>
              )}

              {/* Detailed Diffs */}
              {diffs.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
                  {diffs.map((diff, i) => (
                    <div key={i} className="flex items-center text-[11px] text-slate-300 font-mono">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50 mr-2 shrink-0" />
                      {diff}
                    </div>
                  ))}
                </div>
              )}

              {/* User Info */}
              <div className="flex items-center space-x-2 pt-2 mt-1">
                <div className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-400">
                  {log.user.name.charAt(0)}
                </div>
                <span className="text-[9px] text-slate-600">{log.user.name}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
