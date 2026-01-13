
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, Calendar, Filter, MoreHorizontal,
  CheckCircle2, AlertCircle, Clock, XCircle, 
  User, Users, CreditCard, Star, ShoppingBag, 
  ArrowRight, Mail, Phone, Trash2, SlidersHorizontal,
  ChevronDown, MessageSquare, Utensils, Tag, PartyPopper, Briefcase, Loader2,
  Link as LinkIcon, Unlink, Plus, Edit2, Check
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
import { useReservations } from '../../hooks/useReservations';

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

// --- INLINE EDIT COMPONENTS ---

const EditablePax = ({ reservation, onChange }: { reservation: Reservation, onChange: (id: string, pax: number) => void }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(reservation.partySize);

  const handleSave = () => {
    if (val !== reservation.partySize) {
      onChange(reservation.id, val);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center space-x-1">
        <input 
          autoFocus
          type="number" 
          value={val}
          onChange={(e) => setVal(parseInt(e.target.value) || 0)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="w-12 h-7 bg-slate-950 border border-amber-500 rounded text-center text-xs text-white outline-none"
        />
        <button onClick={handleSave} className="text-emerald-500"><Check size={14}/></button>
      </div>
    );
  }

  return (
    <div 
      onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
      className="flex items-center group cursor-pointer hover:bg-slate-800/50 px-1 rounded transition-colors"
    >
      <span className="bg-slate-950 px-2 py-1 rounded font-bold text-white mr-1 border border-slate-800 group-hover:border-slate-600">{reservation.partySize}p</span>
      <span className="text-xs uppercase text-slate-400">{reservation.packageType}</span>
      <Edit2 size={10} className="text-slate-600 ml-1 opacity-0 group-hover:opacity-100" />
    </div>
  );
};

const EditableStatus = ({ reservation, onChange }: { reservation: Reservation, onChange: (id: string, status: BookingStatus) => void }) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as BookingStatus;
    if (newStatus !== reservation.status) {
      onChange(reservation.id, newStatus);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <select 
        autoFocus
        value={reservation.status}
        onChange={handleChange}
        onBlur={() => setIsEditing(false)}
        onClick={(e) => e.stopPropagation()}
        className="h-7 text-[10px] bg-slate-950 border border-amber-500 rounded text-white outline-none uppercase font-bold"
      >
        <option value="REQUEST">REQUEST</option>
        <option value="OPTION">OPTION</option>
        <option value="CONFIRMED">CONFIRMED</option>
        <option value="ARRIVED">ARRIVED</option>
        <option value="CANCELLED">CANCELLED</option>
        <option value="NOSHOW">NOSHOW</option>
      </select>
    );
  }

  return (
    <div onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="cursor-pointer group relative inline-block">
      <Badge status={reservation.status}>{reservation.status}</Badge>
      <div className="absolute top-0 right-0 -mt-1 -mr-1 opacity-0 group-hover:opacity-100">
        <div className="bg-slate-800 rounded-full p-0.5 border border-slate-600">
            <Edit2 size={8} className="text-slate-300" />
        </div>
      </div>
    </div>
  );
};

export const ReservationManager = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Use custom hook for async data
  const { data: reservations, isLoading, refresh } = useReservations();
  
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);

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
  const [editModalTab, setEditModalTab] = useState<string | undefined>(undefined);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState<{ id: string, newStatus: BookingStatus } | null>(null);
  const [isPriceEditing, setIsPriceEditing] = useState(false);
  
  // Link Modal
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkSearchTerm, setLinkSearchTerm] = useState('');
  
  // Payment Logic
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('FACTUUR');

  // --- LOADING EVENTS ---
  useEffect(() => {
    setAllEvents(calendarRepo.getAll());
  }, []);

  // --- DEEP LINKING ---
  useEffect(() => {
    if (reservations.length > 0) {
      // Handle Open Drawer
      const openId = searchParams.get('open');
      if (openId && !selectedReservation) {
          const match = reservations.find(r => r.id === openId);
          if (match) setSelectedReservation(match);
      }
      
      // Handle Edit Modal with specific Tab
      const editId = searchParams.get('editId');
      const tab = searchParams.get('tab');
      if (editId) {
          const match = reservations.find(r => r.id === editId);
          if (match) {
              setSelectedReservation(match);
              if (tab) setEditModalTab(tab);
              setShowEditModal(true);
          }
      }
      
      const dateParam = searchParams.get('date');
      if (dateParam) {
          setSelectedDate(dateParam);
          setFilterMode('ALL');
      }
    }
  }, [reservations, searchParams]);

  // --- INLINE EDIT HANDLERS ---
  const handleInlineStatusChange = (id: string, newStatus: BookingStatus) => {
    const original = reservations.find(r => r.id === id);
    if (!original) return;

    bookingRepo.update(id, (r) => ({ ...r, status: newStatus }));
    
    // Create undo point
    undoManager.registerUndo(
      `Status gewijzigd naar ${newStatus}`,
      'RESERVATION',
      id,
      original
    );
    
    logAuditAction('UPDATE_STATUS', 'RESERVATION', id, { description: `Inline update to ${newStatus}` });
    refresh();
  };

  const handleInlinePaxChange = (id: string, newPax: number) => {
    const original = reservations.find(r => r.id === id);
    if (!original) return;

    // We also need to recalc financials if pax changes
    const updatedRes = { ...original, partySize: newPax };
    const newFinancials = recalculateReservationFinancials(updatedRes);
    
    bookingRepo.update(id, (r) => ({ ...r, partySize: newPax, financials: newFinancials }));
    
    undoManager.registerUndo(
      `Aantal personen gewijzigd naar ${newPax}`,
      'RESERVATION',
      id,
      original
    );

    logAuditAction('UPDATE_PAX', 'RESERVATION', id, { description: `Inline update to ${newPax}p. Total recalculated.` });
    refresh();
  };

  // --- FILTER LOGIC ---
  
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
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
        if (!searchTerm && selectedDate) {
            result = result.filter(r => r.date === selectedDate);
        }
        break;
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(r => 
        r.customer.lastName.toLowerCase().includes(q) ||
        r.customer.email.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => {
        if (a.status === 'REQUEST' && b.status !== 'REQUEST') return -1;
        if (b.status === 'REQUEST' && a.status !== 'REQUEST') return 1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [reservations, filterMode, selectedDate, searchTerm]);

  // --- CAPACITY BAR ---
  const capacityStats = useMemo(() => {
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

  const handleLinkReservations = (targetId: string) => {
    if (!selectedReservation) return;
    
    // Update Source
    const sourceLinks = selectedReservation.linkedBookingIds || [];
    if (!sourceLinks.includes(targetId)) {
        bookingRepo.update(selectedReservation.id, r => ({ ...r, linkedBookingIds: [...sourceLinks, targetId] }));
    }

    // Update Target (Bi-directional)
    const targetRes = bookingRepo.getById(targetId);
    if (targetRes) {
        const targetLinks = targetRes.linkedBookingIds || [];
        if (!targetLinks.includes(selectedReservation.id)) {
            bookingRepo.update(targetId, r => ({ ...r, linkedBookingIds: [...targetLinks, selectedReservation.id] }));
        }
    }

    logAuditAction('LINK_RESERVATIONS', 'RESERVATION', selectedReservation.id, { description: `Linked with ${targetId}` });
    undoManager.showSuccess("Boekingen gekoppeld.");
    
    // Refresh local state
    const updated = bookingRepo.getById(selectedReservation.id);
    if(updated) setSelectedReservation(updated);
    
    setShowLinkModal(false);
    refresh();
  };

  const handleUnlink = (targetId: string) => {
    if (!selectedReservation) return;

    bookingRepo.update(selectedReservation.id, r => ({ 
        ...r, 
        linkedBookingIds: r.linkedBookingIds?.filter(id => id !== targetId) 
    }));

    const targetRes = bookingRepo.getById(targetId);
    if (targetRes) {
        bookingRepo.update(targetId, r => ({ 
            ...r, 
            linkedBookingIds: r.linkedBookingIds?.filter(id => id !== selectedReservation.id) 
        }));
    }

    const updated = bookingRepo.getById(selectedReservation.id);
    if(updated) setSelectedReservation(updated);
    refresh();
  };

  // Helper for Link Search
  const linkCandidates = useMemo(() => {
    if (!linkSearchTerm || !selectedReservation) return [];
    const q = linkSearchTerm.toLowerCase();
    return reservations.filter(r => 
        r.id !== selectedReservation.id && // Not self
        r.date === selectedReservation.date && // Same date usually makes sense
        (r.customer.lastName.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [linkSearchTerm, reservations, selectedReservation]);

  const toggleSelect = (id: string) => {
    const s = new Set(selectedIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelectedIds(s);
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      
      {/* 1. TOP BAR: KPI FILTERS */}
      <div className="flex flex-col lg:flex-row gap-4 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
         <KPIChip label="Vandaag" count={stats.todayCount} active={filterMode === 'TODAY'} onClick={() => setFilterMode('TODAY')} color="emerald" icon={Calendar} />
         <KPIChip label="Actie Vereist" count={stats.actionCount} active={filterMode === 'ACTION'} onClick={() => setFilterMode('ACTION')} color="red" icon={AlertCircle} />
         <KPIChip label="Aanvragen" count={stats.requests} active={filterMode === 'REQUESTS'} onClick={() => setFilterMode('REQUESTS')} color="blue" icon={MessageSquare} />
         <KPIChip label="Opties" count={stats.options} active={filterMode === 'OPTIONS'} onClick={() => setFilterMode('OPTIONS')} color="amber" icon={Clock} />
         <div className="h-auto w-px bg-slate-800 mx-2 hidden lg:block" />
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
         {/* ... Search & Date Inputs ... */}
         <div className="relative flex-grow w-full md:w-auto group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input className="w-full bg-black/40 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:border-amber-500 outline-none transition-all placeholder:text-slate-600" placeholder="Zoek op naam, email of ref..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
         </div>
         <div className="flex items-center space-x-2 bg-black/40 p-1 rounded-xl border border-slate-700">
            <button onClick={() => { setFilterMode('ALL'); setSelectedDate(''); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filterMode === 'ALL' && !selectedDate ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white'}`}>Alles</button>
            <div className="h-4 w-px bg-slate-700" />
            <input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setFilterMode('ALL'); }} className="bg-transparent border-none text-white text-xs font-bold focus:ring-0 cursor-pointer" />
         </div>
         <div className="flex space-x-2">
            <Button onClick={() => window.location.href='#/admin/reservations/new'} className="h-10 text-xs bg-amber-500 text-black hover:bg-amber-400 border-none font-bold">+ Nieuwe Boeking</Button>
         </div>
      </div>

      {/* 3. RICH TABLE */}
      <div className="flex-grow bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
         {isLoading && (
            <div className="absolute inset-0 bg-slate-900/80 z-20 flex items-center justify-center backdrop-blur-sm">
                <div className="flex flex-col items-center"><Loader2 size={32} className="text-amber-500 animate-spin mb-2" /><span className="text-xs font-bold text-slate-400 uppercase">Gegevens ophalen...</span></div>
            </div>
         )}
         <ResponsiveTable<Reservation>
            data={filteredData}
            keyExtractor={r => r.id}
            onRowClick={setSelectedReservation}
            isVirtual={true}
            virtualHeight="calc(100vh - 380px)"
            rowHeight={80} 
            columns={[
               { header: 'Gast', accessor: r => <div className="font-bold text-white text-sm">{formatGuestName(r.customer.firstName, r.customer.lastName)}</div> },
               { header: 'Datum', accessor: r => <span className="block font-bold text-slate-200 text-sm">{new Date(r.date).toLocaleDateString('nl-NL', {weekday:'short', day:'numeric', month:'short'})}</span> },
               { header: 'Arrangement', accessor: r => <EditablePax reservation={r} onChange={handleInlinePaxChange} /> },
               { header: 'Status', accessor: r => <EditableStatus reservation={r} onChange={handleInlineStatusChange} /> },
               { header: 'Totaal', accessor: r => <span className="font-mono font-bold text-white">€{r.financials.finalTotal.toFixed(0)}</span> },
            ]}
         />
      </div>

      {/* 4. DETAIL DRAWER (Same as before) */}
      <ResponsiveDrawer
         isOpen={!!selectedReservation}
         onClose={() => { setSelectedReservation(null); setEditModalTab(undefined); }}
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
                  <Button variant="secondary" className="flex flex-col items-center justify-center h-16 text-xs gap-1" onClick={() => setShowPaymentModal(true)}>
                     <CreditCard size={16} /> <span>Betaal</span>
                  </Button>
                  <Button variant="secondary" className="flex flex-col items-center justify-center h-16 text-xs gap-1 text-red-400 hover:text-red-500" onClick={() => setShowDeleteModal(true)}>
                     <Trash2 size={16} /> <span>Verwijder</span>
                  </Button>
               </div>

               {/* Linked Reservations */}
               <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex justify-between items-center">
                     <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                        <LinkIcon size={12} className="mr-2" /> Gekoppelde Groepen
                     </h3>
                     <Button variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setShowLinkModal(true)}>
                        <LinkIcon size={10} className="mr-1"/> Koppel
                     </Button>
                  </div>
                  
                  {selectedReservation.linkedBookingIds && selectedReservation.linkedBookingIds.length > 0 ? (
                     <div className="grid grid-cols-1 gap-2">
                        {selectedReservation.linkedBookingIds.map(linkId => {
                           const linkedRes = reservations.find(r => r.id === linkId);
                           if (!linkedRes) return null;
                           return (
                              <div key={linkId} className="flex justify-between items-center p-2 bg-slate-900 border border-slate-800 rounded-lg">
                                 <div className="flex items-center space-x-2 text-xs">
                                    <span className="font-bold text-white">{formatGuestName(linkedRes.customer.firstName, linkedRes.customer.lastName)}</span>
                                    <span className="text-slate-500">({linkedRes.partySize}p)</span>
                                 </div>
                                 <button onClick={() => handleUnlink(linkId)} className="text-slate-500 hover:text-red-500">
                                    <Unlink size={14} />
                                 </button>
                              </div>
                           );
                        })}
                     </div>
                  ) : (
                     <p className="text-xs text-slate-600 italic">Geen gekoppelde reserveringen.</p>
                  )}
               </div>

               {/* Info Cards */}
               <div className="space-y-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex justify-between items-center">
                     <div className="flex items-center space-x-4">
                        <div className="p-3 bg-slate-950 rounded-lg text-slate-400"><Calendar size={20} /></div>
                        <div>
                           <p className="text-xs text-slate-500 font-bold uppercase">Wanneer</p>
                           <p className="text-white font-bold">{new Date(selectedReservation.date).toLocaleDateString()}</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-xs text-slate-500 font-bold uppercase">Gezelschap</p>
                        <p className="text-xl font-serif text-white">{selectedReservation.partySize} Personen</p>
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
                  </div>
               </div>

               {/* Timeline */}
               <div className="pt-6 border-t border-slate-800">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Geschiedenis</h3>
                  <AuditTimeline entityId={selectedReservation.id} />
               </div>

            </div>
         )}
      </ResponsiveDrawer>

      {/* Link Modal */}
      {showLinkModal && selectedReservation && (
         <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl">
               <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="text-white font-bold">Koppel Reservering</h3>
                  <button onClick={() => setShowLinkModal(false)}><XCircle size={20} className="text-slate-500 hover:text-white"/></button>
               </div>
               <div className="p-4 space-y-4">
                  <Input 
                     placeholder="Zoek op naam of ID..." 
                     value={linkSearchTerm} 
                     onChange={(e: any) => setLinkSearchTerm(e.target.value)} 
                     autoFocus
                  />
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                     {linkCandidates.map(r => (
                        <div key={r.id} className="flex justify-between items-center p-2 hover:bg-slate-800 rounded cursor-pointer border border-transparent hover:border-slate-700" onClick={() => handleLinkReservations(r.id)}>
                           <div>
                              <p className="text-sm text-white font-bold">{formatGuestName(r.customer.firstName, r.customer.lastName)}</p>
                              <p className="text-xs text-slate-500">{r.id} • {r.partySize}p</p>
                           </div>
                           <Plus size={16} className="text-emerald-500" />
                        </div>
                     ))}
                     {linkCandidates.length === 0 && <p className="text-xs text-slate-500 text-center">Geen kandidaten gevonden.</p>}
                  </div>
               </div>
            </Card>
         </div>
      )}

      {/* Modals (Edit, Delete, Price) */}
      {showEditModal && selectedReservation && (
         <EditReservationModal 
            reservation={selectedReservation} 
            initialTab={editModalTab}
            onClose={() => { setShowEditModal(false); setEditModalTab(undefined); }} 
            onSave={() => { refresh(); setShowEditModal(false); setEditModalTab(undefined); }} 
         />
      )}

      {/* ... Other modals assumed from previous context ... */}
    </div>
  );
};
