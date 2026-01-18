
import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, Plus, Search, Filter, Printer, Download, Mail, 
  Trash2, CheckCircle2, AlertCircle, RefreshCw, X, Eye, Edit3, Save, MapPin, Building2,
  Check, XCircle, BellRing
} from 'lucide-react';
import { Button, Input, Card, Badge, ResponsiveDrawer } from '../UI';
import { Invoice, Reservation, InvoiceItem, VatRate } from '../../types';
import { invoiceRepo, bookingRepo } from '../../utils/storage';
import { createInvoiceFromReservation, calculateInvoiceTotals, generateInvoiceId, createManualInvoice } from '../../utils/invoiceLogic';
import { printInvoice, printBatchInvoices } from '../../utils/invoiceGenerator';
import { ResponsiveTable } from '../ResponsiveTable';
import { formatCurrency } from '../../utils/formatters';
import { undoManager } from '../../utils/undoManager';
import { logAuditAction } from '../../utils/auditLogger';
import { triggerEmail } from '../../utils/emailEngine';

export const InvoiceManager = () => {
  const [activeTab, setActiveTab] = useState<'DRAFT' | 'SENT' | 'PAID' | 'ALL'>('ALL');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Creation/Edit State
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedResId, setSelectedResId] = useState('');
  
  // Edit Mode toggle inside drawer
  const [isEditingDetails, setIsEditingDetails] = useState(false);

  useEffect(() => {
    refreshData();
    window.addEventListener('storage-update', refreshData);
    return () => window.removeEventListener('storage-update', refreshData);
  }, []);

  const refreshData = () => {
    setInvoices(invoiceRepo.getAll().sort((a,b) => new Date(b.dates.created).getTime() - new Date(a.dates.created).getTime()));
    setReservations(bookingRepo.getAll().filter(r => r.status !== 'CANCELLED' && r.status !== 'ARCHIVED'));
  };

  // --- BULK ACTIONS ---

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredInvoices.length && filteredInvoices.length > 0) {
        setSelectedIds(new Set());
    } else {
        setSelectedIds(new Set(filteredInvoices.map(i => i.id)));
    }
  };

  const handleBulkPrint = () => {
      const selected = invoices.filter(i => selectedIds.has(i.id));
      if (selected.length === 0) return;
      printBatchInvoices(selected);
      setSelectedIds(new Set()); // Optional: clear selection after print
  };

  const handleBulkStatus = (status: Invoice['status']) => {
      if (selectedIds.size === 0) return;
      if (!confirm(`Wil je ${selectedIds.size} facturen markeren als ${status}?`)) return;

      selectedIds.forEach(id => {
          invoiceRepo.update(id, i => ({ 
              ...i, 
              status, 
              dates: { 
                  ...i.dates, 
                  issued: status === 'SENT' ? new Date().toISOString() : i.dates.issued,
                  paid: status === 'PAID' ? new Date().toISOString() : i.dates.paid
              } 
          }));
      });
      
      undoManager.showSuccess(`${selectedIds.size} facturen bijgewerkt.`);
      setSelectedIds(new Set());
      refreshData();
  };

  const handleBulkReminder = () => {
      const selected = invoices.filter(i => selectedIds.has(i.id));
      const remindable = selected.filter(i => i.status !== 'PAID');
      
      if (remindable.length === 0) {
          undoManager.showError("Geen openstaande facturen geselecteerd.");
          return;
      }

      if (!confirm(`Wil je ${remindable.length} betalingsherinneringen versturen?`)) return;

      remindable.forEach(inv => {
          // Trigger email logic here
          // We use INVOICE_REMINDER template. 
          triggerEmail('INVOICE_REMINDER', { type: 'INVOICE', id: inv.id, data: inv });
      });

      undoManager.showSuccess(`${remindable.length} herinneringen verstuurd.`);
      setSelectedIds(new Set());
  };

  // --- ACTIONS ---

  const handleCreateDraft = () => {
    if (!selectedResId) return;
    
    const res = reservations.find(r => r.id === selectedResId);
    if (!res) return;

    const newInvoice = createInvoiceFromReservation(res);
    invoiceRepo.add(newInvoice);
    
    logAuditAction('CREATE_INVOICE', 'SYSTEM', newInvoice.id, { description: `Created from reservation ${res.id}` });
    undoManager.showSuccess("Concept factuur aangemaakt.");
    
    setIsCreatorOpen(false);
    setSelectedResId('');
    setSelectedInvoice(newInvoice); // Open details immediately
    refreshData();
  };

  const handleCreateManualDraft = () => {
      const newInvoice = createManualInvoice();
      invoiceRepo.add(newInvoice);
      logAuditAction('CREATE_INVOICE', 'SYSTEM', newInvoice.id, { description: 'Created manual invoice' });
      undoManager.showSuccess("Lege factuur aangemaakt.");
      
      setIsCreatorOpen(false);
      setSelectedInvoice(newInvoice);
      setIsEditingDetails(true); // Auto enable edit mode for new manual invoice
      refreshData();
  };

  const handleStatusChange = (invoice: Invoice, status: Invoice['status']) => {
    invoiceRepo.update(invoice.id, i => ({ ...i, status }));
    refreshData();
    if(selectedInvoice?.id === invoice.id) setSelectedInvoice({ ...selectedInvoice, status });
  };

  const handleDelete = (id: string) => {
    if (confirm("Weet je zeker dat je deze factuur wilt verwijderen?")) {
        invoiceRepo.delete(id);
        refreshData();
        setSelectedInvoice(null);
        undoManager.showSuccess("Factuur verwijderd.");
    }
  };

  const handleSendEmail = (invoice: Invoice) => {
    // Determine if it's initial send or reminder based on status
    if (invoice.status === 'SENT' || invoice.status === 'OVERDUE') {
        triggerEmail('INVOICE_REMINDER', { type: 'INVOICE', id: invoice.id, data: invoice });
        undoManager.showSuccess(`Herinnering verstuurd.`);
    } else {
        triggerEmail('INVOICE_SENT', { type: 'INVOICE', id: invoice.id, data: invoice });
        invoiceRepo.update(invoice.id, i => ({ ...i, status: 'SENT', dates: { ...i.dates, issued: new Date().toISOString() } }));
        refreshData();
        undoManager.showSuccess(`Factuur verzonden.`);
    }
  };

  // --- EDITING LOGIC ---

  const handleUpdateItem = (idx: number, field: string, val: any) => {
    if (!selectedInvoice) return;
    
    const newItems = [...selectedInvoice.items];
    const currentItem = { ...newItems[idx], [field]: val };
    
    // Recalc line total if qty/price changed
    if (field === 'quantity' || field === 'unitPrice') {
        currentItem.total = currentItem.quantity * currentItem.unitPrice;
    }
    
    newItems[idx] = currentItem;

    const newTotals = calculateInvoiceTotals(newItems);
    const updated = { ...selectedInvoice, items: newItems, totals: newTotals };
    
    // Auto-save to repo for seamless experience
    invoiceRepo.update(selectedInvoice.id, () => updated);
    setSelectedInvoice(updated);
    refreshData();
  };

  const handleAddItem = () => {
    if (!selectedInvoice) return;
    const newItem: InvoiceItem = {
        id: `ITEM-${Date.now()}`,
        description: 'Extra item',
        quantity: 1,
        unitPrice: 0,
        vatRate: 21,
        total: 0,
        category: 'OTHER'
    };
    
    const newItems = [...selectedInvoice.items, newItem];
    const newTotals = calculateInvoiceTotals(newItems);
    const updated = { ...selectedInvoice, items: newItems, totals: newTotals };
    
    invoiceRepo.update(selectedInvoice.id, () => updated);
    setSelectedInvoice(updated);
    refreshData();
  };

  const handleRemoveItem = (idx: number) => {
    if (!selectedInvoice) return;
    const newItems = selectedInvoice.items.filter((_, i) => i !== idx);
    const newTotals = calculateInvoiceTotals(newItems);
    const updated = { ...selectedInvoice, items: newItems, totals: newTotals };
    
    invoiceRepo.update(selectedInvoice.id, () => updated);
    setSelectedInvoice(updated);
    refreshData();
  };

  const handleUpdateCustomerSnapshot = (field: string, val: string) => {
      if (!selectedInvoice) return;
      const updatedSnapshot = { ...selectedInvoice.customerSnapshot, [field]: val };
      const updated = { ...selectedInvoice, customerSnapshot: updatedSnapshot };
      
      invoiceRepo.update(selectedInvoice.id, () => updated);
      setSelectedInvoice(updated);
      refreshData();
  };

  // --- FILTERING ---

  const filteredInvoices = invoices.filter(inv => {
    const matchesTab = activeTab === 'ALL' || inv.status === activeTab;
    const matchesSearch = inv.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          inv.customerSnapshot.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // --- VISUAL GROUPING HELPER (Local for UI state) ---
  const groupedItems = useMemo(() => {
    if (!selectedInvoice) return [];
    
    // If we are editing (DRAFT), show ALL items so admin can tweak the split if needed
    if (selectedInvoice.status === 'DRAFT') {
        return selectedInvoice.items.map((item, idx) => ({ ...item, _originalIdx: idx }));
    }

    // If viewing (SENT/PAID), show grouped "Clean" view like PDF
    const groups: Record<string, InvoiceItem & { _originalIdx: number, isMixed?: boolean }> = {};
    const orderedKeys: string[] = [];

    selectedInvoice.items.forEach((item, idx) => {
        const key = item.originalReservationItemId || item.id;
        if (!groups[key]) {
            groups[key] = { ...item, _originalIdx: idx };
            orderedKeys.push(key);
            // Clean description
            groups[key].description = groups[key].description
                .replace(' (Diner & Show)', '')
                .replace(' (Drankenarrangement)', '')
                .replace(' (Arrangement)', '');
        } else {
            groups[key].total += item.total;
            groups[key].unitPrice = groups[key].total / groups[key].quantity;
            groups[key].isMixed = true;
        }
    });
    return orderedKeys.map(k => groups[k]);

  }, [selectedInvoice]);

  return (
    <div className="h-full flex flex-col space-y-6 pb-20">
      
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-serif text-white">Facturen</h2>
          <p className="text-slate-500 text-sm">Beheer concepten, verzonden en betaalde facturen.</p>
        </div>
        <Button onClick={() => setIsCreatorOpen(true)} className="flex items-center">
            <Plus size={18} className="mr-2"/> Nieuwe Factuur
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-800">
         <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            {['ALL', 'DRAFT', 'SENT', 'PAID'].map(tab => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`px-4 py-1.5 text-xs font-bold uppercase rounded-md transition-all ${activeTab === tab ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    {tab === 'ALL' ? 'Alles' : tab === 'DRAFT' ? 'Concept' : tab === 'SENT' ? 'Verzonden' : 'Betaald'}
                </button>
            ))}
         </div>
         <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:border-amber-500 outline-none"
                placeholder="Zoek factuur..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
         </div>
      </div>

      {/* List */}
      <div className="flex-grow bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col relative">
         <ResponsiveTable<Invoice>
            data={filteredInvoices}
            keyExtractor={i => i.id}
            onRowClick={(i) => setSelectedInvoice(i)}
            columns={[
                { 
                    header: (
                       <div className="flex items-center space-x-2">
                         <input 
                           type="checkbox" 
                           className="rounded bg-slate-900 border-slate-700 checked:bg-amber-500 w-4 h-4"
                           checked={filteredInvoices.length > 0 && selectedIds.size === filteredInvoices.length}
                           onChange={(e) => { e.stopPropagation(); toggleAll(); }}
                         />
                       </div>
                    ),
                    accessor: i => (
                       <div onClick={e => e.stopPropagation()}>
                         <input 
                           type="checkbox" 
                           className="rounded bg-slate-900 border-slate-700 checked:bg-amber-500 w-4 h-4"
                           checked={selectedIds.has(i.id)}
                           onChange={() => toggleSelection(i.id)}
                         />
                       </div>
                    ),
                    className: 'w-12 text-center'
                },
                { header: 'Nr', accessor: i => <span className="font-mono text-white">{i.id}</span> },
                { header: 'Datum', accessor: i => <span className="text-slate-400 text-xs">{new Date(i.dates.created).toLocaleDateString()}</span> },
                { header: 'Klant', accessor: i => <span className="font-bold text-white">{i.customerSnapshot.companyName || i.customerSnapshot.name}</span> },
                { header: 'Bedrag', accessor: i => <span className="font-mono text-emerald-400 font-bold">{formatCurrency(i.totals.totalIncl)}</span> },
                { header: 'Status', accessor: i => <Badge status={i.status === 'SENT' ? 'CONFIRMED' : i.status === 'PAID' ? 'ARRIVED' : i.status === 'DRAFT' ? 'OPTION' : 'CANCELLED'}>{i.status}</Badge> },
                { header: 'Actie', accessor: i => (
                    <div className="flex justify-end space-x-2">
                        {i.status !== 'PAID' && i.status !== 'DRAFT' && (
                            <Button 
                                variant="ghost" 
                                onClick={(e: any) => { e.stopPropagation(); handleSendEmail(i); }} 
                                className="h-8 w-8 p-0 text-slate-400 hover:text-amber-500"
                                title="Stuur Herinnering"
                            >
                                <BellRing size={16} />
                            </Button>
                        )}
                        <Button variant="ghost" onClick={(e: any) => { e.stopPropagation(); printInvoice(i); }} className="h-8 w-8 p-0 text-slate-400 hover:text-white">
                            <Printer size={16} />
                        </Button>
                    </div>
                )}
            ]}
         />
      </div>

      {/* FLOATING BULK ACTION BAR */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 shadow-2xl rounded-full px-6 py-3 z-50 flex items-center space-x-4 animate-in slide-in-from-bottom-10 fade-in">
           <div className="flex items-center space-x-2 border-r border-slate-700 pr-4">
              <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">{selectedIds.size}</span>
              <span className="text-xs font-bold text-white uppercase tracking-wider">Geselecteerd</span>
           </div>
           
           <div className="flex items-center space-x-2">
              <button 
                onClick={handleBulkPrint}
                className="p-2 hover:bg-slate-800 text-white rounded-lg transition-colors flex items-center text-xs font-bold" 
                title="Print Selectie"
              >
                <Printer size={16} className="mr-2"/> Print
              </button>
              
              <div className="h-4 w-px bg-slate-700 mx-2" />

              <button 
                onClick={() => handleBulkStatus('SENT')}
                className="p-2 hover:bg-blue-900/30 text-blue-500 rounded-lg transition-colors" 
                title="Markeer Verzonden"
              >
                <Mail size={18} />
              </button>
              <button 
                onClick={handleBulkReminder}
                className="p-2 hover:bg-amber-900/30 text-amber-500 rounded-lg transition-colors" 
                title="Stuur Herinnering"
              >
                <BellRing size={18} />
              </button>
              <button 
                onClick={() => handleBulkStatus('PAID')}
                className="p-2 hover:bg-emerald-900/30 text-emerald-500 rounded-lg transition-colors" 
                title="Markeer Betaald"
              >
                <CheckCircle2 size={18} />
              </button>
           </div>

           <button onClick={() => setSelectedIds(new Set())} className="ml-2 text-slate-500 hover:text-white">
              <X size={16} />
           </button>
        </div>
      )}

      {/* CREATOR MODAL */}
      <ResponsiveDrawer
        isOpen={isCreatorOpen}
        onClose={() => setIsCreatorOpen(false)}
        title="Nieuwe Factuur"
        widthClass="md:w-[500px]"
      >
         <div className="space-y-6">
            
            {/* Manual Option */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-amber-500 cursor-pointer transition-colors group" onClick={handleCreateManualDraft}>
                <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-white">Lege Factuur</h4>
                    <Plus size={16} className="text-slate-500 group-hover:text-amber-500" />
                </div>
                <p className="text-xs text-slate-500">
                    Maak een lege factuur aan en voeg handmatig regels en klantgegevens toe. Geschikt voor merchandise nabestellingen of losse diensten.
                </p>
            </div>

            <div className="flex items-center space-x-2 text-xs text-slate-500 uppercase tracking-widest my-4">
                <div className="h-px bg-slate-800 flex-grow"></div>
                <span>OF</span>
                <div className="h-px bg-slate-800 flex-grow"></div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Vanuit Reservering</label>
                <select 
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500"
                    value={selectedResId}
                    onChange={(e) => setSelectedResId(e.target.value)}
                >
                    <option value="">Selecteer...</option>
                    {reservations.map(r => (
                        <option key={r.id} value={r.id}>
                            {r.customer.lastName} - {new Date(r.date).toLocaleDateString()} ({r.id})
                        </option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1 italic">
                    Items worden automatisch gesplitst in 9% en 21% BTW voor de boekhouding, maar samengevoegd op de factuur.
                </p>
            </div>

            <div className="flex justify-end pt-4">
                <Button onClick={handleCreateDraft} disabled={!selectedResId} className="bg-emerald-600 hover:bg-emerald-700">
                    Genereer Concept
                </Button>
            </div>
         </div>
      </ResponsiveDrawer>

      {/* DETAIL DRAWER */}
      <ResponsiveDrawer
        isOpen={!!selectedInvoice}
        onClose={() => { setSelectedInvoice(null); setIsEditingDetails(false); }}
        title={`Factuur ${selectedInvoice?.id}`}
        widthClass="md:w-[900px]"
      >
         {selectedInvoice && (
             <div className="space-y-8 pb-12">
                 
                 {/* Actions Header */}
                 <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800 sticky top-0 z-20 shadow-xl">
                    <div className="flex space-x-2">
                        {selectedInvoice.status === 'DRAFT' && (
                            <Button onClick={() => handleSendEmail(selectedInvoice)} className="bg-blue-600 hover:bg-blue-700 text-xs h-8">
                                <Mail size={14} className="mr-2"/> Verstuur
                            </Button>
                        )}
                        {(selectedInvoice.status === 'SENT' || selectedInvoice.status === 'OVERDUE') && (
                            <Button onClick={() => handleSendEmail(selectedInvoice)} className="bg-amber-600 hover:bg-amber-700 text-xs h-8">
                                <BellRing size={14} className="mr-2"/> Herinnering
                            </Button>
                        )}
                        {selectedInvoice.status === 'SENT' && (
                            <Button onClick={() => handleStatusChange(selectedInvoice, 'PAID')} className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8">
                                <CheckCircle2 size={14} className="mr-2"/> Markeer Betaald
                            </Button>
                        )}
                        {selectedInvoice.status !== 'DRAFT' && (
                            <Button variant="secondary" onClick={() => handleStatusChange(selectedInvoice, 'DRAFT')} className="text-xs h-8 border-dashed border-slate-600 text-slate-300 hover:text-white">
                                <RefreshCw size={14} className="mr-2"/> Heropenen
                            </Button>
                        )}
                        <Button variant="secondary" onClick={() => printInvoice(selectedInvoice)} className="text-xs h-8">
                            <Printer size={14} className="mr-2"/> PDF / Print
                        </Button>
                    </div>
                    <div className="flex space-x-2">
                       {selectedInvoice.status === 'DRAFT' && (
                           <Button variant="ghost" onClick={() => setIsEditingDetails(!isEditingDetails)} className={`h-8 w-8 p-0 ${isEditingDetails ? 'text-amber-500 bg-amber-900/20' : 'text-slate-400'}`}>
                               <Edit3 size={16} />
                           </Button>
                       )}
                       <Button variant="ghost" onClick={() => handleDelete(selectedInvoice.id)} className="text-red-500 hover:bg-red-900/20 h-8 w-8 p-0">
                           <Trash2 size={16} />
                       </Button>
                    </div>
                 </div>

                 {/* Editable Customer Info */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className={`p-5 rounded-xl border transition-all ${isEditingDetails ? 'bg-slate-900/80 border-amber-500/50' : 'bg-slate-900 border-slate-800'}`}>
                        <div className="flex justify-between mb-3">
                            <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center">
                                <Building2 size={14} className="mr-2"/> Debiteur
                            </h4>
                            {isEditingDetails && <span className="text-[10px] text-amber-500 font-bold uppercase">Bewerkmodus</span>}
                        </div>
                        
                        {isEditingDetails ? (
                            <div className="space-y-3 animate-in fade-in">
                                <Input label="Bedrijfsnaam" value={selectedInvoice.customerSnapshot.companyName || ''} onChange={(e: any) => handleUpdateCustomerSnapshot('companyName', e.target.value)} />
                                <Input label="Naam Contact" value={selectedInvoice.customerSnapshot.name} onChange={(e: any) => handleUpdateCustomerSnapshot('name', e.target.value)} />
                                <Input label="Adres" value={selectedInvoice.customerSnapshot.address} onChange={(e: any) => handleUpdateCustomerSnapshot('address', e.target.value)} />
                                <div className="grid grid-cols-3 gap-2">
                                    <Input label="Postcode" value={selectedInvoice.customerSnapshot.zip} onChange={(e: any) => handleUpdateCustomerSnapshot('zip', e.target.value)} />
                                    <div className="col-span-2">
                                        <Input label="Plaats" value={selectedInvoice.customerSnapshot.city} onChange={(e: any) => handleUpdateCustomerSnapshot('city', e.target.value)} />
                                    </div>
                                </div>
                                <Input label="BTW Nummer" value={selectedInvoice.customerSnapshot.vatNumber || ''} onChange={(e: any) => handleUpdateCustomerSnapshot('vatNumber', e.target.value)} placeholder="NL..." />
                            </div>
                        ) : (
                            <div className="space-y-1 text-sm text-white">
                                <p className="font-bold text-lg">{selectedInvoice.customerSnapshot.companyName || selectedInvoice.customerSnapshot.name}</p>
                                {selectedInvoice.customerSnapshot.companyName && <p className="text-slate-400">{selectedInvoice.customerSnapshot.name}</p>}
                                <p className="text-slate-300 mt-2">{selectedInvoice.customerSnapshot.address}</p>
                                <p className="text-slate-300">{selectedInvoice.customerSnapshot.zip} {selectedInvoice.customerSnapshot.city}</p>
                                {selectedInvoice.customerSnapshot.vatNumber && <p className="text-xs text-slate-500 mt-2">BTW: {selectedInvoice.customerSnapshot.vatNumber}</p>}
                            </div>
                        )}
                    </div>

                    <div className="p-5 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center">
                            <FileText size={14} className="mr-2"/> Details
                        </h4>
                        <div className="grid grid-cols-2 gap-y-3 text-sm">
                            <span className="text-slate-400">Factuurnummer</span>
                            <span className="text-white font-mono font-bold text-right">{selectedInvoice.id}</span>
                            
                            <span className="text-slate-400">Factuurdatum</span>
                            <span className="text-white text-right">{new Date(selectedInvoice.dates.created).toLocaleDateString()}</span>
                            
                            <span className="text-slate-400">Vervaldatum</span>
                            <span className="text-white text-right">{new Date(selectedInvoice.dates.due).toLocaleDateString()}</span>
                            
                            <span className="text-slate-400">Status</span>
                            <div className="text-right"><Badge status={selectedInvoice.status}>{selectedInvoice.status}</Badge></div>
                        </div>
                    </div>
                 </div>

                 {/* Editable Items Table */}
                 <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-800">
                            <tr>
                                <th className="p-4 pl-6">Omschrijving</th>
                                <th className="p-4 w-24 text-center">Aantal</th>
                                <th className="p-4 w-28 text-right">Prijs (Incl.)</th>
                                <th className="p-4 w-20 text-right">BTW</th>
                                <th className="p-4 w-28 text-right">Totaal (Incl.)</th>
                                <th className="p-4 w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {groupedItems.map((item, idx) => (
                                <tr key={idx} className="group hover:bg-slate-800/50 transition-colors">
                                    <td className="p-3 pl-6">
                                        {selectedInvoice.status === 'DRAFT' ? (
                                            <input 
                                                className="bg-transparent text-white w-full outline-none placeholder:text-slate-600"
                                                value={item.description}
                                                onChange={(e) => handleUpdateItem((item as any)._originalIdx, 'description', e.target.value)}
                                                placeholder="Omschrijving..."
                                            />
                                        ) : <span className="text-white">{item.description}</span>}
                                    </td>
                                    <td className="p-3 text-center">
                                        {selectedInvoice.status === 'DRAFT' ? (
                                            <input 
                                                type="number"
                                                className="bg-slate-800/50 text-white w-full text-center rounded border border-slate-700 focus:border-amber-500 outline-none h-8"
                                                value={item.quantity}
                                                onChange={(e) => handleUpdateItem((item as any)._originalIdx, 'quantity', parseInt(e.target.value))}
                                            />
                                        ) : item.quantity}
                                    </td>
                                    <td className="p-3 text-right">
                                        {selectedInvoice.status === 'DRAFT' ? (
                                            <input 
                                                type="number"
                                                className="bg-transparent text-right text-slate-300 w-full outline-none font-mono"
                                                value={item.unitPrice}
                                                onChange={(e) => handleUpdateItem((item as any)._originalIdx, 'unitPrice', parseFloat(e.target.value))}
                                            />
                                        ) : <span className="font-mono text-slate-300">{formatCurrency(item.unitPrice)}</span>}
                                    </td>
                                    <td className="p-3 text-right text-slate-500 text-xs">
                                        {(item as any).isMixed ? 'Incl.' : `${item.vatRate}%`}
                                    </td>
                                    <td className="p-3 text-right font-bold font-mono text-emerald-400">{formatCurrency(item.total)}</td>
                                    <td className="p-3 text-center">
                                        {selectedInvoice.status === 'DRAFT' && (
                                            <button onClick={() => handleRemoveItem((item as any)._originalIdx)} className="text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                                                <X size={14} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        
                        {/* FOOTER & TOTALS */}
                        <tfoot className="bg-slate-950/50 border-t border-slate-800">
                            {selectedInvoice.status === 'DRAFT' && (
                                <tr>
                                    <td colSpan={6} className="p-2">
                                        <button onClick={handleAddItem} className="w-full py-2 text-xs font-bold text-slate-500 hover:text-white hover:bg-slate-900 border border-dashed border-slate-800 hover:border-slate-600 rounded flex items-center justify-center transition-all">
                                            <Plus size={12} className="mr-2"/> Regel Toevoegen
                                        </button>
                                    </td>
                                </tr>
                            )}
                            <tr className="bg-slate-900 border-b border-slate-800">
                                <td colSpan={4} className="p-4 text-right text-white font-black uppercase text-lg">Totaal te voldoen</td>
                                <td className="p-4 text-right font-mono text-xl text-emerald-400 font-bold">{formatCurrency(selectedInvoice.totals.totalIncl)}</td>
                                <td></td>
                            </tr>
                            <tr>
                                <td colSpan={4} className="p-2 text-right text-slate-500 text-xs">Waarvan BTW 9%</td>
                                <td className="p-2 text-right font-mono text-slate-500 text-xs">{formatCurrency(selectedInvoice.totals.vat9)}</td>
                                <td></td>
                            </tr>
                            <tr>
                                <td colSpan={4} className="p-2 text-right text-slate-500 text-xs">Waarvan BTW 21%</td>
                                <td className="p-2 text-right font-mono text-slate-500 text-xs">{formatCurrency(selectedInvoice.totals.vat21)}</td>
                                <td></td>
                            </tr>
                            <tr>
                                <td colSpan={4} className="p-2 text-right text-slate-500 text-xs pt-2">Totaal Excl. BTW</td>
                                <td className="p-2 text-right font-mono text-slate-500 text-xs pt-2">{formatCurrency(selectedInvoice.totals.subtotalExcl)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                 </div>

             </div>
         )}
      </ResponsiveDrawer>

    </div>
  );
};
