
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Ticket, Search, Filter, CheckCircle2, XCircle,
  Clock, AlertCircle, Calendar, User, Users, DollarSign, 
  Edit3, Utensils, PartyPopper, Star, Tag, 
  Trash2, Phone, Mail, MoreHorizontal, LayoutGrid, List, PieChart,
  ChevronLeft, ChevronRight, X, BarChart3
} from 'lucide-react';
import { Button, Card, Badge, ResponsiveDrawer, Input } from '../UI';
import { Reservation, BookingStatus, AdminPriceOverride, CalendarEvent } from '../../types';
import { bookingRepo, tasksRepo, saveData, STORAGE_KEYS, calendarRepo, showRepo } from '../../utils/storage';
import { undoManager } from '../../utils/undoManager';
import { logAuditAction } from '../../utils/auditLogger';
import { triggerEmail } from '../../utils/emailEngine';
import { ResponsiveTable } from '../ResponsiveTable';
import { getPaymentStatus, getPaymentColor } from '../../utils/paymentHelpers';
import { PriceOverridePanel } from './PriceOverridePanel';
import { recalculateReservationFinancials } from '../../utils/pricing';
import { AuditTimeline } from './AuditTimeline';
import { EditReservationModal } from './EditReservationModal';
import { DestructiveActionModal } from '../UI/DestructiveActionModal';

// --- TYPES ---

type ViewTab = 'OPERATIONS' | 'ATTENTION' | 'PLANNING' | 'ARCHIVE';
type QuickFilter = 'ALL' | 'UNPAID' | 'VIP' | 'LARGE_GROUP';

const PAGE_SIZE = 24; // Items per page for Grid View

// --- SUB-COMPONENTS ---

const ReservationCard: React.FC<{ reservation: Reservation; onClick: () => void }> = ({ reservation, onClick }) => {
  const isPaid = reservation.financials.isPaid;
  const paidAmount = reservation.financials.paid || 0;
  const totalAmount = reservation.financials.finalTotal || 0;
  const isPartial = !isPaid && paidAmount > 0;
  
  const hasNotes = reservation.notes.dietary || reservation.notes.internal;
  const isPremium = reservation.packageType === 'premium';
  
  // Status Color Logic
  let borderColor = 'border-slate-800';
  let glow = '';
  
  if (reservation.status === 'CONFIRMED' && isPaid) {
    borderColor = 'border-emerald-900/50';
    glow = 'hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]';
  } else if (!isPaid && reservation.status !== 'CANCELLED') {
    borderColor = isPartial ? 'border-orange-500/50' : 'border-red-900/50';
  }
  
  if (hasNotes) borderColor = 'border-red-900/50'; // Notes take priority visually

  return (
    <div 
      onClick={onClick}
      className={`
        relative bg-slate-900 border ${borderColor} rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02] hover:bg-slate-800 ${glow}
        flex flex-col justify-between min-h-[180px]
      `}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <span className="font-mono text-xs text-slate-500">{reservation.startTime || '19:30'}</span>
        <Badge status={reservation.status} className="scale-90 origin-top-right">{reservation.status}</Badge>
      </div>

      {/* Main Info */}
      <div>
        <h3 className="text-white font-bold text-lg leading-tight mb-1 truncate">
          {reservation.customer.lastName}
        </h3>
        <p className="text-slate-400 text-xs truncate">
          {reservation.customer.firstName} • {reservation.id}
        </p>
      </div>

      {/* Pax & Tags */}
      <div className="flex items-center gap-2 mt-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold text-lg">
          {reservation.partySize}
        </div>
        <div className="flex flex-wrap gap-1">
          {isPremium && <span className="p-1.5 bg-amber-900/20 text-amber-500 rounded border border-amber-900/30" title="Premium"><Star size={12} fill="currentColor"/></span>}
          {reservation.notes.dietary && <span className="p-1.5 bg-red-900/20 text-red-500 rounded border border-red-900/30" title="Dieet"><Utensils size={12}/></span>}
          {reservation.notes.isCelebrating && <span className="p-1.5 bg-blue-900/20 text-blue-500 rounded border border-blue-900/30" title="Viering"><PartyPopper size={12}/></span>}
        </div>
      </div>

      {/* Footer Status */}
      <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
        {isPaid ? (
          <span className="text-emerald-500 flex items-center font-bold"><CheckCircle2 size={12} className="mr-1"/> Betaald</span>
        ) : isPartial ? (
          <span className="text-orange-500 flex items-center font-bold"><PieChart size={12} className="mr-1"/> Rest: €{(totalAmount - paidAmount).toFixed(0)}</span>
        ) : (
          <span className="text-red-500 flex items-center font-bold"><DollarSign size={12} className="mr-1"/> €{totalAmount.toFixed(0)} Open</span>
        )}
        <span className="text-slate-500 font-mono">{new Date(reservation.date).toLocaleDateString('nl-NL', {day: 'numeric', month:'short'})}</span>
      </div>
    </div>
  );
};

export const ReservationManager = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Workflow State
  const [activeTab, setActiveTab] = useState<ViewTab>('OPERATIONS');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('');
  
  // Pagination State (Grid View Only)
  const [currentPage, setCurrentPage] = useState(1);

  // Selection & Modals
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [detailTab, setDetailTab] = useState<'DETAILS' | 'HISTORY'>('DETAILS');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showFullEditModal, setShowFullEditModal] = useState(false);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Payment Logic State
  const [paymentMethod, setPaymentMethod] = useState('FACTUUR');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  // --- DATA LOADING ---
  useEffect(() => {
    const load = () => {
        // Fetch ALL data including archives, so we can filter locally for the 'Archive' tab
        let data = bookingRepo.getAll(true);
        // Deep Link Check
        const openId = searchParams.get('open');
        const dateQuery = searchParams.get('date');
        
        if (openId && !selectedReservation) {
            const match = data.find(r => r.id === openId);
            if (match) setSelectedReservation(match);
        }
        
        if (dateQuery) {
            setSelectedDateFilter(dateQuery);
        }

        setReservations(data);
        setAllEvents(calendarRepo.getAll());
    };
    load();
    window.addEventListener('storage-update', load);
    return () => window.removeEventListener('storage-update', load);
  }, [refreshTrigger, searchParams]);

  // Init Payment Amount when modal opens
  useEffect(() => {
    if (selectedReservation && showPaymentModal) {
      const remaining = selectedReservation.financials.finalTotal - (selectedReservation.financials.paid || 0);
      setPaymentAmount(remaining > 0 ? remaining : 0);
    }
  }, [selectedReservation, showPaymentModal]);

  const refreshData = () => setRefreshTrigger(p => p + 1);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, quickFilter, searchTerm, selectedDateFilter]);

  // --- FILTER LOGIC ---
  const filteredData = useMemo<Reservation[]>(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // 1. Tab & Date Filtering
    let result = reservations.filter(r => {
      
      // If Date Filter is set, it overrides tabs
      if (selectedDateFilter) {
          if (r.date !== selectedDateFilter) return false;
          // In specific date view, we show EVERYTHING for that date except deleted/cancelled/archived unless explicitly asked?
          // Let's hide CANCELLED/ARCHIVED by default unless searched for
          if (r.status === 'CANCELLED' || r.status === 'ARCHIVED') return false; 
          return true;
      }

      // Archive is special: Cancelled OR Past dates (completed)
      if (activeTab === 'ARCHIVE') {
        return r.status === 'ARCHIVED'; 
      }

      // Base exclusions for active tabs
      if (r.status === 'CANCELLED' || r.status === 'ARCHIVED') return false;

      switch (activeTab) {
        case 'OPERATIONS':
          // Today & Tomorrow
          return r.date === todayStr || r.date === tomorrowStr;
        
        case 'ATTENTION':
          // Logic: Overdue payment OR Option Expiring OR Request waiting
          const paymentStatus = getPaymentStatus(r);
          const isOverdue = paymentStatus === 'OVERDUE' || paymentStatus === 'DUE_SOON';
          const isRequest = r.status === 'REQUEST';
          const isExpiringOption = r.status === 'OPTION' && r.optionExpiresAt && r.optionExpiresAt <= tomorrowStr;
          return isOverdue || isRequest || isExpiringOption;

        case 'PLANNING':
          // Future dates (after tomorrow)
          return r.date > tomorrowStr;
          
        default: return true;
      }
    });

    // 2. Quick Filters
    if (quickFilter === 'UNPAID') result = result.filter(r => !r.financials.isPaid);
    if (quickFilter === 'VIP') result = result.filter(r => r.packageType === 'premium' || r.tags?.includes('VIP'));
    if (quickFilter === 'LARGE_GROUP') result = result.filter(r => r.partySize >= 8);

    // 3. Search
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(r => 
        r.customer.lastName.toLowerCase().includes(q) ||
        r.customer.email.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    }

    // 4. Sort
    return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [reservations, activeTab, quickFilter, searchTerm, selectedDateFilter]);

  // --- CAPACITY STATS FOR SELECTED DATE ---
  const dateCapacityStats = useMemo(() => {
      if (!selectedDateFilter) return null;
      
      const event = allEvents.find(e => e.date === selectedDateFilter && e.type === 'SHOW');
      if (!event) return null;

      // Calculate strictly from reservations
      const relevant = reservations.filter(r => 
          r.date === selectedDateFilter &&
          r.status !== 'CANCELLED' && 
          r.status !== 'ARCHIVED' && 
          r.status !== 'NOSHOW' &&
          r.status !== 'WAITLIST'
      );

      const activePax = relevant.filter(r => r.status === 'CONFIRMED' || r.status === 'ARRIVED' || r.status === 'OPTION').reduce((s,r) => s + r.partySize, 0);
      const pendingPax = relevant.filter(r => r.status === 'REQUEST').reduce((s,r) => s + r.partySize, 0);
      
      const totalBooked = activePax + pendingPax;
      const capacity = (event as any).capacity || 230;
      const percentage = Math.min(100, (totalBooked / capacity) * 100);

      return {
          capacity,
          totalBooked,
          activePax,
          pendingPax,
          percentage
      };
  }, [selectedDateFilter, reservations, allEvents]);

  // --- PAGINATION LOGIC (Grid Only) ---
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredData.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);


  // --- ACTIONS ---
  const updateStatus = (id: string, status: BookingStatus) => {
    const original = reservations.find(r => r.id === id);
    if (!original) return;

    let updates: Partial<Reservation> = { status };
    if (status === BookingStatus.OPTION && !original.optionExpiresAt) {
       const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
       updates.optionExpiresAt = nextWeek.toISOString();
    }

    bookingRepo.update(id, r => ({ ...r, ...updates }));
    logAuditAction('UPDATE_STATUS', 'RESERVATION', id, { description: `Status changed to ${status}` });
    
    // Trigger emails logic...
    if (status === 'CONFIRMED') triggerEmail('BOOKING_CONFIRMED', { type: 'RESERVATION', id, data: { ...original, status } });
    
    refreshData();
  };

  const handlePayment = () => {
    if (!selectedReservation || paymentAmount <= 0) return;

    const currentPaid = selectedReservation.financials.paid || 0;
    const newTotalPaid = currentPaid + paymentAmount;
    const totalCost = selectedReservation.financials.finalTotal;
    
    // Check if fully paid (allow small float error margin)
    const isFullyPaid = newTotalPaid >= (totalCost - 0.01);

    const updates = {
      financials: {
        ...selectedReservation.financials,
        isPaid: isFullyPaid,
        paidAt: new Date().toISOString(), // Updates last payment date
        paid: newTotalPaid,
        paymentMethod
      }
    };

    bookingRepo.update(selectedReservation.id, r => ({ ...r, ...updates }));
    
    logAuditAction('REGISTER_PAYMENT', 'RESERVATION', selectedReservation.id, { 
      description: `Payment of €${paymentAmount.toFixed(2)} registered via ${paymentMethod}. New Total Paid: €${newTotalPaid.toFixed(2)}` 
    });
    
    undoManager.showSuccess(isFullyPaid ? 'Volledige betaling geregistreerd' : 'Deelbetaling geregistreerd');
    setShowPaymentModal(false);
    refreshData();
  };

  const handlePriceSave = (override: AdminPriceOverride | undefined, sendEmail: boolean) => {
    if (!selectedReservation) return;
    let updated = { ...selectedReservation, adminPriceOverride: override };
    updated.financials = recalculateReservationFinancials(updated);
    bookingRepo.update(selectedReservation.id, () => updated);
    
    if (sendEmail) triggerEmail('BOOKING_CONFIRMED', { type: 'RESERVATION', id: selectedReservation.id, data: updated });
    
    setIsEditingPrice(false);
    refreshData();
  };

  const executeDelete = () => {
    if (!selectedReservation) return;
    bookingRepo.delete(selectedReservation.id);
    setSelectedReservation(null);
    setShowDeleteModal(false);
    refreshData();
    undoManager.showSuccess('Item verplaatst naar prullenbak');
  };

  // --- RENDER HELPERS ---

  const renderQuickFilter = (id: QuickFilter, label: string, icon: any) => (
    <button
      onClick={() => setQuickFilter(quickFilter === id ? 'ALL' : id)}
      className={`
        px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center
        ${quickFilter === id 
          ? 'bg-amber-500 border-amber-500 text-black' 
          : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}
      `}
    >
      {icon} <span className="ml-2">{label}</span>
    </button>
  );

  return (
    <div className="h-full flex flex-col space-y-6 relative">
      
      {/* HEADER & TABS */}
      <div>
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-3xl font-serif text-white">Reserveringen</h2>
            <p className="text-slate-500 text-sm">Control Center</p>
          </div>
          <div className="flex space-x-4">
             {/* Quick Filters */}
             <div className="flex space-x-2">
                {renderQuickFilter('UNPAID', 'Niet Betaald', <AlertCircle size={14}/>)}
                {renderQuickFilter('VIP', 'VIP / Premium', <Star size={14}/>)}
                {renderQuickFilter('LARGE_GROUP', 'Groep > 8', <Users size={14}/>)}
             </div>
          </div>
        </div>

        {/* Workflow Tabs & Date Picker */}
        <div className="flex flex-col md:flex-row md:items-center border-b border-slate-800 gap-4 md:gap-0">
           <div className="flex space-x-1 flex-grow overflow-x-auto">
             {[
               { id: 'OPERATIONS', label: 'Vandaag & Morgen', icon: Clock },
               { id: 'ATTENTION', label: 'Actie Vereist', icon: AlertCircle },
               { id: 'PLANNING', label: 'Toekomst', icon: Calendar },
               { id: 'ARCHIVE', label: 'Archief', icon: CheckCircle2 },
             ].map(tab => (
               <button
                 key={tab.id}
                 onClick={() => { setActiveTab(tab.id as ViewTab); setSelectedDateFilter(''); }}
                 className={`
                   flex items-center px-6 py-3 border-b-2 font-bold text-sm transition-colors whitespace-nowrap
                   ${activeTab === tab.id && !selectedDateFilter 
                     ? 'border-amber-500 text-white' 
                     : 'border-transparent text-slate-500 hover:text-slate-300'}
                 `}
               >
                 <tab.icon size={16} className="mr-2"/> {tab.label}
               </button>
             ))}
           </div>

           {/* Date Filter */}
           <div className="flex items-center space-x-2 pb-2 md:pb-0 md:border-b-2 md:border-transparent">
              <div className={`flex items-center bg-slate-900 border ${selectedDateFilter ? 'border-amber-500' : 'border-slate-700'} rounded-lg px-2 py-1`}>
                 <Calendar size={16} className={selectedDateFilter ? 'text-amber-500' : 'text-slate-500'} />
                 <input 
                   type="date"
                   value={selectedDateFilter}
                   onChange={(e) => setSelectedDateFilter(e.target.value)}
                   className="bg-transparent border-none text-xs text-white focus:ring-0 w-28 ml-2"
                 />
                 {selectedDateFilter && (
                   <button onClick={() => setSelectedDateFilter('')} className="ml-2 text-slate-500 hover:text-white"><X size={14}/></button>
                 )}
              </div>
           </div>
        </div>
      </div>

      {/* CAPACITY BAR (If Date Selected) */}
      {selectedDateFilter && dateCapacityStats && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
             <div className="flex justify-between items-end mb-2">
                <div>
                   <h3 className="text-white font-bold text-sm flex items-center">
                     <BarChart3 size={16} className="mr-2 text-amber-500"/>
                     Capaciteit {new Date(selectedDateFilter).toLocaleDateString()}
                   </h3>
                   <div className="flex space-x-3 text-xs mt-1 text-slate-400">
                      <span>Actief: <strong className="text-white">{dateCapacityStats.activePax}</strong></span>
                      <span>Pending: <strong className="text-blue-400">{dateCapacityStats.pendingPax}</strong></span>
                   </div>
                </div>
                <div className="text-right">
                   <span className={`text-xl font-black ${dateCapacityStats.percentage > 100 ? 'text-red-500' : dateCapacityStats.percentage > 90 ? 'text-amber-500' : 'text-emerald-500'}`}>
                     {dateCapacityStats.totalBooked} <span className="text-sm text-slate-500 font-normal">/ {dateCapacityStats.capacity}</span>
                   </span>
                </div>
             </div>
             <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 flex">
                {/* Active Segment */}
                <div 
                  className="h-full bg-emerald-600" 
                  style={{ width: `${Math.min(100, (dateCapacityStats.activePax / dateCapacityStats.capacity) * 100)}%` }}
                />
                {/* Pending Segment */}
                <div 
                  className="h-full bg-blue-600/60" 
                  style={{ width: `${Math.min(100, (dateCapacityStats.pendingPax / dateCapacityStats.capacity) * 100)}%` }}
                />
             </div>
          </div>
      )}

      {/* SEARCH BAR (Contextual) */}
      <Card className="p-3 bg-slate-900/50 border-slate-800 flex items-center">
         <Search className="text-slate-500 ml-2" size={18}/>
         <input 
           className="bg-transparent border-none focus:ring-0 text-white w-full ml-3 placeholder:text-slate-600"
           placeholder={`Zoek in ${selectedDateFilter ? 'geselecteerde datum' : activeTab.toLowerCase()}...`}
           value={searchTerm}
           onChange={e => setSearchTerm(e.target.value)}
         />
      </Card>

      {/* CONTENT AREA */}
      <div className="flex-grow pb-20">
         
         {/* CARD VIEW (For Operations) */}
         {activeTab === 'OPERATIONS' && !selectedDateFilter && (
           <div className="flex flex-col space-y-4 h-full">
             
             {/* Cards Grid */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in">
                {paginatedData.length === 0 && (
                  <div className="col-span-full text-center p-12 border-2 border-dashed border-slate-800 rounded-xl text-slate-500">
                    Geen boekingen gevonden.
                  </div>
                )}
                {paginatedData.map(res => (
                  <ReservationCard 
                    key={res.id} 
                    reservation={res} 
                    onClick={() => setSelectedReservation(res)} 
                  />
                ))}
             </div>

             {/* Pagination Control (Only for Grid) */}
             {totalPages > 1 && (
               <div className="flex justify-center items-center space-x-4 pt-4 border-t border-slate-800">
                 <Button 
                   variant="ghost" 
                   onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                   disabled={currentPage === 1}
                   className="text-xs"
                 >
                   <ChevronLeft size={16} className="mr-1" /> Vorige
                 </Button>
                 <span className="text-xs text-slate-400 font-bold">
                   Pagina {currentPage} van {totalPages}
                 </span>
                 <Button 
                   variant="ghost" 
                   onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                   disabled={currentPage === totalPages}
                   className="text-xs"
                 >
                   Volgende <ChevronRight size={16} className="ml-1" />
                 </Button>
               </div>
             )}
           </div>
         )}

         {/* TABLE VIEW (For Lists) - Now Virtualized via ResponsiveTable */}
         {(activeTab !== 'OPERATIONS' || selectedDateFilter) && (
           <div className="animate-in fade-in h-full">
             <ResponsiveTable<Reservation>
               data={filteredData}
               keyExtractor={r => r.id}
               onRowClick={setSelectedReservation}
               isVirtual={true} // ENABLE VIRTUALIZATION
               virtualHeight="calc(100vh - 300px)" // Adjust based on header height
               columns={[
                 { header: 'Datum', accessor: r => <span className={`font-mono ${r.status === 'ARCHIVED' ? 'text-slate-500' : 'text-slate-300'}`}>{new Date(r.date).toLocaleDateString()}</span> },
                 { header: 'Naam', accessor: r => <span className={`font-bold ${r.status === 'ARCHIVED' ? 'text-slate-400' : 'text-white'}`}>{r.customer.lastName}, {r.customer.firstName}</span> },
                 { header: 'Pax', accessor: r => r.partySize },
                 { header: 'Status', accessor: r => <Badge status={r.status}>{r.status}</Badge> },
                 { header: 'Betaling', accessor: r => {
                    const status = getPaymentStatus(r);
                    if (status === 'OVERDUE') return <span className="text-red-500 font-bold text-xs uppercase">Te Laat</span>;
                    if (status === 'PARTIAL') return <span className="text-orange-500 font-bold text-xs uppercase">Deelbetaald</span>;
                    if (status === 'PAID') return <span className="text-emerald-500 font-bold text-xs uppercase">Voldaan</span>;
                    if (r.status === 'REQUEST') return <span className="text-blue-500 font-bold text-xs uppercase">Nieuw</span>;
                    if (r.status === 'ARCHIVED') return <span className="text-slate-600 font-bold text-xs uppercase">Archief</span>;
                    return <span className="text-slate-600">Open</span>;
                 }}
               ]}
             />
           </div>
         )}
      </div>

      {/* DETAIL DRAWER */}
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
               <AuditTimeline entityId={selectedReservation.id} />
             )}

             {detailTab === 'DETAILS' && (
               <div className="space-y-8 animate-in fade-in">
                 
                 {/* HERO */}
                 <div className="grid grid-cols-2 gap-4 relative group">
                      <Button 
                          variant="secondary" 
                          onClick={() => setShowFullEditModal(true)} 
                          className="absolute top-2 right-2 h-8 px-3 z-10 bg-slate-800 hover:bg-amber-500 hover:text-black border-slate-700 transition-colors flex items-center text-xs"
                      >
                          <Edit3 size={12} className="mr-1"/> Bewerken
                      </Button>
                      
                      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                          <p className="text-xs font-bold text-slate-500 uppercase">Klant</p>
                          <p className="font-bold text-white text-lg">{selectedReservation.customer.salutation} {selectedReservation.customer.firstName} {selectedReservation.customer.lastName}</p>
                          <p className="text-sm text-slate-400">{selectedReservation.customer.email}</p>
                          <p className="text-sm text-slate-400">{selectedReservation.customer.phone}</p>
                      </div>
                      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                          <p className="text-xs font-bold text-slate-500 uppercase">Boeking</p>
                          <p className="text-sm text-slate-400">Datum: {new Date(selectedReservation.date).toLocaleDateString()}</p>
                          <p className="text-sm text-slate-400">Gasten: <span className="text-white font-bold">{selectedReservation.partySize}</span></p>
                          <p className="text-sm text-slate-400">Arrangement: <span className="text-white capitalize">{selectedReservation.packageType}</span></p>
                      </div>
                 </div>

                 {/* FINANCIALS */}
                 {isEditingPrice ? (
                   <PriceOverridePanel 
                     reservation={selectedReservation} 
                     onSave={handlePriceSave} 
                     onCancel={() => setIsEditingPrice(false)} 
                   />
                 ) : (
                   <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-400">Totaalbedrag</span>
                        <div className="flex items-baseline space-x-2">
                          <span className="text-xl font-mono text-white">€{(selectedReservation.financials.finalTotal || 0).toFixed(2)}</span>
                          {selectedReservation.adminPriceOverride && (
                            <Badge status="OPTION" className="scale-75 origin-left">Aangepast</Badge>
                          )}
                        </div>
                        {selectedReservation.financials.isPaid ? (
                           <span className="text-xs text-emerald-500 font-bold mt-1">
                             Betaald via {selectedReservation.financials.paymentMethod || 'Onbekend'}
                           </span>
                        ) : selectedReservation.financials.paid > 0 ? (
                           <span className="text-xs text-orange-500 font-bold mt-1">
                             Reeds voldaan: €{selectedReservation.financials.paid.toFixed(2)}
                           </span>
                        ) : (
                           <span className="text-xs text-red-500 font-bold mt-1">Nog te betalen</span>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        {!selectedReservation.financials.isPaid && (
                            <Button 
                              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 border-none"
                              onClick={() => setShowPaymentModal(true)}
                            >
                              Betalen
                            </Button>
                        )}
                        <Button variant="ghost" onClick={() => setIsEditingPrice(true)} className="h-8 text-xs px-2">
                           Aanpassen
                        </Button>
                      </div>
                   </div>
                 )}

                 {/* STATUS ACTIONS */}
                 <div className="space-y-4">
                   <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest border-b border-slate-800 pb-2">Status</h4>
                   <div className="flex gap-2 flex-wrap">
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
                 </div>

                 {/* DELETE */}
                 <div className="pt-4 border-t border-slate-800">
                    <Button 
                      variant="ghost" 
                      onClick={() => setShowDeleteModal(true)} 
                      className="w-full text-red-500 hover:bg-red-900/20 hover:text-red-400"
                    >
                      <Trash2 size={16} className="mr-2" /> Verplaats naar Prullenbak
                    </Button>
                 </div>
               </div>
             )}
          </div>
        )}
      </ResponsiveDrawer>

      {/* PAYMENT MODAL */}
      {showPaymentModal && selectedReservation && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <Card className="bg-slate-950 border border-slate-800 w-full max-w-sm p-6 animate-in fade-in zoom-in-95">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white">Betaling Registreren</h3>
                <button onClick={() => setShowPaymentModal(false)} className="text-slate-500 hover:text-white"><XCircle size={20}/></button>
             </div>
             
             <div className="space-y-4">
               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Te Betalen Totaal</label>
                 <p className="text-xl font-mono text-white">€{selectedReservation.financials.finalTotal.toFixed(2)}</p>
                 {selectedReservation.financials.paid > 0 && (
                    <p className="text-xs text-emerald-500 mt-1">Reeds voldaan: €{selectedReservation.financials.paid.toFixed(2)}</p>
                 )}
               </div>

               <div>
                 <Input 
                    label="Bedrag (€)"
                    type="number"
                    value={paymentAmount}
                    onChange={(e: any) => setPaymentAmount(parseFloat(e.target.value))}
                 />
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

      {/* FULL EDIT MODAL */}
      {showFullEditModal && selectedReservation && (
        <EditReservationModal 
          reservation={selectedReservation} 
          onClose={() => setShowFullEditModal(false)} 
          onSave={refreshData}
        />
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && selectedReservation && (
        <DestructiveActionModal 
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={executeDelete}
          title="Verplaats naar Prullenbak"
          description={
            <p>
              Weet je zeker dat je de reservering van <strong>{selectedReservation.customer.lastName}</strong> wilt verwijderen?
              <br/>Het item wordt verplaatst naar de prullenbak en kan binnen 30 dagen worden hersteld.
            </p>
          }
          verificationText="VERWIJDER"
          confirmButtonText="Verwijderen"
        />
      )}
    </div>
  );
};
