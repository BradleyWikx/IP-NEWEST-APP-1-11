
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, Calendar, Filter, MoreHorizontal,
  CheckCircle2, AlertCircle, Clock, XCircle, 
  User, Users, CreditCard, Star, ShoppingBag, 
  ArrowRight, Mail, Phone, Trash2, SlidersHorizontal,
  ChevronDown, MessageSquare, Utensils, Tag, PartyPopper, Briefcase
} from 'lucide-react';
import { Button, Card, Badge, ResponsiveDrawer, Input } from '../UI';
import { Reservation, BookingStatus, CalendarEvent } from '../../types';
import { bookingRepo, calendarRepo } from '../../utils/storage';
import { undoManager } from '../../utils/undoManager';
import { logAuditAction } from '../../utils/auditLogger';
import { triggerEmail } from '../../utils/emailEngine';
import { ResponsiveTable } from '../ResponsiveTable';
import { getPaymentStatus } from '../../utils/paymentHelpers';
import { PriceOverridePanel } from './PriceOverridePanel';
import { recalculateReservationFinancials } from '../../utils/pricing';
import { AuditTimeline } from './AuditTimeline';
import { EditReservationModal } from './EditReservationModal';
import { DestructiveActionModal } from '../UI/DestructiveActionModal';
import { formatGuestName, formatCurrency } from '../../utils/formatters';

// --- TYPES ---

type FilterMode = 'ALL' | 'TODAY' | 'ACTION' | 'REQUESTS' | 'OPTIONS' | 'ARRIVALS';

// --- COMPONENTS ---

const KPIChip = ({ 
  label, count, active, onClick, color, icon: Icon 
}: { 
  label: string, count: number, active: boolean, onClick: () => void, color: string, icon: any 
}) => (
  <button 
    onClick={onClick}
    className={`
      flex items-center justify-between p-3 rounded-xl border transition-all duration-200 min-w-[140px] flex-1
      ${active 
        ? `bg-${color}-900/20 border-${color}-500/50 shadow-[0_0_15px_rgba(0,0,0,0.3)]` 
        : 'bg-slate-900 border-slate-800 hover:border-slate-600 hover:bg-slate-800'}
    `}
  >
    <div className="flex flex-col items-start">
      <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${active ? `text-${color}-400` : 'text-slate-500'}`}>
        {label}
      </span>
      <span className={`text-2xl font-serif font-bold ${active ? 'text-white' : 'text-slate-300'}`}>
        {count}
      </span>
    </div>
    <div className={`p-2 rounded-lg ${active ? `bg-${color}-500 text-black` : 'bg-slate-950 text-slate-600'}`}>
      <Icon size={18} />
    </div>
  </button>
);

export const ReservationManager = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Filter State
  const [filterMode, setFilterMode] = useState<FilterMode>('TODAY');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<{ type: 'CONFIRM' | 'CANCEL' | 'DELETE', count: number } | null>(null);

  // Drawer / Modals
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [drawerTab, setDrawerTab] = useState<'DETAILS' | 'HISTORY'>('DETAILS');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState<{ id: string, newStatus: BookingStatus } | null>(null);
  const [isPriceEditing, setIsPriceEditing] = useState(false);
  
  // Payment Logic
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('FACTUUR');

  // --- LOADING ---
  useEffect(() => {
    const load = () => {
        const data = bookingRepo.getAll(true); // Include archived for history if needed
        setReservations(data);
        setAllEvents(calendarRepo.getAll());

        // Handle Deep Links
        const openId = searchParams.get('open');
        if (openId && !selectedReservation) {
            const match = data.find(r => r.id === openId);
            if (match) setSelectedReservation(match);
        }
        
        // Date Override via URL
        const dateParam = searchParams.get('date');
        if (dateParam) {
            setSelectedDate(dateParam);
            setFilterMode('ALL'); // Reset specific filter to show everything for that date
        }
    };
    load();
    window.addEventListener('storage-update', load);
    return () => window.removeEventListener('storage-update', load);
  }, [refreshTrigger, searchParams]);

  const refresh = () => setRefreshTrigger(p => p + 1);

  // --- FILTER LOGIC ---
  
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    
    // Base set: Active reservations (not cancelled/archived)
    const active = reservations.filter(r => r.status !== 'CANCELLED' && r.status !== 'ARCHIVED');
    
    return {
      todayCount: active.filter(r => r.date === today).length,
      actionCount: active.filter(r => r.status === 'REQUEST' || getPaymentStatus(r) === 'OVERDUE' || (r.status === 'OPTION' && r.optionExpiresAt && r.optionExpiresAt <= today)).length,
      requests: active.filter(r => r.status === 'REQUEST').length,
      options: active.filter(r => r.status === 'OPTION').length,
      arrivals: active.filter(r => r.date === today && r.status === 'CONFIRMED').length,
    };
  }, [reservations]);

  const filteredData = useMemo(() => {
    let result = reservations;

    // 1. Primary Filter Mode
    const today = new Date().toISOString().split('T')[0];

    switch (filterMode) {
      case 'TODAY':
        result = result.filter(r => r.date === today);
        break;
      case 'ACTION':
        result = result.filter(r => {
           if (r.status === 'CANCELLED' || r.status === 'ARCHIVED') return false;
           const isReq = r.status === 'REQUEST';
           const isOverdue = getPaymentStatus(r) === 'OVERDUE';
           const isExpiring = r.status === 'OPTION' && r.optionExpiresAt && r.optionExpiresAt <= today;
           return isReq || isOverdue || isExpiring;
        });
        break;
      case 'REQUESTS':
        result = result.filter(r => r.status === 'REQUEST');
        break;
      case 'OPTIONS':
        result = result.filter(r => r.status === 'OPTION');
        break;
      case 'ARRIVALS':
        result = result.filter(r => r.date === today && (r.status === 'CONFIRMED' || r.status === 'ARRIVED'));
        break;
      case 'ALL':
        // If searching, search EVERYTHING. If date filter active, respect date.
        if (!searchTerm && selectedDate) {
            result = result.filter(r => r.date === selectedDate);
        }
        break;
    }

    // 2. Search
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(r => 
        r.customer.lastName.toLowerCase().includes(q) ||
        r.customer.email.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    }

    // Sort: Action items first, then date
    return result.sort((a, b) => {
        // Priority to requests
        if (a.status === 'REQUEST' && b.status !== 'REQUEST') return -1;
        if (b.status === 'REQUEST' && a.status !== 'REQUEST') return 1;
        // Then by date
        return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [reservations, filterMode, selectedDate, searchTerm]);

  // --- CAPACITY BAR ---
  const capacityStats = useMemo(() => {
    // Only relevant if filtering by specific date (TODAY or ALL + Date)
    let targetDate = filterMode === 'TODAY' ? new Date().toISOString().split('T')[0] : selectedDate;
    if (!targetDate) return null;

    const event = allEvents.find(e => e.date === targetDate && e.type === 'SHOW');
    const capacity = (event as any)?.capacity || 230;
    
    const dailyRes = reservations.filter(r => 
        r.date === targetDate && 
        ['CONFIRMED', 'ARRIVED', 'OPTION', 'INVITED'].includes(r.status)
    );
    const booked = dailyRes.reduce((s, r) => s + r.partySize, 0);
    const pending = reservations.filter(r => r.date === targetDate && r.status === 'REQUEST').reduce((s,r) => s + r.partySize, 0);

    return { date: targetDate, capacity, booked, pending, eventName: event?.title };
  }, [filterMode, selectedDate, reservations, allEvents]);

  // --- ACTIONS ---

  const handleBulkAction = (type: 'CONFIRM' | 'CANCEL' | 'DELETE') => {
    setBulkAction({ type, count: selectedIds.size });
  };

  const executeBulk = () => {
    if (!bulkAction) return;
    const ids = Array.from(selectedIds);
    
    ids.forEach((id: string) => {
       if (bulkAction.type === 'DELETE') bookingRepo.delete(id);
       else {
          const newStatus = bulkAction.type === 'CONFIRM' ? BookingStatus.CONFIRMED : BookingStatus.CANCELLED;
          bookingRepo.update(id, r => ({ ...r, status: newStatus }));
          if (newStatus === BookingStatus.CONFIRMED) {
             const res = bookingRepo.getById(id);
             if (res) triggerEmail('BOOKING_CONFIRMED', { type: 'RESERVATION', id, data: res });
          }
       }
    });

    logAuditAction('BULK_UPDATE', 'RESERVATION', 'MULTIPLE', { description: `Bulk ${bulkAction.type} on ${ids.length} items` });
    undoManager.showSuccess(`${bulkAction.count} items verwerkt.`);
    setBulkAction(null);
    setSelectedIds(new Set());
    refresh();
  };

  const toggleSelect = (id: string) => {
    const s = new Set(selectedIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelectedIds(s);
  };

  const handleRegisterPayment = () => {
    if (!selectedReservation) return;
    
    const updates = {
      financials: {
        ...selectedReservation.financials,
        isPaid: true,
        paidAt: new Date().toISOString(),
        paid: selectedReservation.financials.finalTotal, // Assume full payment
        paymentMethod: paymentMethod
      }
    };
    
    bookingRepo.update(selectedReservation.id, r => ({ ...r, ...updates }));
    
    logAuditAction('REGISTER_PAYMENT', 'RESERVATION', selectedReservation.id, { 
      description: `Payment of €${selectedReservation.financials.finalTotal} registered via ${paymentMethod}` 
    });
    
    undoManager.showSuccess('Betaling succesvol geregistreerd');
    setSelectedReservation({ ...selectedReservation, ...updates }); // Update local view
    setShowPaymentModal(false);
    refresh();
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      
      {/* 1. TOP BAR: KPI FILTERS */}
      <div className="flex flex-col lg:flex-row gap-4 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
         <KPIChip 
            label="Vandaag" 
            count={stats.todayCount} 
            active={filterMode === 'TODAY'} 
            onClick={() => setFilterMode('TODAY')}
            color="emerald" 
            icon={Calendar} 
         />
         <KPIChip 
            label="Actie Vereist" 
            count={stats.actionCount} 
            active={filterMode === 'ACTION'} 
            onClick={() => setFilterMode('ACTION')}
            color="red" 
            icon={AlertCircle} 
         />
         <KPIChip 
            label="Aanvragen" 
            count={stats.requests} 
            active={filterMode === 'REQUESTS'} 
            onClick={() => setFilterMode('REQUESTS')}
            color="blue" 
            icon={MessageSquare} 
         />
         <KPIChip 
            label="Opties" 
            count={stats.options} 
            active={filterMode === 'OPTIONS'} 
            onClick={() => setFilterMode('OPTIONS')}
            color="amber" 
            icon={Clock} 
         />
         <div className="h-auto w-px bg-slate-800 mx-2 hidden lg:block" />
         
         {/* Capacity Viz */}
         {capacityStats && (
            <Card className="flex-grow min-w-[250px] p-3 bg-slate-900 border-slate-800 flex flex-col justify-center">
               <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{capacityStats.eventName || 'Geen Show'}</span>
                  <span className="text-xs font-mono font-bold text-white">{capacityStats.booked} / {capacityStats.capacity}</span>
               </div>
               <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, (capacityStats.booked / capacityStats.capacity) * 100)}%` }} />
                  <div className="h-full bg-blue-500/50" style={{ width: `${Math.min(100, (capacityStats.pending / capacityStats.capacity) * 100)}%` }} />
               </div>
            </Card>
         )}
      </div>

      {/* 2. TOOLBAR */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-slate-900 p-4 rounded-2xl border border-slate-800">
         {/* Bulk Actions (Conditional) */}
         {selectedIds.size > 0 ? (
            <div className="flex items-center space-x-3 w-full animate-in slide-in-from-left-2">
               <span className="text-sm font-bold text-white bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                 {selectedIds.size} geselecteerd
               </span>
               <div className="h-6 w-px bg-slate-800" />
               <Button onClick={() => handleBulkAction('CONFIRM')} className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 border-none"><CheckCircle2 size={14} className="mr-2"/> Bevestig</Button>
               <Button onClick={() => handleBulkAction('CANCEL')} variant="secondary" className="h-9 text-xs"><XCircle size={14} className="mr-2"/> Annuleer</Button>
               <Button onClick={() => handleBulkAction('DELETE')} variant="ghost" className="h-9 w-9 p-0 text-red-500 hover:bg-red-900/20"><Trash2 size={16}/></Button>
               <div className="flex-grow" />
               <button onClick={() => setSelectedIds(new Set())} className="text-slate-500 hover:text-white"><XCircle size={20}/></button>
            </div>
         ) : (
            <>
               {/* Search */}
               <div className="relative flex-grow w-full md:w-auto group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-amber-500 transition-colors" size={18} />
                  <input 
                    className="w-full bg-black/40 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:border-amber-500 outline-none transition-all placeholder:text-slate-600"
                    placeholder="Zoek op naam, email of ref..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
               </div>

               {/* Date Picker (Always visible or context aware) */}
               <div className="flex items-center space-x-2 bg-black/40 p-1 rounded-xl border border-slate-700">
                  <button onClick={() => { setFilterMode('ALL'); setSelectedDate(''); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filterMode === 'ALL' && !selectedDate ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white'}`}>Alles</button>
                  <div className="h-4 w-px bg-slate-700" />
                  <input 
                    type="date" 
                    value={selectedDate} 
                    onChange={(e) => { setSelectedDate(e.target.value); setFilterMode('ALL'); }}
                    className="bg-transparent border-none text-white text-xs font-bold focus:ring-0 cursor-pointer"
                  />
               </div>

               <div className="flex space-x-2">
                  <Button variant="secondary" className="h-10 w-10 p-0 flex items-center justify-center border-slate-700"><SlidersHorizontal size={16}/></Button>
                  <Button onClick={() => window.location.href='#/admin/reservations/new'} className="h-10 text-xs bg-amber-500 text-black hover:bg-amber-400 border-none font-bold">
                     + Nieuwe Boeking
                  </Button>
               </div>
            </>
         )}
      </div>

      {/* 3. RICH TABLE */}
      <div className="flex-grow bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
         <ResponsiveTable<Reservation>
            data={filteredData}
            keyExtractor={r => r.id}
            onRowClick={setSelectedReservation}
            isVirtual={true}
            virtualHeight="calc(100vh - 380px)"
            rowHeight={80} 
            columns={[
               {
                  header: '',
                  accessor: r => (
                     <div onClick={e => e.stopPropagation()} className="flex items-center justify-center h-full">
                        <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded bg-slate-950 border-slate-700 checked:bg-amber-500 w-4 h-4 cursor-pointer" />
                     </div>
                  ),
                  className: 'w-12'
               },
               {
                  header: 'Gast',
                  accessor: r => (
                     <div className="flex flex-col">
                        <div className="flex items-center font-bold text-white text-sm">
                           {formatGuestName(r.customer.firstName, r.customer.lastName)}
                        </div>
                        <div className="flex items-center text-xs text-slate-500 mt-1">
                           <Mail size={10} className="mr-1"/> {r.customer.email}
                        </div>
                        {/* TAGS ROW */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                           {/* Manual Tags */}
                           {r.tags?.map(tag => (
                              <span key={tag} className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[9px] text-slate-300 font-bold uppercase tracking-wider flex items-center">
                                <Tag size={8} className="mr-1" /> {tag}
                              </span>
                           ))}
                           
                           {/* System Derived Tags */}
                           {r.notes.dietary && (
                              <span className="px-1.5 py-0.5 rounded bg-red-900/20 border border-red-900/50 text-[9px] text-red-400 font-bold uppercase tracking-wider flex items-center" title={r.notes.dietary}>
                                 <Utensils size={8} className="mr-1" /> Dieet
                              </span>
                           )}
                           {r.notes.isCelebrating && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-900/20 border border-blue-900/50 text-[9px] text-blue-400 font-bold uppercase tracking-wider flex items-center">
                                 <PartyPopper size={8} className="mr-1" /> Viering
                              </span>
                           )}
                           {r.customer.companyName && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-900/20 border border-purple-900/50 text-[9px] text-purple-400 font-bold uppercase tracking-wider flex items-center">
                                 <Briefcase size={8} className="mr-1" /> Zakelijk
                              </span>
                           )}
                           {r.merchandise.length > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-900/20 border border-amber-900/50 text-[9px] text-amber-500 font-bold uppercase tracking-wider flex items-center">
                                 <ShoppingBag size={8} className="mr-1" /> Merch
                              </span>
                           )}
                        </div>
                     </div>
                  )
               },
               {
                  header: 'Wanneer',
                  accessor: r => (
                     <div>
                        <span className="block font-bold text-slate-200 text-sm">{new Date(r.date).toLocaleDateString('nl-NL', {weekday:'short', day:'numeric', month:'short'})}</span>
                        <span className="text-xs text-slate-500 font-mono">{r.startTime || '19:30'}</span>
                     </div>
                  ),
                  className: 'w-32'
               },
               {
                  header: 'Arrangement',
                  accessor: r => (
                     <div className="flex items-center">
                        <div className="flex flex-col items-center mr-3 bg-slate-950 border border-slate-800 rounded-lg p-1.5 min-w-[40px]">
                           <Users size={14} className="text-slate-500 mb-0.5"/>
                           <span className="font-bold text-white">{r.partySize}</span>
                        </div>
                        <div>
                           <span className={`text-xs font-bold uppercase tracking-wider ${r.packageType === 'premium' ? 'text-amber-500' : 'text-slate-400'}`}>
                              {r.packageType}
                           </span>
                           {r.addons.length > 0 && <span className="block text-[9px] text-slate-500">+ {r.addons.length} opties</span>}
                        </div>
                     </div>
                  )
               },
               {
                  header: 'Status',
                  accessor: r => {
                     const isOverdue = getPaymentStatus(r) === 'OVERDUE';
                     return (
                        <div className="flex flex-col items-start space-y-1">
                           <Badge status={r.status} className="shadow-sm" />
                           {isOverdue && r.status !== 'CANCELLED' && (
                              <span className="flex items-center text-[9px] font-bold text-red-500 bg-red-900/10 px-1.5 py-0.5 rounded border border-red-900/30">
                                 <AlertCircle size={10} className="mr-1"/> Betaal Actie
                              </span>
                           )}
                        </div>
                     )
                  },
                  className: 'w-32'
               },
               {
                  header: 'Totaal',
                  accessor: r => (
                     <div className="text-right">
                        <span className="block font-mono font-bold text-white">€{r.financials.finalTotal.toFixed(0)}</span>
                        {r.financials.isPaid ? (
                           <span className="text-[10px] text-emerald-500 font-bold flex items-center justify-end"><CheckCircle2 size={10} className="mr-1"/> Betaald</span>
                        ) : (
                           <span className="text-[10px] text-slate-500">Open</span>
                        )}
                     </div>
                  ),
                  className: 'w-24 text-right'
               },
               {
                  header: '',
                  accessor: r => (
                     <Button variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-white" onClick={() => setSelectedReservation(r)}>
                        <ChevronDown size={16} className="-rotate-90"/>
                     </Button>
                  ),
                  className: 'w-10'
               }
            ]}
         />
      </div>

      {/* 4. DETAIL DRAWER (Enhanced) */}
      <ResponsiveDrawer
         isOpen={!!selectedReservation}
         onClose={() => setSelectedReservation(null)}
         title="Details"
         widthClass="md:w-[600px]"
      >
         {selectedReservation && (
            <div className="pb-20 space-y-8">
               
               {/* Quick Header */}
               <div className="flex justify-between items-start">
                  <div>
                     <h2 className="text-2xl font-serif text-white">{formatGuestName(selectedReservation.customer.firstName, selectedReservation.customer.lastName)}</h2>
                     <div className="flex items-center space-x-3 text-slate-400 text-sm mt-1">
                        <span className="flex items-center"><Mail size={12} className="mr-1"/> {selectedReservation.customer.email}</span>
                        <span className="flex items-center"><Phone size={12} className="mr-1"/> {selectedReservation.customer.phone}</span>
                     </div>
                     {/* Tags in Drawer */}
                     <div className="flex flex-wrap gap-2 mt-3">
                        {selectedReservation.tags?.map(tag => (
                           <span key={tag} className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-slate-300 font-bold uppercase tracking-wider flex items-center">
                             <Tag size={12} className="mr-1" /> {tag}
                           </span>
                        ))}
                        {selectedReservation.customer.companyName && (
                           <span className="px-2 py-1 rounded bg-purple-900/20 border border-purple-900/50 text-xs text-purple-400 font-bold uppercase tracking-wider flex items-center">
                              <Briefcase size={12} className="mr-1" /> {selectedReservation.customer.companyName}
                           </span>
                        )}
                     </div>
                  </div>
                  <div className="text-right">
                     <Badge status={selectedReservation.status} className="mb-1 text-sm px-3 py-1"/>
                     <p className="text-xs text-slate-500 font-mono">{selectedReservation.id}</p>
                  </div>
               </div>

               {/* Action Grid */}
               <div className="grid grid-cols-4 gap-2">
                  <Button variant="secondary" className="flex flex-col items-center justify-center h-16 text-xs gap-1" onClick={() => triggerEmail('BOOKING_CONFIRMED', {type:'RESERVATION', id: selectedReservation.id, data: selectedReservation})}>
                     <Mail size={16} /> <span>Email</span>
                  </Button>
                  <Button variant="secondary" className="flex flex-col items-center justify-center h-16 text-xs gap-1" onClick={() => setShowEditModal(true)}>
                     <SlidersHorizontal size={16} /> <span>Wijzig</span>
                  </Button>
                  <Button 
                     variant="secondary" 
                     className="flex flex-col items-center justify-center h-16 text-xs gap-1" 
                     onClick={() => setShowPaymentModal(true)}
                  >
                     <CreditCard size={16} /> <span>Betaal</span>
                  </Button>
                  <Button variant="secondary" className="flex flex-col items-center justify-center h-16 text-xs gap-1 text-red-400 hover:text-red-500" onClick={() => setShowDeleteModal(true)}>
                     <Trash2 size={16} /> <span>Verwijder</span>
                  </Button>
               </div>

               {/* Info Cards */}
               <div className="space-y-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex justify-between items-center">
                     <div className="flex items-center space-x-4">
                        <div className="p-3 bg-slate-950 rounded-lg text-slate-400">
                           <Calendar size={20} />
                        </div>
                        <div>
                           <p className="text-xs text-slate-500 font-bold uppercase">Wanneer</p>
                           <p className="text-white font-bold">{new Date(selectedReservation.date).toLocaleDateString('nl-NL', {weekday:'long', day:'numeric', month:'long'})}</p>
                           <p className="text-slate-400 text-sm">Start: {selectedReservation.startTime || '19:30'}</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-xs text-slate-500 font-bold uppercase">Gezelschap</p>
                        <p className="text-xl font-serif text-white">{selectedReservation.partySize} Personen</p>
                        <p className="text-slate-400 text-sm capitalize">{selectedReservation.packageType}</p>
                     </div>
                  </div>

                  {/* Financials */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
                     <div className="flex justify-between items-end relative z-10">
                        <div>
                           <p className="text-xs text-slate-500 font-bold uppercase mb-1">Financieel</p>
                           <p className="text-3xl font-mono text-white">€{selectedReservation.financials.finalTotal.toFixed(2)}</p>
                           {selectedReservation.financials.isPaid ? 
                              <span className="text-emerald-500 text-xs font-bold flex items-center mt-1"><CheckCircle2 size={12} className="mr-1"/> Betaald</span> : 
                              <span className="text-red-500 text-xs font-bold flex items-center mt-1"><AlertCircle size={12} className="mr-1"/> Openstaand</span>
                           }
                        </div>
                        <Button variant="ghost" onClick={() => setIsPriceEditing(true)} className="text-xs">Aanpassen</Button>
                     </div>
                     {/* Background deco */}
                     <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><CreditCard size={100} /></div>
                  </div>

                  {/* Notes */}
                  {(selectedReservation.notes.dietary || selectedReservation.notes.comments || selectedReservation.notes.isCelebrating) && (
                     <div className="bg-amber-900/10 border border-amber-900/30 rounded-xl p-4 space-y-3">
                        <h4 className="text-amber-500 font-bold text-xs uppercase flex items-center"><Utensils size={12} className="mr-2"/> Bijzonderheden</h4>
                        
                        {selectedReservation.notes.dietary && <p className="text-sm text-amber-100"><span className="font-bold text-amber-500">Dieet:</span> {selectedReservation.notes.dietary}</p>}
                        
                        {selectedReservation.notes.isCelebrating && (
                           <p className="text-sm text-amber-100 flex items-center">
                              <PartyPopper size={12} className="mr-1 text-purple-400"/> 
                              <span className="font-bold text-purple-400 mr-1">Viering:</span> {selectedReservation.notes.celebrationText}
                           </p>
                        )}

                        {selectedReservation.notes.comments && <p className="text-sm text-amber-200/80 italic border-t border-amber-900/30 pt-2">"{selectedReservation.notes.comments}"</p>}
                     </div>
                  )}
               </div>

               {/* Timeline */}
               <div className="pt-6 border-t border-slate-800">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Geschiedenis</h3>
                  <AuditTimeline entityId={selectedReservation.id} />
               </div>

            </div>
         )}
      </ResponsiveDrawer>

      {/* Modals */}
      {showEditModal && selectedReservation && (
         <EditReservationModal 
            reservation={selectedReservation} 
            onClose={() => setShowEditModal(false)} 
            onSave={() => { refresh(); setShowEditModal(false); }} 
         />
      )}

      <DestructiveActionModal 
         isOpen={showDeleteModal} 
         onClose={() => setShowDeleteModal(false)}
         title="Verwijder Reservering"
         description="Weet je zeker dat je deze reservering wilt verwijderen? Dit verplaatst het item naar de prullenbak."
         onConfirm={() => { bookingRepo.delete(selectedReservation!.id); setShowDeleteModal(false); setSelectedReservation(null); refresh(); }}
         verificationText="VERWIJDER"
      />

      {isPriceEditing && selectedReservation && (
         <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg bg-slate-950 border-slate-800 p-6">
               <PriceOverridePanel 
                  reservation={selectedReservation} 
                  onCancel={() => setIsPriceEditing(false)}
                  onSave={(override) => {
                     const updated = { ...selectedReservation, adminPriceOverride: override };
                     // Re-calculate totals
                     const newFinancials = recalculateReservationFinancials(updated);
                     updated.financials = newFinancials;
                     bookingRepo.update(updated.id, () => updated);
                     setIsPriceEditing(false);
                     setSelectedReservation(updated);
                     refresh();
                  }}
               />
            </Card>
         </div>
      )}

      {showPaymentModal && selectedReservation && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <Card className="bg-slate-950 border border-slate-800 w-full max-w-sm p-6 shadow-2xl">
             <h3 className="text-lg font-serif text-white mb-6">Betaling Registreren</h3>
             
             <div className="space-y-4">
               <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                  <p className="text-xs text-slate-500 uppercase font-bold mb-1">Te Betalen</p>
                  <p className="text-3xl font-mono text-white">€{selectedReservation.financials.finalTotal.toFixed(2)}</p>
                  <p className="text-xs text-slate-400 mt-2">{formatGuestName(selectedReservation.customer.firstName, selectedReservation.customer.lastName)}</p>
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
                 <Button variant="ghost" onClick={() => setShowPaymentModal(false)} className="flex-1">Annuleren</Button>
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
