import React, { useState, useEffect } from 'react';
import {
  Ticket, Search, Filter, CheckCircle2, XCircle,
  Clock, AlertCircle, MoreHorizontal, Mail, Phone,
  Calendar, User, DollarSign, ChevronRight, X, Edit3
} from 'lucide-react';
import { Button, Card, Badge, ResponsiveDrawer, Input } from '../UI';
import { Reservation, BookingStatus, AdminPriceOverride } from '../../types';
import { bookingRepo, tasksRepo, saveData, STORAGE_KEYS } from '../../utils/storage';
import { undoManager } from '../../utils/undoManager';
import { logAuditAction } from '../../utils/auditLogger';
import { triggerEmail } from '../../utils/emailEngine';
import { ResponsiveTable } from '../ResponsiveTable';
import { getPaymentStatus, getPaymentColor } from '../../utils/paymentHelpers';
import { PriceOverridePanel } from './PriceOverridePanel';
import { recalculateReservationFinancials } from '../../utils/pricing';

export const ReservationManager = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  
  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('FACTUUR');

  // Pricing Mode
  const [isEditingPrice, setIsEditingPrice] = useState(false);

  useEffect(() => {
    refreshData();
    window.addEventListener('storage-update', refreshData);
    return () => window.removeEventListener('storage-update', refreshData);
  }, []);

  const refreshData = () => {
    setReservations(bookingRepo.getAll().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  const updateStatus = (id: string, status: BookingStatus) => {
    const original = reservations.find(r => r.id === id);
    if (!original) return;

    let updates: Partial<Reservation> = { status };
    
    // 1. Handle Option Expiry Logic
    if (status === BookingStatus.OPTION && original.status !== BookingStatus.OPTION) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 7);
      updates = { ...updates, optionExpiresAt: expiry.toISOString() };

      const callDate = new Date(expiry);
      callDate.setDate(callDate.getDate() - 1);

      tasksRepo.createAutoTask({
        type: 'CALL_OPTION_EXPIRING',
        title: `Optie verloopt: ${original.customer.lastName}`,
        notes: `Optie verloopt op ${expiry.toLocaleDateString()}. Bel klant om te bevestigen.`,
        dueAt: callDate.toISOString(),
        entityType: 'RESERVATION',
        entityId: id
      });
    }
    
    // Apply Update
    bookingRepo.update(id, (r) => ({ ...r, ...updates }));

    // Register Undo
    undoManager.registerUndo(
      `Status update naar ${status}`,
      'RESERVATION',
      id,
      original
    );

    logAuditAction('UPDATE_STATUS', 'RESERVATION', id, { description: `Status changed to ${status}` });

    // Emails
    const res = bookingRepo.getById(id); // Get fresh state
    if (res) {
      if (status === BookingStatus.CONFIRMED) {
        triggerEmail('BOOKING_CONFIRMED', { type: 'RESERVATION', id, data: res });
      } else if (status === BookingStatus.CANCELLED) {
        triggerEmail('BOOKING_CANCELLED', { type: 'RESERVATION', id, data: res });
      }
    }

    refreshData();
    if (selectedReservation && selectedReservation.id === id) {
       const fresh = bookingRepo.getById(id);
       if (fresh) setSelectedReservation(fresh);
    }
  };

  const handlePayment = () => {
    if (!selectedReservation) return;
    
    const updates = {
      financials: {
        ...selectedReservation.financials,
        isPaid: true,
        paidAt: new Date().toISOString(),
        paid: selectedReservation.financials.finalTotal,
        paymentMethod: paymentMethod
      }
    };
    
    bookingRepo.update(selectedReservation.id, r => ({ ...r, ...updates }));
    refreshData();
    setSelectedReservation({ ...selectedReservation, ...updates });
    setShowPaymentModal(false);
    
    logAuditAction('REGISTER_PAYMENT', 'RESERVATION', selectedReservation.id, { 
      description: `Payment registered via ${paymentMethod}` 
    });
    undoManager.showSuccess('Betaling geregistreerd');
  };

  const sendPaymentReminder = (res: Reservation) => {
    triggerEmail('BOOKING_PAYMENT_REMINDER', { type: 'RESERVATION', id: res.id, data: res });
    undoManager.showSuccess(`Herinnering verstuurd naar ${res.customer.email}`);
  };

  // --- Price Override Logic ---
  const handlePriceSave = (override: AdminPriceOverride | undefined, sendEmail: boolean) => {
    if (!selectedReservation) return;

    const original = { ...selectedReservation };
    let updatedReservation = { ...selectedReservation, adminPriceOverride: override };
    
    // Recalculate totals immediately
    updatedReservation.financials = recalculateReservationFinancials(updatedReservation);

    bookingRepo.update(selectedReservation.id, () => updatedReservation);
    
    logAuditAction('UPDATE_PRICING', 'RESERVATION', selectedReservation.id, {
        description: `Price Override Updated. New Total: €${updatedReservation.financials.finalTotal}`,
        before: original.adminPriceOverride,
        after: override
    });

    if (sendEmail) {
        triggerEmail('BOOKING_CONFIRMED', { type: 'RESERVATION', id: selectedReservation.id, data: updatedReservation });
        undoManager.showSuccess("Wijziging opgeslagen & email verzonden.");
    } else {
        undoManager.showSuccess("Prijs wijziging opgeslagen.");
    }

    setSelectedReservation(updatedReservation);
    setIsEditingPrice(false);
    refreshData();
  };

  const filteredReservations = reservations.filter(r => {
    const matchesStatus = filterStatus === 'ALL' || r.status === filterStatus;
    const matchesSearch =
      r.customer.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.customer.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-serif text-white">Reserveringen</h2>
          <p className="text-slate-500 text-sm">Overzicht van alle boekingen en statussen.</p>
        </div>
      </div>

      <Card className="p-4 bg-slate-900/50 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-grow w-full md:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            placeholder="Zoek op naam, nummer of email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto">
          <select
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="ALL">Alle Statussen</option>
            <option value={BookingStatus.REQUEST}>Aanvragen</option>
            <option value={BookingStatus.OPTION}>Opties</option>
            <option value={BookingStatus.CONFIRMED}>Bevestigd</option>
            <option value={BookingStatus.CANCELLED}>Geannuleerd</option>
            <option value={BookingStatus.WAITLIST}>Wachtlijst</option>
          </select>
        </div>
      </Card>

      <div className="flex-grow">
        <ResponsiveTable
          data={filteredReservations}
          keyExtractor={r => r.id}
          onRowClick={(r) => { setSelectedReservation(r); setIsEditingPrice(false); }}
          columns={[
            { header: 'Datum', accessor: r => <span className="font-mono text-slate-400 text-xs">{new Date(r.date).toLocaleDateString()}</span> },
            { header: 'Klant', accessor: r => (
              <div>
                <span className="font-bold text-white block">{r.customer.lastName}, {r.customer.firstName}</span>
                <span className="text-xs text-slate-500">{r.id}</span>
              </div>
            )},
            { header: 'Gezelschap', accessor: r => <span className="text-slate-300">{r.partySize}p</span> },
            { header: 'Bedrag', accessor: r => {
               const status = getPaymentStatus(r);
               const color = getPaymentColor(status);
               return (
                 <div className="flex flex-col">
                   <span className="font-mono text-xs text-slate-300">€{(r.financials.finalTotal || 0).toFixed(2)}</span>
                   <span className={`text-[9px] font-bold text-${color}-500 uppercase`}>{status.replace('_', ' ')}</span>
                 </div>
               )
            }},
            { header: 'Status', accessor: r => <Badge status={r.status}>{r.status}</Badge> },
            { header: 'Actie', accessor: r => (
                <div className="flex space-x-1" onClick={e => e.stopPropagation()}>
                   {r.status === BookingStatus.REQUEST && (
                     <>
                        <Button variant="secondary" onClick={() => updateStatus(r.id, BookingStatus.OPTION)} className="h-8 px-2 text-xs">Optie</Button>
                        <Button onClick={() => updateStatus(r.id, BookingStatus.CONFIRMED)} className="h-8 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 border-none">OK</Button>
                     </>
                   )}
                   {r.status === BookingStatus.OPTION && (
                     <Button onClick={() => updateStatus(r.id, BookingStatus.CONFIRMED)} className="h-8 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 border-none">Bevestig</Button>
                   )}
                </div>
            )}
          ]}
        />
      </div>

      {/* Detail Drawer */}
      <ResponsiveDrawer
        isOpen={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
        title="Reservering Details"
      >
        {selectedReservation && (
          <div className="space-y-8 pb-12">
             <div className="grid grid-cols-2 gap-4">
               <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                 <p className="text-xs font-bold text-slate-500 uppercase">Klant</p>
                 <p className="font-bold text-white text-lg">{selectedReservation.customer.firstName} {selectedReservation.customer.lastName}</p>
                 <p className="text-sm text-slate-400">{selectedReservation.customer.email}</p>
                 <p className="text-sm text-slate-400">{selectedReservation.customer.phone}</p>
               </div>
               <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                 <p className="text-xs font-bold text-slate-500 uppercase">Boeking</p>
                 <p className="font-mono text-white">{selectedReservation.id}</p>
                 <p className="text-sm text-slate-400">Datum: {new Date(selectedReservation.date).toLocaleDateString()}</p>
                 <p className="text-sm text-slate-400">Aantal: {selectedReservation.partySize} personen</p>
               </div>
             </div>

             {/* Pricing Section */}
             {isEditingPrice ? (
               <PriceOverridePanel 
                 reservation={selectedReservation} 
                 onSave={handlePriceSave} 
                 onCancel={() => setIsEditingPrice(false)} 
               />
             ) : (
               <div className="space-y-4">
                 <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                   <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest">Financieel</h4>
                   <Button variant="ghost" onClick={() => setIsEditingPrice(true)} className="h-6 text-xs px-2 text-slate-400 hover:text-white">
                     <Edit3 size={12} className="mr-1"/> Bewerken
                   </Button>
                 </div>
                 
                 <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-sm text-slate-400">Totaalbedrag</span>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-xl font-mono text-white">€{(selectedReservation.financials.finalTotal || 0).toFixed(2)}</span>
                        {selectedReservation.adminPriceOverride && (
                          <Badge status="OPTION" className="scale-75 origin-left">Aangepast</Badge>
                        )}
                      </div>
                      
                      {selectedReservation.adminPriceOverride && (
                        <div className="text-[10px] text-amber-500 mt-1">
                          Reden: {selectedReservation.adminPriceOverride.reason}
                        </div>
                      )}

                      {selectedReservation.financials.isPaid && (
                         <span className="text-xs text-emerald-500 font-bold mt-1">
                           Betaald via {selectedReservation.financials.paymentMethod || 'Onbekend'}
                         </span>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      {!selectedReservation.financials.isPaid ? (
                        <>
                          <Button 
                            variant="secondary" 
                            className="h-8 text-xs bg-emerald-900/20 text-emerald-500 border-emerald-900"
                            onClick={() => setShowPaymentModal(true)}
                          >
                            Markeer Betaald
                          </Button>
                          <Button variant="ghost" className="h-8 text-xs text-amber-500 hover:text-amber-400" onClick={() => sendPaymentReminder(selectedReservation)}>
                            <Mail size={14} className="mr-1" /> Herinnering
                          </Button>
                        </>
                      ) : (
                          <div className="flex items-center text-emerald-500">
                             <CheckCircle2 size={18} className="mr-2"/> Betaald
                          </div>
                      )}
                    </div>
                 </div>
               </div>
             )}

             <div className="space-y-4">
               <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest border-b border-slate-800 pb-2">Status & Notities</h4>
               <div className="flex gap-2 flex-wrap mb-4">
                 {Object.values(BookingStatus).map(status => (
                   <button
                     key={status}
                     onClick={() => updateStatus(selectedReservation.id, status)}
                     disabled={selectedReservation.status === status}
                     className={`px-3 py-1.5 rounded-lg border text-xs font-bold uppercase transition-all ${
                       selectedReservation.status === status
                         ? 'bg-white text-black border-white'
                         : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-600'
                     }`}
                   >
                     {status}
                   </button>
                 ))}
               </div>

               <div className="grid grid-cols-1 gap-4">
                 {selectedReservation.notes.dietary && (
                   <div className="p-3 bg-amber-900/10 border border-amber-900/30 rounded-lg">
                     <p className="text-xs font-bold text-amber-500 uppercase mb-1">Dieetwensen</p>
                     <p className="text-sm text-amber-100">{selectedReservation.notes.dietary}</p>
                   </div>
                 )}
                 {selectedReservation.notes.isCelebrating && (
                   <div className="p-3 bg-purple-900/10 border border-purple-900/30 rounded-lg">
                     <p className="text-xs font-bold text-purple-500 uppercase mb-1">Viering</p>
                     <p className="text-sm text-purple-100">{selectedReservation.notes.celebrationText}</p>
                   </div>
                 )}
                 <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Interne Notitie</p>
                    <textarea
                      className="w-full bg-transparent text-sm text-slate-300 outline-none resize-none"
                      placeholder="Plaats hier interne notities..."
                      rows={3}
                      defaultValue={selectedReservation.notes.internal}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val !== selectedReservation.notes.internal) {
                           bookingRepo.update(selectedReservation.id, r => ({
                             ...r,
                             notes: { ...r.notes, internal: val }
                           }));
                        }
                      }}
                    />
                 </div>
               </div>
             </div>
          </div>
        )}
      </ResponsiveDrawer>

      {/* Payment Modal */}
      {showPaymentModal && selectedReservation && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <Card className="bg-slate-950 border border-slate-800 w-full max-w-sm p-6 animate-in fade-in zoom-in-95">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white">Betaling Registreren</h3>
                <button onClick={() => setShowPaymentModal(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
             </div>
             
             <div className="space-y-4">
               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Bedrag</label>
                 <p className="text-2xl font-mono text-white">€{selectedReservation.financials.finalTotal.toFixed(2)}</p>
               </div>

               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Betaalmethode</label>
                 <select 
                   className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500"
                   value={paymentMethod}
                   onChange={(e) => setPaymentMethod(e.target.value)}
                 >
                   <option value="FACTUUR">Op Factuur</option>
                   <option value="IDEAL">iDeal / Online</option>
                   <option value="PIN">Pin (aan de deur)</option>
                   <option value="CASH">Contant</option>
                   <option value="VOUCHER">Voucher</option>
                 </select>
               </div>

               <Button onClick={handlePayment} className="w-full bg-emerald-600 hover:bg-emerald-700">
                 Bevestig Betaling
               </Button>
             </div>
          </Card>
        </div>
      )}
    </div>
  );
};