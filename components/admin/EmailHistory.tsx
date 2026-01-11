
import React, { useState, useEffect } from 'react';
import { Mail, RefreshCw, Eye, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { EmailLog } from '../../types';
import { getEmailsForEntity, simulateSendEmail } from '../../utils/emailEngine';
import { Button, Badge } from '../UI';

interface EmailHistoryProps {
  entityId: string;
}

export const EmailHistory: React.FC<EmailHistoryProps> = ({ entityId }) => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewLog, setPreviewLog] = useState<EmailLog | null>(null);

  const loadLogs = () => {
    setLogs(getEmailsForEntity(entityId));
  };

  useEffect(() => {
    loadLogs();
    // Poll for changes (e.g. status updates)
    const interval = setInterval(loadLogs, 3000);
    return () => clearInterval(interval);
  }, [entityId]);

  const handleResend = async (logId: string) => {
    if (!confirm('E-mail opnieuw versturen?')) return;
    setLoading(true);
    await simulateSendEmail(logId); // In reality this might create a new log
    loadLogs();
    setLoading(false);
  };

  if (logs.length === 0) {
    return (
      <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl text-center text-slate-500 text-sm">
        <Mail size={24} className="mx-auto mb-2 opacity-50" />
        Geen e-mail historie gevonden.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {logs.map(log => (
        <div key={log.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-3 flex items-center justify-between border-b border-slate-800/50">
            <div className="flex items-center space-x-2">
              {log.status === 'SENT' ? <CheckCircle2 size={16} className="text-emerald-500"/> : 
               log.status === 'FAILED' ? <AlertCircle size={16} className="text-red-500"/> : 
               <Clock size={16} className="text-amber-500"/>}
              <span className="text-xs font-bold text-white">{new Date(log.createdAt).toLocaleString()}</span>
            </div>
            <Badge status={log.status === 'SENT' ? 'CONFIRMED' : log.status === 'QUEUED' ? 'OPTION' : 'CANCELLED'} className="scale-75 origin-right">
              {log.status}
            </Badge>
          </div>
          <div className="p-3 space-y-2">
            <p className="text-xs font-bold text-slate-300 truncate">{log.subject}</p>
            <p className="text-[10px] text-slate-500 font-mono">{log.templateKey}</p>
            
            <div className="flex justify-end space-x-2 pt-2">
              <Button variant="ghost" onClick={() => setPreviewLog(previewLog?.id === log.id ? null : log)} className="h-6 text-[10px] px-2">
                <Eye size={12} className="mr-1"/> Inhoud
              </Button>
              <Button variant="secondary" onClick={() => handleResend(log.id)} disabled={loading} className="h-6 text-[10px] px-2">
                <RefreshCw size={12} className="mr-1"/> {loading ? '...' : 'Opnieuw'}
              </Button>
            </div>
          </div>
          
          {previewLog?.id === log.id && (
            <div className="p-3 bg-white border-t border-slate-800 animate-in slide-in-from-top-1">
              <iframe 
                title="preview"
                srcDoc={log.bodyHtml}
                className="w-full h-40 border-none"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
