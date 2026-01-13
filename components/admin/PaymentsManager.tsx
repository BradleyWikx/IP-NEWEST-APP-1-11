
import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, AlertCircle, CheckCircle2, Clock, 
  Search, Filter, Download, Mail, CreditCard, Calendar,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button, Card, Badge, Input, ResponsiveDrawer } from '../UI';
import { Reservation, BookingStatus } from '../../types';
import { bookingRepo, saveData, STORAGE_KEYS } from '../../utils/storage';
import { ResponsiveTable } from '../ResponsiveTable';
import { getPaymentStatus, getPaymentColor } from '../../utils/paymentHelpers';
import { undoManager } from '../../utils/undoManager';
import { logAuditAction } from '../../utils/auditLogger';
import { triggerEmail } from '../../utils/emailEngine';
import { toCSV, downloadCSV } from '../../utils/csvExport';
import { formatGuestName } from '../../utils/formatters';

const ITEMS_PER_PAGE = 20;

export const PaymentsManager = () => {
  const [activeTab, setActiveTab] = useState<'OPEN' | 'PAID'>('OPEN');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  
  // Payment Modal
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('FACTUUR');

  useEffect(() => {
    refreshData();
    window.addEventListener('storage-update', refreshData);
    return () => window.removeEventListener('storage-update', refreshData);
  }, []);

  useEffect(() => {
    // Reset to page 1 when filter changes
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

  const refreshData = () => {
    // Filter out cancelled/archived unless they have payments involved (edge case, usually we ignore)
    const all = bookingRepo.getAll().filter(r => 
        r.status !== BookingStatus.CANCELLED && 
        r.status !== BookingStatus.ARCHIVED &&
        r.status !== BookingStatus.INVITED // Invited usually free, or handled separately
    );
    setReservations(all.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
  };

  // --- STATS ---
  const stats = useMemo(() => {
    const open = reservations.filter(r => !r.financials.isPaid);
    const overdue = open.filter(r => getPaymentStatus(r) === 'OVERDUE');
    const paid = reservations.filter(r => r.financials.isPaid);
    
    // Revenue today
    const todayStr = new Date().toISOString().split('T')[0];
    const revenueToday = paid
        .filter(r => r.financials.paidAt?.startsWith(todayStr))
        .reduce((sum, r) => sum + r.financials.finalTotal, 0);

    return {
        openAmount: open.reduce((sum, r) => sum + (r.financials.finalTotal - r.financials.paid), 0),
        overdueAmount: overdue.reduce((sum, r) => sum + (r.financials.finalTotal - r.financials.paid), 0),
        overdueCount: overdue.length,
        revenueToday
    };
  }, [reservations]);

  // --- ACTIONS ---

  const handleRegisterPayment = () => {
    if (!selectedRes) return;
    
    const updates = {
      financials: {
        ...selectedRes.financials,
        isPaid: true,
        paidAt: new Date().toISOString(),
        paid: selectedRes.financials.finalTotal, // Assume full payment for simplicity
        paymentMethod: paymentMethod
      }
    };
    
    bookingRepo.update(selectedRes.id, r => ({ ...r, ...updates }));
    
    logAuditAction('REGISTER_PAYMENT', 'RESERVATION', selectedRes.id, { 
      description: `Payment of €${selectedRes.financials.finalTotal} registered via ${paymentMethod}` 
    });
    
    undoManager.showSuccess('Betaling succesvol verwerkt');
    setSelectedRes(null);
    refreshData();
  };

  const handleSendReminder = (res: Reservation, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerEmail('BOOKING_PAYMENT_REMINDER', { type: 'RESERVATION', id: res.id, data: res });
    undoManager.showSuccess(`Herinnering verstuurd naar ${res.customer.lastName}`);
  };

  const handleExport = () => {
    const data = filteredList.map(r => ({
        id: r.id,
        datum: r.date,
        klant: formatGuestName(r.customer.firstName, r.customer.lastName),
        bedrag: r.financials.finalTotal.toFixed(2),
        status: r.financials.isPaid ? 'Betaald' : 'Open',
        methode: r.financials.paymentMethod || '-',
        vervaldatum: r.financials.paymentDueAt || '-'
    }));
    const csv = toCSV(data);
    downloadCSV(`betalingen_${activeTab.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  // --- FILTERING & PAGINATION ---
  const filteredList = reservations.filter(r => {
    // Tab Filter
    if (activeTab === 'OPEN' && r.financials.isPaid) return false;
    if (activeTab === 'PAID' && !r.financials.isPaid) return false;

    // Search Filter
    if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return r.customer.lastName.toLowerCase().includes(q) || 
               r.id.toLowerCase().includes(q) ||
               r.financials.finalTotal.toString().includes(q);
    }
    return true;
  });

  const totalPages = Math.ceil(filteredList.length / ITEMS_PER_PAGE);
  const paginatedList = filteredList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-serif text-white">Financiën</h2>
          <p className="text-slate-500 text-sm">Debiteurenbeheer en betaaloverzicht.</p>
        </div>
        <Button variant="secondary" onClick={handleExport} className="flex items-center">
            <Download size={18} className="mr-2" /> Export
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-slate-900 border-slate-800 flex items-center justify-between relative overflow-hidden">
           <div className="relative z-10">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Openstaand Saldo</p>
              <p className="text-3xl font-serif text-white">€{stats.openAmount.toLocaleString('nl-NL', {minimumFractionDigits: 2})}</p>
           </div>
           <div className="p-3 bg-blue-900/20 rounded-full text-blue-500"><Clock size={24}/></div>
        </Card>
        
        <Card className="p-6 bg-slate-900 border-slate-800 flex items-center justify-between relative overflow-hidden">
           {stats.overdueAmount > 0 && <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-full blur-xl -mr-8 -mt-8"></div>}
           <div className="relative z-10">
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Vervallen ({stats.overdueCount})</p>
              <p className="text-3xl font-serif text-white">€{stats.overdueAmount.toLocaleString('nl-NL', {minimumFractionDigits: 2})}</p>
           </div>
           <div className="p-3 bg-red-900/20 rounded-full text-red-500"><AlertCircle size={24}/></div>
        </Card>

        <Card className="p-6 bg-slate-900 border-slate-800 flex items-center justify-between relative overflow-hidden">
           <div className="relative z-10">
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Ontvangen Vandaag</p>
              <p className="text-3xl font-serif text-white">€{stats.revenueToday.toLocaleString('nl-NL', {minimumFractionDigits: 2})}</p>
           </div>
           <div className="p-3 bg-emerald-900/20 rounded-full text-emerald-500"><CheckCircle2 size={24}/></div>
        </Card>
      </div>

      {/* Filters & Tabs */}
      <Card className="p-4 bg-slate-900/50 flex flex-col md:flex-row justify-between items-center gap-4">
         <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button 
                onClick={() => setActiveTab('OPEN')} 
                className={`px-6 py-2 text-xs font-bold uppercase rounded-lg transition-all ${activeTab === 'OPEN' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
            >
                Openstaand
            </button>
            <button 
                onClick={() => setActiveTab('PAID')} 
                className={`px-6 py-2 text-xs font-bold uppercase rounded-lg transition-all ${activeTab === 'PAID' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
            >
                Betaald / Historie
            </button>
         </div>

         <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                placeholder="Zoek op bedrag, naam of nummer..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
         </div>
      </Card>

      {/* Table */}
      <div className="flex-grow flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
         <ResponsiveTable 
            data={paginatedList}
            keyExtractor={r => r.id}
            columns={[
                { 
                    header: 'Datum Show', 
                    accessor: (r: Reservation) => <span className="font-mono text-slate-400 text-xs">{new Date(r.date).toLocaleDateString()}</span> 
                },
                { 
                    header: 'Reservering', 
                    accessor: (r: Reservation) => (
                        <div>
                            <span className="block font-bold text-white text-sm">{formatGuestName(r.customer.firstName, r.customer.lastName)}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{r.id}</span>
                        </div>
                    )
                },
                {
                    header: 'Bedrag',
                    accessor: (r: Reservation) => <span className="font-mono font-bold text-white">€{r.financials.finalTotal.toFixed(2)}</span>
                },
                {
                    header: activeTab === 'OPEN' ? 'Vervaldatum' : 'Betaald Op',
                    accessor: (r: Reservation) => {
                        if (activeTab === 'OPEN') {
                            const status = getPaymentStatus(r);
                            const due = r.financials.paymentDueAt ? new Date(r.financials.paymentDueAt) : null;
                            const color = getPaymentColor(status);
                            return (
                                <div>
                                    <span className={`text-xs font-bold text-${color}-500 uppercase block`}>{status.replace('_', ' ')}</span>
                                    {due && <span className="text-[10px] text-slate-500">{due.toLocaleDateString()}</span>}
                                </div>
                            )
                        } else {
                            return (
                                <div>
                                    <span className="block text-xs text-white">{r.financials.paidAt ? new Date(r.financials.paidAt).toLocaleDateString() : '-'}</span>
                                    <span className="text-[10px] text-slate-500 uppercase">{r.financials.paymentMethod || 'Onbekend'}</span>
                                </div>
                            )
                        }
                    }
                },
                {
                    header: 'Acties',
                    accessor: (r: Reservation) => (
                        <div className="flex justify-end space-x-2">
                           {activeTab === 'OPEN' ? (
                               <>
                                 <Button 
                                    onClick={(e: any) => handleSendReminder(r, e)} 
                                    variant="ghost" 
                                    className="h-8 w-8 p-0 text-slate-500 hover:text-amber-500 hover:bg-amber-900/20"
                                    title="Stuur Herinnering"
                                 >
                                    <Mail size={16} />
                                 </Button>
                                 <Button 
                                    onClick={() => setSelectedRes(r)} 
                                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 border-none"
                                 >
                                    Betaal
                                 </Button>
                               </>
                           ) : (
                               <div className="text-emerald-500 flex items-center text-xs font-bold">
                                   <CheckCircle2 size={16} className="mr-1" /> Voldaan
                               </div>
                           )}
                        </div>
                    )
                }
            ]}
         />
         
         {/* Pagination Controls */}
         {totalPages > 1 && (
            <div className="p-4 border-t border-slate-800 flex justify-between items-center bg-slate-950">
               <span className="text-xs text-slate-500">
                 Pagina {currentPage} van {totalPages}
               </span>
               <div className="flex space-x-2">
                 <button 
                   onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                   disabled={currentPage === 1}
                   className="p-2 rounded hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent text-slate-400"
                 >
                   <ChevronLeft size={16} />
                 </button>
                 <button 
                   onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                   disabled={currentPage === totalPages}
                   className="p-2 rounded hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent text-slate-400"
                 >
                   <ChevronRight size={16} />
                 </button>
               </div>
            </div>
         )}
      </div>

      {/* Payment Modal */}
      {selectedRes && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in">
          <Card className="bg-slate-950 border border-slate-800 w-full max-w-sm p-6 shadow-2xl">
             <h3 className="text-lg font-serif text-white mb-6">Betaling Registreren</h3>
             
             <div className="space-y-4">
               <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                  <p className="text-xs text-slate-500 uppercase font-bold mb-1">Te Betalen</p>
                  <p className="text-3xl font-mono text-white">€{selectedRes.financials.finalTotal.toFixed(2)}</p>
                  <p className="text-xs text-slate-400 mt-2">{formatGuestName(selectedRes.customer.firstName, selectedRes.customer.lastName)}</p>
               </div>

               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Betaalmethode</label>
                 <select 
                   className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500"
                   value={paymentMethod}
                   onChange={(e) => setPaymentMethod(e.target.value)}
                 >
                   <option value="FACTUUR">Op Factuur (Overboeking)</option>
                   <option value="IDEAL">iDeal / Mollie</option>
                   <option value="PIN">Pin (aan de deur)</option>
                   <option value="CASH">Contant</option>
                   <option value="VOUCHER">Voucher Verrekening</option>
                 </select>
               </div>

               <div className="flex gap-3 pt-2">
                 <Button variant="ghost" onClick={() => setSelectedRes(null)} className="flex-1">Annuleren</Button>
                 <Button onClick={handleRegisterPayment} className="flex-1 bg-emerald-600 hover:bg-emerald-700 border-none">
                   Bevestigen
                 </Button>
               </div>
             </div>
          </Card>
        </div>
      )}
    </div>
  );
};
