
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, Search, Filter, Clock, User, 
  FileJson, ChevronRight, Download, Activity, Calendar, X,
  ArrowRight, CheckCircle2, AlertCircle
} from 'lucide-react';
import { Button, Card, Badge } from '../UI';
import { getAuditLogs, AuditLogEntry } from '../../utils/auditLogger';
import { formatCurrency } from '../../utils/formatters';

// Helper to generate a friendly diff array
const generateChangeList = (before: any, after: any) => {
  if (!before || !after) return [];
  const changes: { field: string; from: string; to: string }[] = [];

  // 1. Status
  if (before.status !== after.status) {
    changes.push({ field: 'Status', from: before.status, to: after.status });
  }
  // 2. Date
  if (before.date !== after.date) {
    changes.push({ field: 'Datum', from: new Date(before.date).toLocaleDateString(), to: new Date(after.date).toLocaleDateString() });
  }
  // 3. Time
  if (before.startTime !== after.startTime) {
    changes.push({ field: 'Tijd', from: before.startTime || '?', to: after.startTime || '?' });
  }
  // 4. Guests
  if (before.partySize !== after.partySize) {
    changes.push({ field: 'Personen', from: String(before.partySize), to: String(after.partySize) });
  }
  // 5. Total
  if (before.financials?.finalTotal !== after.financials?.finalTotal) {
    changes.push({ 
        field: 'Totaalbedrag', 
        from: formatCurrency(before.financials?.finalTotal || 0), 
        to: formatCurrency(after.financials?.finalTotal || 0) 
    });
  }
  // 6. Paid
  if (before.financials?.paid !== after.financials?.paid) {
    changes.push({ 
        field: 'Betaald', 
        from: formatCurrency(before.financials?.paid || 0), 
        to: formatCurrency(after.financials?.paid || 0) 
    });
  }
  // 7. Table
  if (before.tableId !== after.tableId) {
    changes.push({ field: 'Tafel', from: before.tableId || '-', to: after.tableId || '-' });
  }
  // 8. Package
  if (before.packageType !== after.packageType) {
    changes.push({ field: 'Arrangement', from: before.packageType, to: after.packageType });
  }

  return changes;
};

export const AuditLogViewer = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEntityType, setFilterEntityType] = useState<string>('ALL');
  const [filterUser, setFilterUser] = useState<string>('ALL');
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    const data = getAuditLogs();
    // Sort desc by timestamp
    const sorted = data.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setLogs(sorted);
    setFilteredLogs(sorted);
  }, []);

  // Compute unique options for dropdowns based on actual data
  const uniqueUsers = useMemo(() => {
    const users = new Set(logs.map(l => l.user.name));
    return Array.from(users).sort();
  }, [logs]);

  const uniqueActions = useMemo(() => {
    const actions = new Set(logs.map(l => l.action));
    return Array.from(actions).sort();
  }, [logs]);

  // Apply Filters
  useEffect(() => {
    let result = logs;

    // 1. Text Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(log => 
        log.entityId.toLowerCase().includes(term) ||
        (log.changes?.description || '').toLowerCase().includes(term)
      );
    }

    // 2. Entity Type
    if (filterEntityType !== 'ALL') {
      result = result.filter(log => log.entityType === filterEntityType);
    }

    // 3. User
    if (filterUser !== 'ALL') {
      result = result.filter(log => log.user.name === filterUser);
    }

    // 4. Action
    if (filterAction !== 'ALL') {
      result = result.filter(log => log.action === filterAction);
    }

    // 5. Date Range
    if (dateRange.start) {
      result = result.filter(log => log.timestamp >= dateRange.start);
    }
    if (dateRange.end) {
      // Add time to end date to include the full day
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      result = result.filter(log => new Date(log.timestamp) <= endDate);
    }

    setFilteredLogs(result);
  }, [searchTerm, filterEntityType, filterUser, filterAction, dateRange, logs]);

  const resetFilters = () => {
    setSearchTerm('');
    setFilterEntityType('ALL');
    setFilterUser('ALL');
    setFilterAction('ALL');
    setDateRange({ start: '', end: '' });
  };

  const exportCSV = () => {
    const headers = ['Timestamp', 'User', 'Role', 'Action', 'Entity Type', 'Entity ID', 'Description'];
    const rows = filteredLogs.map(log => [
      log.timestamp,
      log.user.name,
      log.user.role,
      log.action,
      log.entityType,
      log.entityId,
      log.changes?.description || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit_log_${new Date().toISOString()}.csv`;
    link.click();
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-serif text-white">Audit Log</h2>
          <p className="text-slate-500 text-sm">Systeemactiviteit en wijzigingshistorie.</p>
        </div>
        <Button variant="secondary" onClick={exportCSV} className="flex items-center">
          <Download size={18} className="mr-2" /> Export CSV
        </Button>
      </div>

      {/* Advanced Filters */}
      <Card className="p-4 bg-slate-900/50 space-y-4">
        {/* Top Row: Search & Reset */}
        <div className="flex gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="Zoek op ID of omschrijving..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="ghost" onClick={resetFilters} className="text-slate-400 hover:text-white border-slate-800">
            <X size={16} className="mr-2" /> Reset Filters
          </Button>
        </div>

        {/* Bottom Row: Specific Filters */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
           <select 
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
              value={filterEntityType}
              onChange={(e) => setFilterEntityType(e.target.value)}
            >
              <option value="ALL">Alle Entiteiten</option>
              <option value="RESERVATION">Reserveringen</option>
              <option value="CALENDAR">Kalender</option>
              <option value="SYSTEM">Systeem</option>
              <option value="CUSTOMER">Klanten</option>
              <option value="WAITLIST">Wachtlijst</option>
           </select>

           <select 
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
            >
              <option value="ALL">Alle Gebruikers</option>
              {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
           </select>

           <select 
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
            >
              <option value="ALL">Alle Acties</option>
              {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
           </select>

           <div className="relative">
             <input 
               type="date" 
               className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
               value={dateRange.start}
               onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
               placeholder="Van"
             />
           </div>
           
           <div className="relative">
             <input 
               type="date" 
               className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
               value={dateRange.end}
               onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
               placeholder="Tot"
             />
           </div>
        </div>
      </Card>

      {/* Log List */}
      <div className="flex-grow bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-grow">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase tracking-widest font-bold sticky top-0">
              <tr>
                <th className="p-4 border-b border-slate-800 w-48">Tijdstip</th>
                <th className="p-4 border-b border-slate-800 w-48">Gebruiker</th>
                <th className="p-4 border-b border-slate-800 w-40">Actie</th>
                <th className="p-4 border-b border-slate-800">Entiteit / Omschrijving</th>
                <th className="p-4 border-b border-slate-800 w-24">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500">
                    <Activity size={32} className="mx-auto mb-4 opacity-50"/>
                    Geen activiteit gevonden met deze filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/50 transition-colors group">
                    <td className="p-4 text-slate-400 font-mono text-xs">
                      <div className="flex items-center">
                        <Clock size={14} className="mr-2 opacity-50" />
                        {new Date(log.timestamp).toLocaleString('nl-NL')}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-700">
                           {log.user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-white text-xs font-bold">{log.user.name}</p>
                          <p className="text-[9px] text-slate-500 uppercase">{log.user.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`text-[10px] font-black px-2 py-1 rounded border uppercase tracking-wide
                        ${log.action.includes('DELETE') || log.action.includes('CANCEL') ? 'bg-red-900/20 text-red-500 border-red-900/50' : 
                          log.action.includes('CREATE') || log.action.includes('CONFIRM') ? 'bg-emerald-900/20 text-emerald-500 border-emerald-900/50' : 
                          'bg-blue-900/20 text-blue-500 border-blue-900/50'}
                      `}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-950 px-1.5 rounded border border-slate-800">{log.entityType}</span>
                          <span className="font-mono text-xs text-amber-500">{log.entityId}</span>
                        </div>
                        {log.changes?.description && (
                          <span className="text-slate-400 text-xs truncate max-w-md">{log.changes.description}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <Button variant="ghost" onClick={() => setSelectedLog(log)} className="h-8 w-8 p-0">
                        <ChevronRight size={16} />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-800 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-serif text-white mb-1">Log Details</h3>
                <p className="font-mono text-xs text-slate-500">{selectedLog.id}</p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-slate-500 hover:text-white"><ShieldAlert size={20}/></button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-black/40 rounded-xl border border-slate-800">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Gebruiker</p>
                  <p className="text-white font-bold">{selectedLog.user.name}</p>
                  <p className="text-xs text-slate-500">{selectedLog.user.role}</p>
                </div>
                <div className="p-4 bg-black/40 rounded-xl border border-slate-800">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Actie</p>
                  <p className="text-white font-bold">{selectedLog.action}</p>
                  <p className="text-xs text-slate-500">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                </div>
              </div>

              {selectedLog.changes?.description && (
                 <div className="p-4 bg-blue-900/10 border border-blue-900/30 rounded-xl">
                   <p className="text-blue-400 text-xs font-bold uppercase mb-1">Omschrijving</p>
                   <p className="text-slate-300 text-sm">{selectedLog.changes.description}</p>
                 </div>
              )}

              {/* Visual Diff View */}
              {selectedLog.changes?.before && selectedLog.changes?.after && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                   <div className="p-3 bg-slate-900 border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Wijzigingen
                   </div>
                   <div className="p-4 space-y-2">
                      {generateChangeList(selectedLog.changes.before, selectedLog.changes.after).length > 0 ? (
                          generateChangeList(selectedLog.changes.before, selectedLog.changes.after).map((diff, idx) => (
                              <div key={idx} className="flex items-center text-sm p-2 hover:bg-slate-900/50 rounded">
                                  <span className="w-32 text-slate-500 font-bold">{diff.field}</span>
                                  <span className="text-red-400 line-through mr-3">{diff.from}</span>
                                  <ArrowRight size={14} className="text-slate-600 mr-3" />
                                  <span className="text-emerald-400 font-bold">{diff.to}</span>
                              </div>
                          ))
                      ) : (
                          <p className="text-slate-500 text-sm italic">Geen specifieke veldwijzigingen gedetecteerd of JSON structuur te complex.</p>
                      )}
                   </div>
                </div>
              )}

              {/* Raw JSON View */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <p className="text-xs font-bold text-red-500 uppercase tracking-widest flex items-center"><FileJson size={14} className="mr-2"/> Voor Wijziging</p>
                   <pre className="bg-black p-4 rounded-xl border border-red-900/30 text-[10px] font-mono text-slate-400 overflow-x-auto whitespace-pre-wrap h-64 custom-scrollbar">
                     {selectedLog.changes?.before ? JSON.stringify(selectedLog.changes.before, null, 2) : 'N/A'}
                   </pre>
                 </div>
                 <div className="space-y-2">
                   <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest flex items-center"><FileJson size={14} className="mr-2"/> Na Wijziging</p>
                   <pre className="bg-black p-4 rounded-xl border border-emerald-900/30 text-[10px] font-mono text-slate-400 overflow-x-auto whitespace-pre-wrap h-64 custom-scrollbar">
                     {selectedLog.changes?.after ? JSON.stringify(selectedLog.changes.after, null, 2) : 'N/A'}
                   </pre>
                 </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 flex justify-end">
              <Button variant="secondary" onClick={() => setSelectedLog(null)}>Sluiten</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
