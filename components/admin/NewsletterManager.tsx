import React, { useState, useEffect } from 'react';
import { 
  Mail, Search, Download, Filter, UserCheck, 
  Trash2, RefreshCw, X, Check, Calendar, Tag 
} from 'lucide-react';
import { Button, Input, Card, Badge } from '../UI';
import { Subscriber } from '../../types';
import { loadData, saveData } from '../../utils/storage';
import { exportToCSV } from '../../utils/csvExport';
import { logAuditAction } from '../../utils/auditLogger';

const STORAGE_KEY = 'grand_stage_subscribers';

export const NewsletterManager = () => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [filteredSubscribers, setFilteredSubscribers] = useState<Subscriber[]>([]);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [prefFilter, setPrefFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Segments (Quick Filters)
  const [activeSegment, setActiveSegment] = useState<string | null>(null);

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [search, statusFilter, prefFilter, dateRange, subscribers]);

  const refreshData = () => {
    setSubscribers(loadData<Subscriber[]>(STORAGE_KEY, []));
  };

  const applyFilters = () => {
    let result = subscribers;

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.email.toLowerCase().includes(q)
      );
    }

    // Status
    if (statusFilter !== 'ALL') {
      result = result.filter(s => s.status === statusFilter);
    }

    // Preference
    if (prefFilter !== 'ALL') {
      result = result.filter(s => s.preferences.includes(prefFilter));
    }

    // Date Range
    if (dateRange.start) {
      result = result.filter(s => new Date(s.createdAt) >= new Date(dateRange.start));
    }
    if (dateRange.end) {
      // End of day
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59, 999);
      result = result.filter(s => new Date(s.createdAt) <= end);
    }

    setFilteredSubscribers(result);
  };

  // Actions
  const handleExport = () => {
    const exportData = filteredSubscribers.map(s => ({
      ID: s.id,
      Naam: s.name,
      Email: s.email,
      Status: s.status,
      Voorkeuren: s.preferences.join('; '),
      Datum: new Date(s.createdAt).toLocaleDateString()
    }));
    exportToCSV(exportData, `nieuwsbrief_export_${new Date().toISOString().split('T')[0]}`);
  };

  const handleDelete = (id: string) => {
    if (confirm('Weet u zeker dat u deze inschrijving wilt verwijderen?')) {
      const updated = subscribers.filter(s => s.id !== id);
      saveData(STORAGE_KEY, updated);
      setSubscribers(updated);
      logAuditAction('DELETE_SUBSCRIBER', 'SYSTEM', id, { description: 'Deleted subscriber' });
    }
  };

  const handleToggleStatus = (subscriber: Subscriber) => {
    const newStatus: Subscriber['status'] = subscriber.status === 'SUBSCRIBED' ? 'UNSUBSCRIBED' : 'SUBSCRIBED';
    const updated = subscribers.map(s => s.id === subscriber.id ? { ...s, status: newStatus } : s);
    saveData(STORAGE_KEY, updated);
    setSubscribers(updated);
    logAuditAction('UPDATE_SUBSCRIBER_STATUS', 'SYSTEM', subscriber.id, { 
      description: `Status changed to ${newStatus}`,
      after: { status: newStatus }
    });
  };

  const applySegment = (segmentId: string) => {
    setActiveSegment(segmentId);
    // Reset filters first
    setSearch('');
    
    switch (segmentId) {
      case 'RECENT':
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        setDateRange({ start: thirtyDaysAgo.toISOString().split('T')[0], end: '' });
        setStatusFilter('ALL');
        setPrefFilter('ALL');
        break;
      case 'VIP':
        setDateRange({ start: '', end: '' });
        setStatusFilter('SUBSCRIBED');
        setPrefFilter('SPECIALS');
        break;
      case 'PENDING':
        setDateRange({ start: '', end: '' });
        setStatusFilter('PENDING');
        setPrefFilter('ALL');
        break;
      default:
        resetFilters();
    }
  };

  const resetFilters = () => {
    setActiveSegment(null);
    setSearch('');
    setStatusFilter('ALL');
    setPrefFilter('ALL');
    setDateRange({ start: '', end: '' });
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-serif text-white">Nieuwsbrief</h2>
          <p className="text-slate-500 text-sm">Beheer inschrijvingen en segmenten.</p>
        </div>
        <Button variant="secondary" onClick={handleExport} className="flex items-center">
          <Download size={18} className="mr-2" /> CSV Export
        </Button>
      </div>

      {/* Segments (Quick Filters) */}
      <div className="flex gap-4 border-b border-slate-800 pb-6 overflow-x-auto">
        <button 
          onClick={() => resetFilters()}
          className={`px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${!activeSegment ? 'bg-white text-black border-white' : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-600'}`}
        >
          Alle
        </button>
        <button 
          onClick={() => applySegment('RECENT')}
          className={`px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${activeSegment === 'RECENT' ? 'bg-amber-500 text-black border-amber-500' : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-600'}`}
        >
          Recent (30d)
        </button>
        <button 
          onClick={() => applySegment('VIP')}
          className={`px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${activeSegment === 'VIP' ? 'bg-purple-500 text-white border-purple-500' : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-600'}`}
        >
          Gala Interesse
        </button>
        <button 
          onClick={() => applySegment('PENDING')}
          className={`px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${activeSegment === 'PENDING' ? 'bg-blue-500 text-white border-blue-500' : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-600'}`}
        >
          Nog niet bevestigd
        </button>
      </div>

      {/* Detailed Filters */}
      <Card className="p-4 bg-slate-900/50 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
         <div className="md:col-span-1 relative">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
           <input 
             className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
             placeholder="Zoek naam of email..."
             value={search}
             onChange={e => setSearch(e.target.value)}
           />
         </div>
         
         <div className="md:col-span-2 flex space-x-2">
           <select 
             className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500 w-full"
             value={statusFilter}
             onChange={e => setStatusFilter(e.target.value)}
           >
             <option value="ALL">Alle Status</option>
             <option value="SUBSCRIBED">Actief</option>
             <option value="PENDING">Wacht op bevestiging</option>
             <option value="UNSUBSCRIBED">Uitgeschreven</option>
           </select>
           <select 
             className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500 w-full"
             value={prefFilter}
             onChange={e => setPrefFilter(e.target.value)}
           >
             <option value="ALL">Alle Interesses</option>
             <option value="UPDATES">Updates</option>
             <option value="SPECIALS">Specials</option>
             <option value="MERCH">Merchandise</option>
           </select>
         </div>

         <div className="flex space-x-2">
            <Input type="date" value={dateRange.start} onChange={(e: any) => setDateRange({...dateRange, start: e.target.value})} className="bg-slate-950 border-slate-800 text-white h-[42px]" />
         </div>
      </Card>

      {/* List */}
      <div className="flex-grow bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-grow">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase tracking-widest font-bold border-b border-slate-800 sticky top-0">
              <tr>
                <th className="p-4">Naam / Email</th>
                <th className="p-4">Status</th>
                <th className="p-4">Interesses</th>
                <th className="p-4">Inschrijfdatum</th>
                <th className="p-4 text-right">Actie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredSubscribers.length === 0 ? (
                <tr><td colSpan={5} className="p-12 text-center text-slate-500">Geen inschrijvingen gevonden.</td></tr>
              ) : (
                filteredSubscribers.map(sub => (
                  <tr key={sub.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white">{sub.name}</div>
                      <div className="text-xs text-slate-500">{sub.email}</div>
                    </td>
                    <td className="p-4">
                      {sub.status === 'SUBSCRIBED' && <Badge status="CONFIRMED" className="bg-emerald-900/20 text-emerald-500 border-emerald-900/50">Actief</Badge>}
                      {sub.status === 'PENDING' && <Badge status="OPTION" className="bg-blue-900/20 text-blue-500 border-blue-900/50">Pending</Badge>}
                      {sub.status === 'UNSUBSCRIBED' && <Badge status="CANCELLED" className="bg-slate-800 text-slate-500 border-slate-700">Uitgeschreven</Badge>}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {sub.preferences.map(pref => (
                          <span key={pref} className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-400">
                            {pref}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 text-slate-400 font-mono text-xs">
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end space-x-2">
                        {sub.status !== 'UNSUBSCRIBED' && (
                          <Button variant="ghost" onClick={() => handleToggleStatus(sub)} className="h-8 w-8 p-0 text-slate-500 hover:text-red-500" title="Uitschrijven">
                            <X size={16} />
                          </Button>
                        )}
                        {sub.status === 'UNSUBSCRIBED' && (
                          <Button variant="ghost" onClick={() => handleToggleStatus(sub)} className="h-8 w-8 p-0 text-slate-500 hover:text-emerald-500" title="Heractiveren">
                            <RefreshCw size={16} />
                          </Button>
                        )}
                        <Button variant="ghost" onClick={() => handleDelete(sub.id)} className="h-8 w-8 p-0 text-slate-500 hover:text-red-500">
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-950 border-t border-slate-800 text-xs text-slate-500 flex justify-between">
           <span>Totaal: {filteredSubscribers.length}</span>
           <span>Filtered from {subscribers.length} total subscribers</span>
        </div>
      </div>
    </div>
  );
};