
import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, AlertCircle, CheckCircle2, Clock, 
  Search, Filter, Download, Mail, CreditCard, Calendar,
  ChevronLeft, ChevronRight, PieChart, Printer, Layers
} from 'lucide-react';
import { Button, Card, Badge, Input, ResponsiveDrawer } from '../UI';
import { DestructiveActionModal } from '../UI/DestructiveActionModal';
import { Reservation, BookingStatus, PaymentRecord } from '../../types';
import { bookingRepo, saveData, STORAGE_KEYS } from '../../utils/storage';
import { ResponsiveTable } from '../ResponsiveTable';
import { getPaymentStatus, getPaymentColor } from '../../utils/paymentHelpers';
import { undoManager } from '../../utils/undoManager';
import { logAuditAction } from '../../utils/auditLogger';
import { triggerEmail } from '../../utils/emailEngine';
import { toCSV, downloadCSV } from '../../utils/csvExport';
import { formatGuestName, formatCurrency } from '../../utils/formatters';
import { printInvoice, printBatchInvoices } from '../../utils/invoiceGenerator';

const ITEMS_PER_PAGE = 20;

export const PaymentsManager = () => {
  const [activeTab, setActiveTab] = useState<'OPEN' | 'PAID'>('OPEN');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  
  // Payment Modal
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('FACTUUR');
  const [paymentType, setPaymentType] = useState<'DEPOSIT' | 'FINAL' | 'PARTIAL'>('PARTIAL');

  // Batch Invoice State
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);
  const [batchList, setBatchList] = useState<Reservation[]>([]);

  useEffect(() => {
    refreshData();
    window.addEventListener('storage-update', refreshData);
    return () => window.removeEventListener('storage-update', refreshData);
  }, []);

  useEffect(() => {
    // Reset to page 1 when filter changes
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

  useEffect(() => {
    if (selectedRes) {
        // Default amount is remaining balance
        setPaymentAmount(selectedRes.financials.finalTotal - selectedRes.financials.paid);
    }
  }, [selectedRes]);

  const refreshData = () => {
    // Filter out cancelled/archived unless they have payments involved (edge case, usually we ignore)
    const all = bookingRepo.getAll().filter(r => 
        r.status !== BookingStatus.CANCELLED && 
        r.status !== BookingStatus.ARCHIVED &&
        r.status !== BookingStatus.INVITED
    );
    setReservations(all.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
  };

  // --- STATS ---
  const stats = useMemo(() => {
    const open = reservations.filter(r => !r.financials.isPaid);
    const overdue = open.filter(r => getPaymentStatus(r) === 'OVERDUE');
    
    // Revenue today
    const todayStr = new Date().toISOString().split('T')[0];
    const revenueToday = reservations.reduce((sum, r) => {
        const todaysPayments = r.financials.payments?.filter(p => p.date.startsWith(todayStr)) || [];
        return sum + todaysPayments.reduce((pSum, p) => pSum + p.amount, 0);
    }, 0);

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
    
    const newPayment: PaymentRecord = {
        id: `PAY-${Date.now()}`,
        amount: paymentAmount,
        method: paymentMethod,
        date: new Date().toISOString(),
        type: paymentType
    };

    const currentPayments = selectedRes.financials.payments || [];
    const updatedPayments = [...currentPayments, newPayment];
    const newPaidTotal = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
    const isFullyPaid = newPaidTotal >= selectedRes.financials.finalTotal - 0.01; // Epsilon for floats

    const updates = {
      financials: {
        ...selectedRes.financials,
        payments: updatedPayments,
        paid: newPaidTotal,
        isPaid: isFullyPaid,
        paidAt: isFullyPaid ? new Date().toISOString() : selectedRes.financials.paidAt,
        paymentMethod: isFullyPaid ? paymentMethod : selectedRes.financials.paymentMethod
      }
    };
    
    bookingRepo.update(selectedRes.id, r => ({ ...r, ...updates }));
    
    logAuditAction('REGISTER_PAYMENT', 'RESERVATION', selectedRes.id, { 
      description: `Payment of ${formatCurrency(paymentAmount)} (${paymentType}) via ${paymentMethod}` 
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
        totaal: r.financials.finalTotal.toFixed(2),
        betaald: r.financials.paid.toFixed(2),
        status: r.financials.isPaid ? 'Betaald' : 'Open',
        laatste_betaling: r.financials.payments?.[r.financials.payments.length-1]?.date || '-',
        vervaldatum: r.financials.paymentDueAt || '-'
    }));
    const csv = toCSV(data);
    downloadCSV(`betalingen_${activeTab.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  const handleBatchInvoice = () => {
    // 1. Determine "This Week"
    const now = new Date();
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay() || 7; // Get current day number, converting Sun(0) to 7
    if (day !== 1) startOfWeek.setHours(-24 * (day - 1)); // Adjust backwards to Monday
    startOfWeek.setHours(0,0,0,0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23,59,59,999);

    const startStr = startOfWeek.toISOString().split('T')[0];
    const endStr = endOfWeek.toISOString().split('T')[0];

    // 2. Filter Reservations
    const candidates = reservations.filter(r => 
        r.date >= startStr && 
        r.date <= endStr && 
        r.financials.paymentMethod === 'FACTUUR' // Only explicit invoices usually need printing
    );

    if (candidates.length === 0) {
        undoManager.showError("Geen factuur-boekingen gevonden voor deze week.");
        return;
    }

    setBatchList(candidates);
    setShowBatchConfirm(true);
  };

  const executeBatchInvoice = () => {
    printBatchInvoices(batchList);
    setShowBatchConfirm(false);
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
        <div className="flex space-x-2">
            <Button variant="secondary" onClick={handleBatchInvoice} className="flex items-center">
                <Layers size={18} className="mr-2" /> Batch Facturen
            </Button>
            <Button variant="secondary" onClick={handleExport} className="flex items-center">
                <Download size={18} className="mr-2" /> Export CSV
            </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-slate-900 border-slate-800 flex items-center justify-between relative overflow-hidden">
           <div className="relative z-10">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Openstaand Saldo</p>
              <p className="text-3xl font-serif text-white">{formatCurrency(stats.openAmount)}</p>
           </div>
           <div className="p-3 bg-blue-900/20 rounded-full text-blue-500"><Clock size={24}/></div>
        </Card>
        
        <Card className="p-6 bg-slate-900 border-slate-800 flex items-center justify-between relative overflow-hidden">
           {stats.overdueAmount > 0 && <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-full blur-xl -mr-8 -mt-8"></div>}
           <div className="relative z-10">
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Vervallen ({stats.overdueCount})</p>
              <p className="text-3xl font-serif text-white">{formatCurrency(stats.overdueAmount)}</p>
           </div>
           <div className="p-3 bg-red-900/20 rounded-full text-red-500"><AlertCircle size={24}/></div>
        </Card>

        <Card className="p-6 bg-slate-900 border-slate-800 flex items-center justify-between relative overflow-hidden">
           <div className="relative z-10">
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Ontvangen Vandaag</p>
              <p className="text-3xl font-serif text-white">{formatCurrency(stats.revenueToday)}</p>
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
                    header: 'Saldo',
                    accessor: (r: Reservation) => {
                        const paid = r.financials.paid;
                        const total = r.financials.finalTotal;
                        const pct = Math.min(100, (paid/total)*100);
                        
                        return (
                            <div className="w-32">
                                <div className="flex justify-between text-xs mb-1 font-mono">
                                    <span className="text-emerald-500">{formatCurrency(paid)}</span>
                                    <span className="text-slate-500">/ {formatCurrency(total)}</span>
                                </div>
                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className={`h-full ${paid >= total ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        );
                    }
                },
                {
                    header: activeTab === 'OPEN' ? 'Vervaldatum' : 'Status',
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
                                <Badge status="CONFIRMED">BETAALD</Badge>
                            )
                        }
                    }
                },
                {
                    header: 'Acties',
                    accessor: (r: Reservation) => (
                        <div className="flex justify-end space-x-2">
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
                                {r.financials.isPaid ? 'Details' : 'Betaal'}
                           </Button>
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
          <Card className="bg-slate-950 border border-slate-800 w-full max-w-2xl p-0 shadow-2xl flex flex-col md:flex-row overflow-hidden">
             
             {/* Left: Summary & History */}
             <div className="w-full md:w-1/2 p-6 bg-slate-900 border-r border-slate-800">
                <h3 className="text-lg font-bold text-white mb-4">Betaalhistorie</h3>
                <div className="space-y-4">
                    <div className="p-3 bg-black/30 rounded-xl border border-slate-800">
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Totaalbedrag</span>
                            <span className="text-white font-mono">{formatCurrency(selectedRes.financials.finalTotal)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-emerald-500 mb-1">
                            <span>Reeds voldaan</span>
                            <span className="font-mono">-{formatCurrency(selectedRes.financials.paid)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold text-white border-t border-slate-700 pt-2 mt-2">
                            <span>Openstaand</span>
                            <span className="text-amber-500 font-mono">{formatCurrency(selectedRes.financials.finalTotal - selectedRes.financials.paid)}</span>
                        </div>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Transacties</p>
                        {selectedRes.financials.payments?.map((p, i) => (
                            <div key={i} className="flex justify-between items-center p-2 bg-slate-800/50 rounded text-xs">
                                <div>
                                    <span className="text-white block">{new Date(p.date).toLocaleDateString()}</span>
                                    <span className="text-[10px] text-slate-500">{p.method} ({p.type})</span>
                                </div>
                                <span className="font-mono text-emerald-400">+{formatCurrency(p.amount)}</span>
                            </div>
                        ))}
                        {(!selectedRes.financials.payments || selectedRes.financials.payments.length === 0) && (
                            <p className="text-xs text-slate-600 italic">Nog geen betalingen.</p>
                        )}
                    </div>

                    <Button onClick={() => printInvoice(selectedRes)} variant="secondary" className="w-full text-xs">
                        <Printer size={14} className="mr-2"/> Download Factuur PDF
                    </Button>
                </div>
             </div>

             {/* Right: New Payment Form */}
             <div className="w-full md:w-1/2 p-6 flex flex-col">
                <h3 className="text-lg font-bold text-white mb-6">Betaling Registreren</h3>
                
                <div className="space-y-4 flex-grow">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Bedrag (€)</label>
                        <input 
                            type="number" 
                            className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white text-lg font-mono focus:border-emerald-500 outline-none"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(parseFloat(e.target.value))}
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Methode</label>
                        <select 
                            className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500"
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                        >
                            <option value="FACTUUR">Bankoverschrijving</option>
                            <option value="IDEAL">iDeal / Mollie</option>
                            <option value="PIN">Pin (aan de deur)</option>
                            <option value="CASH">Contant</option>
                            <option value="VOUCHER">Voucher</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Type Betaling</label>
                        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                            {['DEPOSIT', 'PARTIAL', 'FINAL'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => setPaymentType(type as any)}
                                    className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-colors ${paymentType === type ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    {type === 'DEPOSIT' ? 'Aanbet.' : type === 'PARTIAL' ? 'Deel' : 'Restant'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 pt-6 mt-auto">
                    <Button variant="ghost" onClick={() => setSelectedRes(null)} className="flex-1">Sluiten</Button>
                    <Button onClick={handleRegisterPayment} className="flex-1 bg-emerald-600 hover:bg-emerald-700 border-none">
                        Verwerken
                    </Button>
                </div>
             </div>

          </Card>
        </div>
      )}

      {/* Confirmation Modal for Batch Invoice */}
      <DestructiveActionModal
        isOpen={showBatchConfirm}
        onClose={() => setShowBatchConfirm(false)}
        onConfirm={executeBatchInvoice}
        title="Batch Facturen Genereren"
        description={
            <div className="space-y-2">
                <p>Je staat op het punt om <strong>{batchList.length}</strong> facturen te genereren voor deze week.</p>
                <p className="text-sm text-slate-400">Dit opent een PDF in een nieuw venster om af te drukken of op te slaan.</p>
            </div>
        }
        verificationText="CONFIRM"
        requireVerification={false}
        confirmButtonText="Genereren & Printen"
      />

    </div>
  );
};
