
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Ticket, Search, Filter, CheckCircle2, XCircle,
  Clock, AlertCircle, MoreHorizontal, Mail, Phone,
  Calendar, User, DollarSign, ChevronRight, X, Edit3,
  Utensils, PartyPopper, Star, Tag, Wine, ShoppingBag, Music,
  CheckSquare, Square, History, Save, RefreshCw
} from 'lucide-react';
import { Button, Card, Badge, ResponsiveDrawer, Input } from '../UI';
import { Reservation, BookingStatus, AdminPriceOverride } from '../../types';
import { bookingRepo, tasksRepo, saveData, STORAGE_KEYS, calendarRepo, showRepo } from '../../utils/storage';
import { undoManager } from '../../utils/undoManager';
import { logAuditAction } from '../../utils/auditLogger';
import { triggerEmail } from '../../utils/emailEngine';
import { ResponsiveTable } from '../ResponsiveTable';
import { getPaymentStatus, getPaymentColor } from '../../utils/paymentHelpers';
import { PriceOverridePanel } from './PriceOverridePanel';
import { recalculateReservationFinancials } from '../../utils/pricing';
import { AuditTimeline } from './AuditTimeline';

// --- Tag Logic ---

interface ReservationTag {
  label: string;
  icon?: any;
  color: string; // Tailwind color class
  isAuto: boolean;
}

const getReservationTags = (res: Reservation): ReservationTag[] => {
  const tags: ReservationTag[] = [];

  // 1. Automatic Tags based on Booking Data
  
  // Premium Package
  if (res.packageType === 'premium') {
    tags.push({ label: 'PREMIUM', icon: Star, color: 'bg-amber-500 text-black border-amber-600', isAuto: true });
  }

  // Dietary
  if (res.notes?.dietary) {
    tags.push({ label: 'DIEET', icon: Utensils, color: 'bg-red-900/20 text-red-500 border-red-900/50', isAuto: true });
  }

  // Celebration
  if (res.notes?.isCelebrating) {
    tags.push({ label: 'VIERING', icon: PartyPopper, color: 'bg-blue-900/20 text-blue-500 border-blue-900/50', isAuto: true });
  }

  // Merchandise
  if (res.merchandise && res.merchandise.length > 0) {
    tags.push({ label: 'MERCH', icon: ShoppingBag, color: 'bg-purple-900/20 text-purple-500 border-purple-900/50', isAuto: true });
  }

  // Addons (Pre/After)
  const hasPre = res.addons?.some(a => a.id.includes('pre-drink'));
  const hasAfter = res.addons?.some(a => a.id.includes('after-drink'));

  if (hasPre && hasAfter) {
    tags.push({ label: 'FULL PARTY', icon: Wine, color: 'bg-emerald-900/20 text-emerald-500 border-emerald-900/50', isAuto: true });
  } else if (hasPre) {
    tags.push({ label: 'PRE-PARTY', icon: Wine, color: 'bg-emerald-900/20 text-emerald-500 border-emerald-900/50', isAuto: true });
  } else if (hasAfter) {
    tags.push({ label: 'AFTERPARTY', icon: Music, color: 'bg-indigo-900/20 text-indigo-500 border-indigo-900/50', isAuto: true });
  }

  // 2. Manual Tags (From reservation.tags array)
  if (res.tags && res.tags.length > 0) {
    res.tags.forEach(t => {
      // Special visual treatment for specific manual tags
      let color = 'bg-slate-800 text-slate-300 border-slate-700';
      if (t.toLowerCase().includes('mooie plaats')) color = 'bg-pink-900/20 text-pink-400 border-pink-900/50';
      if (t.toLowerCase().includes('vip')) color = 'bg-amber-900/20 text-amber-400 border-amber-900/50';
      
      tags.push({ label: t, color, isAuto: false });
    });
  }

  return tags;
};

// --- Component ---

export const ReservationManager = () => {
  const [searchParams] = useSearchParams();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  
  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState<string>(''); // New Date Filter
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [detailTab, setDetailTab] = useState<'DETAILS' | 'HISTORY'>('DETAILS');
  
  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('FACTUUR');

  // Edit Modes
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editFormData, setEditFormData] = useState<any>(null); // Temp state for editing details

  useEffect(() => {
    refreshData();
    window.addEventListener('storage-update', refreshData);
    
    // Check URL Params for Date Filter
    const dateParam = searchParams.get('date');
    if (dateParam) setFilterDate(dateParam);

    // Deep link open
    const openId = searchParams.get('open');
    if (openId && !selectedReservation) {
        const res = bookingRepo.getById(openId);
        if(res) setSelectedReservation(res);
    }

    return () => window.removeEventListener('storage-update', refreshData);
  }, [searchParams]);

  const refreshData = () => {
    setReservations(bookingRepo.getAll().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  // --- Bulk Selection Logic ---
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  // --- Single Update Logic ---

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

  const deleteReservation = (id: string) => {
    if (!confirm('Weet u zeker dat u deze reservering naar de prullenbak wilt verplaatsen?')) return;
    
    bookingRepo.delete(id); // Calls soft delete now
    undoManager.showSuccess("Reservering verplaatst naar prullenbak.");
    
    setSelectedReservation(null);
    refreshData();
  };

  const toggleManualTag = (tag: string) => {
    if (!selectedReservation) return;
    
    const currentTags = selectedReservation.tags || [];
    let newTags;
    if (currentTags.includes(tag)) {
      newTags = currentTags.filter(t => t !== tag);
    } else {
      newTags = [...currentTags, tag];
    }

    bookingRepo.update(selectedReservation.id, r => ({ ...r, tags: newTags }));
    setSelectedReservation({ ...selectedReservation, tags: newTags });
    refreshData();
  };

  const addCustomTag = (tag: string) => {
    if (!tag || !selectedReservation) return;
    const currentTags = selectedReservation.tags || [];
    if (!currentTags.includes(tag)) {
        const newTags = [...currentTags, tag];
        bookingRepo.update(selectedReservation.id, r => ({ ...r, tags: newTags }));
        setSelectedReservation({ ...selectedReservation, tags: newTags });
        refreshData();
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

  // --- Detail Editing Logic ---
  const handleStartEditDetails = () => {
    if (!selectedReservation) return;
    setEditFormData({
        date: selectedReservation.date,
        startTime: selectedReservation.startTime || '19:30',
        partySize: selectedReservation.partySize,
        packageType: selectedReservation.packageType,
        firstName: selectedReservation.customer.firstName,
        lastName: selectedReservation.customer.lastName,
        email: selectedReservation.customer.email,
        phone: selectedReservation.customer.phone
    });
    setIsEditingDetails(true);
  };

  const handleSaveDetails = () => {
    if (!selectedReservation || !editFormData) return;

    // Create updated object
    let updatedReservation = {
        ...selectedReservation,
        date: editFormData.date,
        startTime: editFormData.startTime,
        partySize: parseInt(editFormData.partySize),
        packageType: editFormData.packageType,
        customer: {
            ...selectedReservation.customer,
            firstName: editFormData.firstName,
            lastName: editFormData.lastName,
            email: editFormData.email,
            phone: editFormData.phone
        }
    };

    // Recalculate price because PartySize or Package might have changed
    updatedReservation.financials = recalculateReservationFinancials(updatedReservation);

    // Save
    bookingRepo.update(selectedReservation.id, () => updatedReservation);
    
    logAuditAction('UPDATE_DETAILS', 'RESERVATION', selectedReservation.id, {
        description: 'Updated booking details (pax/date/package)',
        before: selectedReservation,
        after: updatedReservation
    });

    undoManager.showSuccess("Gegevens bijgewerkt en prijs herberekend.");
    setSelectedReservation(updatedReservation);
    setIsEditingDetails(false);
    refreshData();
  };

  const filteredReservations = reservations.filter(r => {
    const matchesStatus = filterStatus === 'ALL' || r.status === filterStatus;
    const matchesSearch =
      r.customer.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.customer.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = !filterDate || r.date === filterDate;

    return matchesStatus && matchesSearch && matchesDate;
  });

  return (
    <div className="h-full flex flex-col space-y-6 relative">
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
          <div className="relative">
             <input 
               type="date" 
               className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500 h-9"
               value={filterDate}
               onChange={(e) => setFilterDate(e.target.value)}
             />
             {filterDate && (
               <button 
                 onClick={() => setFilterDate('')}
                 className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
               >
                 <X size={12} />
               </button>
             )}
          </div>

          <select
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500 h-9"
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

      <div className="flex-grow pb-16">
        <ResponsiveTable
          data={filteredReservations}
          keyExtractor={(r: Reservation) => r.id}
          onRowClick={(r) => { setSelectedReservation(r); setIsEditingPrice(false); setIsEditingDetails(false); setDetailTab('DETAILS'); }}
          columns={[
            { 
              header: '', 
              className: 'w-10',
              accessor: (r: Reservation) => (
                <div onClick={(e) => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.has(r.id)}
                    onChange={() => toggleSelection(r.id)}
                    className="rounded bg-slate-800 border-slate-600 checked:bg-amber-500 w-4 h-4 cursor-pointer"
                  />
                </div>
              )
            },
            { header: 'Datum', accessor: (r: Reservation) => <span className="font-mono text-slate-400 text-xs">{new Date(r.date).toLocaleDateString()}</span> },
            { header: 'Klant', accessor: (r: Reservation) => (
              <div>
                <span className="font-bold text-white block">{r.customer.lastName}, {r.customer.firstName}</span>
                <span className="text-xs text-slate-500">{r.id}</span>
              </div>
            )},
            { header: 'Gezelschap', accessor: (r: Reservation) => <span className="text-slate-300">{r.partySize}p</span> },
            { header: 'Tags & Info', accessor: (r: Reservation) => {
               const tags = getReservationTags(r);
               return (
                 <div className="flex flex-wrap gap-1">
                   {tags.map((t, idx) => (
                     <span key={idx} className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase flex items-center ${t.color}`}>
                       {t.icon && <t.icon size={10} className="mr-1" />}
                       {t.label}
                     </span>
                   ))}
                   {tags.length === 0 && <span className="text-slate-600 text-[10px]">-</span>}
                 </div>
               );
            }},
            { header: 'Bedrag', accessor: (r: Reservation) => {
               const status = getPaymentStatus(r);
               const color = getPaymentColor(status);
               return (
                 <div className="flex flex-col">
                   <span className="font-mono text-xs text-slate-300">€{(r.financials.finalTotal || 0).toFixed(2)}</span>
                   <span className={`text-[9px] font-bold text-${color}-500 uppercase`}>{status.replace('_', ' ')}</span>
                 </div>
               )
            }},
            { header: 'Status', accessor: (r: Reservation) => <Badge status={r.status}>{r.status}</Badge> },
            { header: 'Actie', accessor: (r: Reservation) => (
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
          <div className="space-y-6 pb-12">
             
             {/* Tabs */}
             <div className="flex border-b border-slate-800 mb-4">
                <button 
                  onClick={() => setDetailTab('DETAILS')}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${detailTab === 'DETAILS' ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                  Details
                </button>
                <button 
                  onClick={() => setDetailTab('HISTORY')}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${detailTab === 'HISTORY' ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                  Geschiedenis
                </button>
             </div>

             {detailTab === 'HISTORY' && (
               <div className="space-y-6 animate-in fade-in">
                 <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                   <History size={14} className="mr-2"/> Tijdlijn Activiteit
                 </h4>
                 <AuditTimeline entityId={selectedReservation.id} />
               </div>
             )}

             {detailTab === 'DETAILS' && (
               <div className="space-y-8 animate-in fade-in">
                 
                 {/* EDIT FORM */}
                 {isEditingDetails ? (
                    <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4 animate-in fade-in">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-bold text-white flex items-center"><Edit3 size={14} className="mr-2"/> Gegevens Bewerken</h4>
                            <button onClick={() => setIsEditingDetails(false)}><X size={16} className="text-slate-500 hover:text-white"/></button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Datum (YYYY-MM-DD)" type="date" value={editFormData.date} onChange={(e: any) => setEditFormData({...editFormData, date: e.target.value})} />
                            <Input label="Tijd" type="time" value={editFormData.startTime} onChange={(e: any) => setEditFormData({...editFormData, startTime: e.target.value})} />
                            <Input label="Personen" type="number" value={editFormData.partySize} onChange={(e: any) => setEditFormData({...editFormData, partySize: e.target.value})} />
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Arrangement</label>
                                <select 
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500"
                                    value={editFormData.packageType}
                                    onChange={(e) => setEditFormData({...editFormData, packageType: e.target.value})}
                                >
                                    <option value="standard">Standard</option>
                                    <option value="premium">Premium</option>
                                </select>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-4">
                            <Input label="Voornaam" value={editFormData.firstName} onChange={(e: any) => setEditFormData({...editFormData, firstName: e.target.value})} />
                            <Input label="Achternaam" value={editFormData.lastName} onChange={(e: any) => setEditFormData({...editFormData, lastName: e.target.value})} />
                            <Input label="Email" value={editFormData.email} onChange={(e: any) => setEditFormData({...editFormData, email: e.target.value})} />
                            <Input label="Telefoon" value={editFormData.phone} onChange={(e: any) => setEditFormData({...editFormData, phone: e.target.value})} />
                        </div>
                        <div className="flex justify-end pt-2">
                            <Button onClick={handleSaveDetails} className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs">Opslaan & Herberekenen</Button>
                        </div>
                    </div>
                 ) : (
                    <div className="grid grid-cols-2 gap-4 relative group">
                        <Button 
                            variant="secondary" 
                            onClick={handleStartEditDetails} 
                            className="absolute top-2 right-2 h-7 w-7 p-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Bewerk Gegevens"
                        >
                            <Edit3 size={12}/>
                        </Button>
                        
                        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                            <p className="text-xs font-bold text-slate-500 uppercase">Klant</p>
                            <p className="font-bold text-white text-lg">{selectedReservation.customer.salutation} {selectedReservation.customer.firstName} {selectedReservation.customer.lastName}</p>
                            <p className="text-sm text-slate-400">{selectedReservation.customer.email}</p>
                            <p className="text-sm text-slate-400">{selectedReservation.customer.phone}</p>
                            {selectedReservation.customer.companyName && <p className="text-xs text-amber-500 font-bold mt-1">{selectedReservation.customer.companyName}</p>}
                        </div>
                        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                            <p className="text-xs font-bold text-slate-500 uppercase">Boeking</p>
                            <p className="font-mono text-white">{selectedReservation.id}</p>
                            <p className="text-sm text-slate-400">Datum: {new Date(selectedReservation.date).toLocaleDateString()}</p>
                            <p className="text-sm text-slate-400">Tijd: {selectedReservation.startTime || '19:30'}</p>
                            <p className="text-sm text-slate-400">Gasten: <span className="text-white font-bold">{selectedReservation.partySize}</span></p>
                            <p className="text-sm text-slate-400">Arrangement: <span className="text-white capitalize">{selectedReservation.packageType}</span></p>
                        </div>
                    </div>
                 )}

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
                         <Edit3 size={12} className="mr-1"/> Prijs Aanpassen
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
                              <Button variant="ghost" className="h-8 text-xs text-amber-500 hover:text-amber-400" onClick={() => triggerEmail('BOOKING_PAYMENT_REMINDER', { type: 'RESERVATION', id: selectedReservation.id, data: selectedReservation })}>
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

                     {/* Receipt Breakdown */}
                     {selectedReservation.financials.priceBreakdown && selectedReservation.financials.priceBreakdown.length > 0 && (
                       <div className="bg-slate-950 p-4 rounded border border-slate-800">
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Rekening Specificatie</h4>
                          <div className="space-y-2">
                            {selectedReservation.financials.priceBreakdown.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-xs text-slate-300">
                                 <span className="flex-grow">{item.quantity}x {item.label}</span>
                                 <span className="font-mono">€{item.total.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="border-t border-slate-800 mt-3 pt-2 flex justify-between font-bold text-white text-sm">
                             <span>Totaal</span>
                             <span className="font-mono">€{selectedReservation.financials.finalTotal.toFixed(2)}</span>
                          </div>
                       </div>
                     )}
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
                       <div className="p-3 bg-red-900/10 border border-red-900/30 rounded-lg">
                         <p className="text-xs font-bold text-red-500 uppercase mb-1 flex items-center"><Utensils size={12} className="mr-1"/> Dieetwensen</p>
                         <p className="text-sm text-red-100">{selectedReservation.notes.dietary}</p>
                       </div>
                     )}
                     {selectedReservation.notes.isCelebrating && (
                       <div className="p-3 bg-blue-900/10 border border-blue-900/30 rounded-lg">
                         <p className="text-xs font-bold text-blue-500 uppercase mb-1 flex items-center"><PartyPopper size={12} className="mr-1"/> Viering</p>
                         <p className="text-sm text-blue-100">{selectedReservation.notes.celebrationText}</p>
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

                 {/* Delete Action */}
                 <div className="pt-4 border-t border-slate-800">
                    <Button 
                      variant="ghost" 
                      onClick={() => deleteReservation(selectedReservation.id)} 
                      className="w-full text-red-500 hover:bg-red-900/20 hover:text-red-400"
                    >
                      <XCircle size={16} className="mr-2" /> Verplaats naar Prullenbak
                    </Button>
                 </div>
               </div>
             )}
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
