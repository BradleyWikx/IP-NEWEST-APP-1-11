
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Mail, Settings, History, Plus, Search, 
  ChevronRight, Save, Eye, Trash2, Send,
  FileText, Info, CheckCircle2, AlertCircle, X,
  ArrowLeft, Copy, Clock, Filter, User, RefreshCw,
  LayoutTemplate
} from 'lucide-react';
import { Button, Input, Card, Badge, ResponsiveDrawer } from '../UI';
import { 
  EmailTemplate, EmailLog, Reservation, VoucherOrder, WaitlistEntry, EmailCategory 
} from '../../types';
import { 
  emailTemplateRepo, emailLogRepo, bookingRepo, voucherOrderRepo, waitlistRepo, saveData, STORAGE_KEYS
} from '../../utils/storage';
import { 
  renderTemplate, simulateSendEmail, getAvailableVariables, triggerEmail 
} from '../../utils/emailEngine';

export const EmailCenter = () => {
  const [activeTab, setActiveTab] = useState<'TEMPLATES' | 'LOGS'>('TEMPLATES');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  
  // Entity Data for Previews
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [voucherOrders, setVoucherOrders] = useState<VoucherOrder[]>([]);
  
  // Editor State
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewEntityId, setPreviewEntityId] = useState('');
  
  // Logs State
  const [logFilter, setLogFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 5000); // Poll for new logs
    return () => clearInterval(interval);
  }, []);

  const refreshData = () => {
    setTemplates(emailTemplateRepo.getAll());
    setLogs(emailLogRepo.getAll().sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setReservations(bookingRepo.getAll());
    setVoucherOrders(voucherOrderRepo.getAll());
  };

  // --- Template Actions ---

  const handleSaveTemplate = () => {
    if (!editingTemplate) return;
    emailTemplateRepo.update(editingTemplate.id, () => ({ 
      ...editingTemplate, 
      updatedAt: new Date().toISOString() 
    }));
    refreshData();
    setEditingTemplate(null);
  };

  const handlePreview = () => {
    if (!editingTemplate || !previewEntityId) return null;
    
    // Find entity based on category
    let data: any = {};
    let type: any = 'RESERVATION';

    if (editingTemplate.category === 'BOOKING') {
      const r = reservations.find(r => r.id === previewEntityId);
      if (r) { data = r; type = 'RESERVATION'; }
    } else if (editingTemplate.category === 'VOUCHER') {
      const v = voucherOrders.find(o => o.id === previewEntityId);
      if (v) { data = v; type = 'VOUCHER_ORDER'; }
    } else if (editingTemplate.category === 'WAITLIST') {
        // Mock waitlist data if not loaded, or load from repo
        const w = waitlistRepo.getAll().find(w => w.id === previewEntityId);
        if(w) { data = w; type = 'WAITLIST'; }
    }

    // Generate a dummy log in memory to get the rendered content
    const dummyLog = triggerEmail(editingTemplate.key, { type, id: previewEntityId, data });
    return dummyLog;
  };

  const previewResult = useMemo(() => handlePreview(), [editingTemplate, previewEntityId, editingTemplate?.subject, editingTemplate?.bodyHtml]);

  const insertVariable = (variable: string) => {
    if (!editingTemplate) return;
    // Simple append for now. 
    // In a real app, we'd use a ref to the textarea to insert at cursor position.
    setEditingTemplate({
        ...editingTemplate,
        bodyHtml: editingTemplate.bodyHtml + ` ${variable} `
    });
  };

  // --- Log Actions ---

  const handleResend = async (log: EmailLog) => {
    if (confirm(`Opnieuw versturen naar ${log.to}?`)) {
      // Create a copy log
      const newLog: EmailLog = {
        ...log,
        id: `RETRY-${Date.now()}`,
        status: 'QUEUED',
        createdAt: new Date().toISOString(),
        sentAt: undefined,
        error: undefined
      };
      emailLogRepo.add(newLog);
      refreshData();
      await simulateSendEmail(newLog.id);
      refreshData();
    }
  };

  // --- Renderers ---

  const renderTemplateEditor = () => {
    if (!editingTemplate) return null;
    
    const variables = getAvailableVariables(editingTemplate.category);

    return (
      <div className="fixed inset-0 z-50 bg-black/95 flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
          <div>
            <h3 className="text-xl font-serif text-white">{editingTemplate.name}</h3>
            <p className="text-xs text-slate-500 font-mono mt-1">{editingTemplate.key}</p>
          </div>
          <div className="flex space-x-2">
             <Button variant="ghost" onClick={() => setEditingTemplate(null)}>Sluiten</Button>
             <Button onClick={handleSaveTemplate} className="flex items-center"><Save size={16} className="mr-2"/> Opslaan</Button>
          </div>
        </div>

        <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
           {/* Editor Inputs */}
           <div className="flex-1 p-6 space-y-6 overflow-y-auto custom-scrollbar border-r border-slate-800">
              <div className="flex items-center justify-between">
                 <Badge status={editingTemplate.enabled ? 'CONFIRMED' : 'CANCELLED'}>
                   {editingTemplate.enabled ? 'Actief' : 'Uitgeschakeld'}
                 </Badge>
                 <button 
                   onClick={() => setEditingTemplate({...editingTemplate, enabled: !editingTemplate.enabled})}
                   className="text-xs text-slate-400 hover:text-white underline"
                 >
                   {editingTemplate.enabled ? 'Uitschakelen' : 'Inschakelen'}
                 </button>
              </div>

              <Input 
                label="Onderwerp" 
                value={editingTemplate.subject} 
                onChange={(e: any) => setEditingTemplate({...editingTemplate, subject: e.target.value})}
              />

              <div className="space-y-1.5 flex-grow flex flex-col">
                <label className="text-xs font-bold text-amber-500 uppercase tracking-widest flex justify-between">
                  <span>Inhoud (HTML)</span>
                  <span className="text-[10px] text-slate-500">Ondersteunt basis HTML tags</span>
                </label>
                <textarea 
                  className="w-full h-96 bg-black border border-slate-800 rounded-xl p-4 text-sm text-slate-300 focus:border-amber-500 outline-none font-mono leading-relaxed resize-none flex-grow"
                  value={editingTemplate.bodyHtml}
                  onChange={(e) => setEditingTemplate({...editingTemplate, bodyHtml: e.target.value})}
                />
              </div>
           </div>

           {/* Sidebar: Variables & Preview */}
           <div className="w-full md:w-96 bg-slate-950 p-6 space-y-6 flex flex-col border-l border-slate-900 overflow-y-auto">
              
              {/* Variables */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                  <Info size={12} className="mr-2"/> Variabelen invoegen
                </h4>
                <div className="flex flex-wrap gap-2">
                  {variables.map(v => (
                    <button 
                      key={v}
                      onClick={() => insertVariable(v)}
                      className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-[10px] font-mono text-slate-400 hover:text-white hover:border-amber-500 transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview Control */}
              <div className="pt-6 border-t border-slate-900 flex-grow flex flex-col">
                 <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center">
                   <Eye size={12} className="mr-2"/> Live Preview
                 </h4>
                 <select 
                   className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white mb-4 outline-none focus:border-amber-500"
                   value={previewEntityId}
                   onChange={(e) => setPreviewEntityId(e.target.value)}
                 >
                   <option value="">Selecteer data...</option>
                   {editingTemplate.category === 'BOOKING' && reservations.slice(0, 10).map(r => (
                     <option key={r.id} value={r.id}>{r.id} - {r.customer.lastName}</option>
                   ))}
                   {editingTemplate.category === 'VOUCHER' && voucherOrders.slice(0, 10).map(v => (
                     <option key={v.id} value={v.id}>{v.id} - {v.buyer.lastName}</option>
                   ))}
                 </select>

                 {previewResult ? (
                   <div className="bg-white rounded-lg overflow-hidden flex-grow shadow-lg flex flex-col">
                      <div className="bg-gray-100 p-2 border-b border-gray-200 text-xs text-gray-500 truncate">
                        <strong>Subject:</strong> {previewResult.subject}
                      </div>
                      <div className="flex-grow p-4 overflow-y-auto text-black text-sm">
                        <div dangerouslySetInnerHTML={{ __html: previewResult.bodyHtml }} />
                      </div>
                   </div>
                 ) : (
                   <div className="bg-slate-900 rounded-lg flex-grow flex items-center justify-center text-slate-600 text-xs">
                     Selecteer data voor preview
                   </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    );
  };

  const renderTemplatesList = () => {
    const categories: EmailCategory[] = ['BOOKING', 'VOUCHER', 'WAITLIST'];
    
    return (
      <div className="space-y-8">
        {categories.map(cat => {
          const catTemplates = templates.filter(t => t.category === cat);
          if (catTemplates.length === 0) return null;

          return (
            <div key={cat}>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">
                {cat} Templates
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {catTemplates.map(t => (
                  <div 
                    key={t.id} 
                    onClick={() => setEditingTemplate(t)}
                    className="p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-amber-500 transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <LayoutTemplate size={16} className="text-slate-500 group-hover:text-amber-500" />
                        <h4 className="font-bold text-white text-sm">{t.name}</h4>
                      </div>
                      <Badge status={t.enabled ? 'CONFIRMED' : 'CANCELLED'}>
                        {t.enabled ? 'ON' : 'OFF'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 font-mono truncate">{t.key}</p>
                    <p className="text-xs text-slate-400 mt-2 line-clamp-1">"{t.subject}"</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderLogs = () => {
    const filteredLogs = logs.filter(l => 
      (logFilter === 'ALL' || l.status === logFilter) &&
      (l.to.toLowerCase().includes(searchTerm.toLowerCase()) || l.subject.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
      <div className="space-y-4">
        {/* Filters */}
        <Card className="p-4 bg-slate-900/50 flex flex-col md:flex-row gap-4 items-center">
           <div className="relative flex-grow w-full md:w-auto">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
             <input 
               className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
               placeholder="Zoek op email of onderwerp..."
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
           </div>
           <div className="flex space-x-2">
             {['ALL', 'SENT', 'QUEUED', 'FAILED'].map(s => (
               <button 
                 key={s}
                 onClick={() => setLogFilter(s)}
                 className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${logFilter === s ? 'bg-amber-500 text-black' : 'bg-slate-950 border border-slate-800 text-slate-500'}`}
               >
                 {s}
               </button>
             ))}
           </div>
        </Card>

        {/* Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase tracking-widest font-bold">
              <tr>
                <th className="p-4">Tijd</th>
                <th className="p-4">Ontvanger</th>
                <th className="p-4">Onderwerp</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="p-4 text-slate-400 text-xs font-mono">
                    {new Date(log.createdAt).toLocaleString('nl-NL')}
                  </td>
                  <td className="p-4 text-white font-bold">
                    {log.to}
                  </td>
                  <td className="p-4 text-slate-300 truncate max-w-xs">
                    {log.subject}
                  </td>
                  <td className="p-4">
                    <Badge status={log.status === 'SENT' ? 'CONFIRMED' : log.status === 'QUEUED' ? 'OPTION' : 'CANCELLED'}>
                      {log.status}
                    </Badge>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end space-x-2">
                      <Button variant="ghost" onClick={() => setSelectedLog(log)} className="h-8 w-8 p-0 text-slate-400 hover:text-white">
                        <Eye size={16} />
                      </Button>
                      <Button variant="ghost" onClick={() => handleResend(log)} className="h-8 w-8 p-0 text-slate-400 hover:text-amber-500" title="Opnieuw sturen">
                        <RefreshCw size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">Geen logs gevonden.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-serif text-white">Email Center</h2>
          <p className="text-slate-500 text-sm">Beheer templates en bekijk verzonden e-mails.</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex space-x-1 border-b border-slate-800">
        <button 
          onClick={() => setActiveTab('TEMPLATES')}
          className={`px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'TEMPLATES' ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          Templates
        </button>
        <button 
          onClick={() => setActiveTab('LOGS')}
          className={`px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'LOGS' ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          Logboek
        </button>
      </div>

      {/* Content */}
      <div className="flex-grow overflow-y-auto">
        {activeTab === 'TEMPLATES' && renderTemplatesList()}
        {activeTab === 'LOGS' && renderLogs()}
      </div>

      {/* Modals */}
      {editingTemplate && renderTemplateEditor()}

      {/* Log Details Drawer */}
      <ResponsiveDrawer
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Email Details"
      >
        {selectedLog && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 grid grid-cols-2 gap-4">
               <div>
                 <p className="text-xs text-slate-500 uppercase font-bold">Verzonden Aan</p>
                 <p className="text-white">{selectedLog.to}</p>
               </div>
               <div>
                 <p className="text-xs text-slate-500 uppercase font-bold">Datum</p>
                 <p className="text-white">{new Date(selectedLog.createdAt).toLocaleString()}</p>
               </div>
               <div>
                 <p className="text-xs text-slate-500 uppercase font-bold">Status</p>
                 <Badge status={selectedLog.status === 'SENT' ? 'CONFIRMED' : 'OPTION'}>{selectedLog.status}</Badge>
               </div>
               <div>
                 <p className="text-xs text-slate-500 uppercase font-bold">Template</p>
                 <p className="text-white font-mono text-xs">{selectedLog.templateKey}</p>
               </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase font-bold">Onderwerp</p>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-white font-bold">
                {selectedLog.subject}
              </div>
            </div>

            <div className="space-y-2 flex-grow flex flex-col">
              <p className="text-xs text-slate-500 uppercase font-bold">Inhoud Preview</p>
              <div className="bg-white rounded-xl overflow-hidden border border-slate-300 flex-grow h-96">
                 <iframe 
                   title="email-preview"
                   srcDoc={selectedLog.bodyHtml}
                   className="w-full h-full border-none"
                 />
              </div>
            </div>
          </div>
        )}
      </ResponsiveDrawer>
    </div>
  );
};
