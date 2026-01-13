
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Ticket, Search, CheckCircle2, XCircle,
  Clock, AlertCircle, Calendar, Users, DollarSign, 
  Edit3, Utensils, PartyPopper, Star, 
  Trash2, Filter, AlertOctagon, Coffee, Music, ShoppingBag,
  ChevronLeft, ChevronRight, X, BarChart3, Lock, ArrowRight,
  CheckSquare, Layers
} from 'lucide-react';
import { Button, Card, Badge, ResponsiveDrawer, Input } from '../UI';
import { Reservation, BookingStatus, AdminPriceOverride, CalendarEvent } from '../../types';
import { bookingRepo, tasksRepo, calendarRepo, showRepo } from '../../utils/storage';
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
import { formatGuestName } from '../../utils/formatters';

// --- TYPES ---

type ViewTab = 'TODAY' | 'AGENDA' | 'ATTENTION' | 'ARCHIVE';
type QuickFilter = 'ALL' | 'REQUEST' | 'UNPAID' | 'VIP';

export const ReservationManager = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Workflow State
  const [activeTab, setActiveTab] = useState<ViewTab>('TODAY');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Selection State (BULK)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<{ type: 'CONFIRM' | 'CANCEL' | 'DELETE', count: number } | null>(null);

  // Modal State
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [detailTab, setDetailTab] = useState<'DETAILS' | 'HISTORY'>('DETAILS');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showFullEditModal, setShowFullEditModal] = useState(false);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Safe Status Change State
  const [statusConfirm, setStatusConfirm] = useState<{ id: string, newStatus: BookingStatus } | null>(null);

  // --- DATA LOADING ---
  useEffect(() => {
    const load = () => {
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
            setActiveTab('AGENDA');
        }

        setReservations(data);
        setAllEvents(calendarRepo.getAll());
    };
    load();
    window.addEventListener('storage-update', load);
    return () => window.removeEventListener('storage-update', load);
  }, [refreshTrigger, searchParams]);

  const refreshData = () => setRefreshTrigger(p => p + 1);

  // --- FILTER LOGIC ---
  const filteredData = useMemo<Reservation[]>(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // 1. Tab & Date Filtering
    let result = reservations.filter(r => {
      if (activeTab === 'ARCHIVE') return r.status === 'ARCHIVED' || r.status === 'CANCELLED';
      if (r.status === 'ARCHIVED' || r.status === 'CANCELLED') return false;

      switch (activeTab) {
        case 'TODAY':
          return r.date === todayStr;
        case 'AGENDA':
          return r.date === selectedDateFilter;
        case 'ATTENTION':
          const paymentStatus = getPaymentStatus(r);
          const isOverdue = paymentStatus === 'OVERDUE' || paymentStatus === 'DUE_SOON';
          const isRequest = r.status === 'REQUEST';
          const isExpiringOption = r.status === 'OPTION' && r.optionExpiresAt && r.optionExpiresAt <= todayStr;
          return isOverdue || isRequest || isExpiringOption;
        default: return true;
      }
    });

    // 2. Quick Filters
    if (quickFilter === 'REQUEST') result = result.filter(r => r.status === 'REQUEST');
    if (quickFilter === 'UNPAID') result = result.filter(r => !r.financials.isPaid);
    if (quickFilter === 'VIP') result = result.filter(r => r.packageType === 'premium' || r.tags?.includes('VIP'));

    // 3. Search
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(r => 
        r.customer.lastName.toLowerCase().includes(q) ||
        r.customer.email.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [reservations, activeTab, quickFilter, searchTerm, selectedDateFilter]);

  // --- BULK SELECTION LOGIC ---
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.map(r => r.id)));
    }
  };

  const handleBulkAction = (type: 'CONFIRM' | 'CANCEL' | 'DELETE') => {
    setBulkAction({ type, count: selectedIds.size });
  };

  const executeBulkAction = () => {
    if (!bulkAction) return;
    
    let updatedCount = 0;
    const ids: string[] = Array.from(selectedIds);

    ids.forEach((id: string) => {
      const res = reservations.find(r => r.id === id);
      if (!res) return;

      if (bulkAction.type === 'DELETE') {
        bookingRepo.delete(id);
        updatedCount++;
      } else {
        const newStatus = bulkAction.type === 'CONFIRM' ? BookingStatus.CONFIRMED : BookingStatus.CANCELLED;
        
        // Skip if already in that status
        if (res.status === newStatus) return;

        bookingRepo.update(id, (r) => ({ ...r, status: newStatus }));
        
        // Trigger Email
        if (newStatus === BookingStatus.CONFIRMED) {
           triggerEmail('BOOKING_CONFIRMED', { type: 'RESERVATION', id, data: { ...res, status: newStatus } });
        } else if (newStatus === BookingStatus.CANCELLED) {
           triggerEmail('BOOKING_CANCELLED', { type: 'RESERVATION', id, data: { ...res, status: newStatus } });
        }

        updatedCount++;
      }
    });

    logAuditAction('BULK_UPDATE', 'RESERVATION', 'MULTIPLE', { 
        description: `Bulk ${bulkAction.type} on ${updatedCount} items` 
    });

    undoManager.showSuccess(`${updatedCount} items bijgewerkt.`);
    
    setBulkAction(null);
    setSelectedIds(new Set());
    refreshData();
  };

  // --- SMART DECISION BAR LOGIC ---
  const dateCapacityStats = useMemo(() => {
      const targetDate = activeTab === 'TODAY' ? new Date().toISOString().split('T')[0] : selectedDateFilter;
      const event = allEvents.find(e => e.date === targetDate && e.type === 'SHOW');
      
      const relevant = reservations.filter(r => 
          r.date === targetDate &&
          r.status !== 'CANCELLED' && 
          r.status !== 'ARCHIVED' && 
          r.status !== 'NOSHOW' &&
          r.status !== 'WAITLIST'
      );

      const hardOccupancy = relevant
        .filter(r => ['CONFIRMED', 'ARRIVED', 'OPTION', 'INVITED'].includes(r.status))
        .reduce((s,r) => s + r.partySize, 0);
        
      const pendingOccupancy = relevant
        .filter(r => r.status === 'REQUEST')
        .reduce((s,r) => s + r.partySize, 0);
      
      const capacity = (event as any)?.capacity || 230;
      const totalPotential = hardOccupancy + pendingOccupancy;

      return {
          date: targetDate,
          capacity,
          hardOccupancy,
          pendingOccupancy,
          totalPotential,
          isOverbooked: totalPotential > capacity,
          hasEvent: !!event
      };
  }, [selectedDateFilter, activeTab, reservations, allEvents]);

  // --- HELPER: Get Capacity Info per Request ---
  const getRequestCapacityInfo = (res: Reservation) => {
    if (res.status !== 'REQUEST') return null;
    const event = allEvents.find(e => e.date === res.date && e.type === 'SHOW');
    const capacity = (event as any)?.capacity || 230;
    
    const currentHardOccupancy = reservations
      .filter(r => r.date === res.date && ['CONFIRMED', 'OPTION', 'INVITED', 'ARRIVED'].includes(r.status))
      .reduce((s, r) => s + r.partySize, 0);

    const projected = currentHardOccupancy + res.partySize;
    return { currentHardOccupancy, capacity, projected, isOverflow: projected > capacity };
  };

  // --- ACTIONS ---
  const initiateStatusChange = (id: string, newStatus: BookingStatus) => {
    setStatusConfirm({ id, newStatus });
  };

  const confirmStatusChange = () => {
    if (!statusConfirm) return;
    const { id, newStatus } = statusConfirm;
    
    const original = reservations.find(r => r.id === id);
    if (!original) return;

    let updates: Partial<Reservation> = { status: newStatus };
    if (newStatus === BookingStatus.OPTION && !original.optionExpiresAt) {
       const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
       updates.optionExpiresAt = nextWeek.toISOString();
    }

    bookingRepo.update(id, r => ({ ...r, ...updates }));
    logAuditAction('UPDATE_STATUS', 'RESERVATION', id, { description: `Status changed to ${newStatus}` });
    
    if (newStatus === 'CONFIRMED') triggerEmail('BOOKING_CONFIRMED', { type: 'RESERVATION', id, data: { ...original, status: newStatus } });
    
    undoManager.showSuccess(`Status gewijzigd naar ${newStatus}`);
    setStatusConfirm(null);
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
      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center ${quickFilter === id ? 'bg-amber-500 border-amber-500 text-black' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
    >
      {icon} <span className="ml-2">{label}</span>
    </button>
  );

  return (
    <div className="h-full flex flex-col space-y-6 relative">
      
      {/* HEADER AREA */}
      <div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-serif text-white">Reserveringen</h2>
            <p className="text-slate-500 text-sm">Beheer boekingen en aanvragen.</p>
          </div>
          <div className="flex items-center bg-slate-900 p-1.5 rounded-xl border border-slate-800 shadow-lg">
             <Button variant="ghost" className={`h-10 text-xs ${activeTab === 'TODAY' ? 'bg-amber-500 text-black' : 'text-slate-400'}`} onClick={() => { setActiveTab('TODAY'); setSelectedDateFilter(new Date().toISOString().split('T')[0]); }}>Vandaag</Button>
             <div className="h-6 w-px bg-slate-800 mx-2" />
             <div className="relative">
               <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
               <input type="date" className="bg-transparent border-none text-white text-sm pl-9 pr-2 py-2 focus:ring-0 outline-none font-bold" value={selectedDateFilter} onChange={(e) => { setSelectedDateFilter(e.target.value); setActiveTab('AGENDA'); }} />
             </div>
          </div>
        </div>

        {/* TABS & FILTERS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 gap-4 md:gap-0 pb-4">
           <div className="flex space-x-6">
             {[{ id: 'TODAY', label: 'VANDAAG' }, { id: 'AGENDA', label: 'AGENDA' }, { id: 'ATTENTION', label: 'ACTIE VEREIST' }, { id: 'ARCHIVE', label: 'ARCHIEF' }].map(tab => (
               <button key={tab.id} onClick={() => { setActiveTab(tab.id as ViewTab); }} className={`text-xs font-black uppercase tracking-widest pb-4 border-b-2 transition-all ${activeTab === tab.id ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>{tab.label}</button>
             ))}
           </div>
           <div className="flex items-center space-x-3">
              {renderQuickFilter('REQUEST', 'Aanvragen', <Ticket size={14}/>)}
              {renderQuickFilter('VIP', 'VIP', <Star size={14}/>)}
              <div className="w-px h-6 bg-slate-800" />
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                <input className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:border-amber-500 outline-none w-48" placeholder="Zoek gast..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
           </div>
        </div>
      </div>

      {/* BULK ACTION BAR */}
      {selectedIds.size > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center justify-between animate-in slide-in-from-top-2 shadow-xl sticky top-2 z-20">
           <div className="flex items-center space-x-4 pl-2">
              <span className="bg-amber-500 text-black text-xs font-bold px-2 py-1 rounded">{selectedIds.size} geselecteerd</span>
              <div className="h-4 w-px bg-slate-600" />
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-400 hover:text-white">Annuleren</button>
           </div>
           <div className="flex space-x-2">
              <Button onClick={() => handleBulkAction('CONFIRM')} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 border-none shadow-none"><CheckCircle2 size={14} className="mr-2"/> Bevestig Selectie</Button>
              <Button onClick={() => handleBulkAction('CANCEL')} variant="secondary" className="h-8 text-xs border-slate-600 hover:bg-red-900/20 hover:text-red-500 hover:border-red-900"><XCircle size={14} className="mr-2"/> Annuleer</Button>
              <Button onClick={() => handleBulkAction('DELETE')} variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-red-500"><Trash2 size={14}/></Button>
           </div>
        </div>
      )}

      {/* SMART DECISION BAR */}
      {(activeTab === 'AGENDA' || activeTab === 'TODAY') && quickFilter !== 'REQUEST' && dateCapacityStats.hasEvent && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 animate-in fade-in slide-in-from-top-2 shadow-lg">
           <div className="flex justify-between items-end mb-2">
              <h3 className="text-white font-bold text-sm flex items-center"><BarChart3 size={16} className="mr-2 text-amber-500"/> Zaal Bezetting <span className="text-slate-500 ml-2 font-normal text-xs">{new Date(dateCapacityStats.date).toLocaleDateString()}</span></h3>
              <div className="text-right">
                 <span className={`text-xl font-black ${dateCapacityStats.isOverbooked ? 'text-red-500' : 'text-white'}`}>{dateCapacityStats.hardOccupancy} <span className="text-slate-500 text-sm font-normal">vast</span> + {dateCapacityStats.pendingOccupancy} <span className="text-slate-500 text-sm font-normal">aanvraag</span></span>
                 <span className="text-xs text-slate-400 block">Totaal potentieel: <strong>{dateCapacityStats.totalPotential}</strong> / {dateCapacityStats.capacity}</span>
              </div>
           </div>
           <div className="w-full h-4 bg-slate-950 rounded-full overflow-hidden border border-slate-800 flex relative">
              <div className="h-full bg-emerald-600 transition-all duration-500" style={{ width: `${Math.min(100, (dateCapacityStats.hardOccupancy / dateCapacityStats.capacity) * 100)}%` }} />
              <div className="h-full bg-blue-600/60 relative overflow-hidden" style={{ width: `${Math.min(100, (dateCapacityStats.pendingOccupancy / dateCapacityStats.capacity) * 100)}%`, backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }} />
              {dateCapacityStats.isOverbooked && <div className="absolute right-0 top-0 bottom-0 w-2 bg-red-600 animate-pulse" />}
           </div>
        </div>
      )}

      {/* RICH TABLE */}
      <div className="flex-grow bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
         <ResponsiveTable<Reservation>
           data={filteredData}
           keyExtractor={r => r.id}
           onRowClick={setSelectedReservation}
           isVirtual={true}
           virtualHeight="calc(100vh - 350px)"
           columns={[
             { 
               header: (
                 <div className="flex items-center justify-center h-full" onClick={(e) => e.stopPropagation()}>
                   <input type="checkbox" className="rounded bg-slate-900 border-slate-600 checked:bg-amber-500" checked={selectedIds.size > 0 && selectedIds.size === filteredData.length} onChange={toggleSelectAll} />
                 </div>
               ) as any,
               accessor: r => (
                 <div className="flex items-center justify-center h-full" onClick={(e) => e.stopPropagation()}>
                   <input type="checkbox" className="rounded bg-slate-900 border-slate-600 checked:bg-amber-500" checked={selectedIds.has(r.id)} onChange={() => toggleSelection(r.id)} />
                 </div>
               ),
               className: 'w-12 text-center'
             },
             { 
               header: 'Wanneer', 
               accessor: r => (
                 <div className="flex flex-col">
                    <span className="font-bold text-white text-sm">{new Date(r.date).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                    <span className="font-mono text-slate-500 text-xs">{r.startTime || '19:30'}</span>
                 </div>
               ),
               className: 'w-24'
             },
             { 
               header: 'Gast & Details', 
               accessor: r => (
                 <div>
                   <div className="flex items-center space-x-2">
                     <span className="font-bold text-white">{formatGuestName(r.customer.firstName, r.customer.lastName)}</span>
                     {r.customer.companyName && <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">{r.customer.companyName}</span>}
                   </div>
                   <div className="flex gap-2 mt-1">
                      <span className="text-xs text-slate-500 font-mono bg-black/30 px-1.5 rounded">{r.id}</span>
                      {r.packageType === 'premium' && <span className="text-[10px] bg-amber-900/20 text-amber-500 border border-amber-900/50 px-1.5 rounded font-bold flex items-center">VIP</span>}
                      {r.addons.some(a => a.id.includes('pre')) && <span className="text-[10px] bg-blue-900/20 text-blue-400 border border-blue-900/50 px-1.5 rounded font-bold flex items-center"><Coffee size={8} className="mr-1"/> PRE</span>}
                      {r.addons.some(a => a.id.includes('after')) && <span className="text-[10px] bg-purple-900/20 text-purple-400 border border-purple-900/50 px-1.5 rounded font-bold flex items-center"><Music size={8} className="mr-1"/> AFTER</span>}
                      {r.merchandise.length > 0 && <span className="text-[10px] bg-emerald-900/20 text-emerald-400 border border-emerald-900/50 px-1.5 rounded font-bold flex items-center"><ShoppingBag size={8} className="mr-1"/> SHOP</span>}
                   </div>
                   {r.status === 'CONFIRMED' && !r.packageType && <div className="mt-1 text-[10px] text-red-500 font-bold bg-red-900/10 px-1.5 py-0.5 rounded inline-flex items-center animate-pulse"><AlertOctagon size={10} className="mr-1"/> ⚠️ INCOMPLEET</div>}
                 </div>
               )
             },
             { 
               header: 'Pax & Impact', 
               accessor: r => {
                 const capInfo = getRequestCapacityInfo(r);
                 return (
                   <div className="flex flex-col items-center">
                     <span className="font-bold text-lg text-white block">{r.partySize}p</span>
                     {capInfo && (
                        <div className={`mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded border flex flex-col items-center w-24 ${capInfo.isOverflow ? 'bg-red-900/20 text-red-400 border-red-900/50' : 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50'}`}>
                           <span>{capInfo.projected} / {capInfo.capacity}</span>
                           <span className="text-[8px] opacity-70 uppercase tracking-tight">{capInfo.isOverflow ? 'VOL!' : 'PAST'}</span>
                        </div>
                     )}
                   </div>
                 );
               },
               className: 'w-24 text-center'
             },
             { 
                header: 'Financieel',
                accessor: r => (
                  <div className="text-right">
                    <span className="block font-mono font-bold text-slate-300">€{r.financials.finalTotal.toFixed(0)}</span>
                    {!r.financials.isPaid && r.status !== 'CANCELLED' && <span className="text-[10px] text-red-400 font-bold">OPEN</span>}
                    {r.financials.isPaid && <span className="text-[10px] text-emerald-500 font-bold">BETAALD</span>}
                  </div>
                ),
                className: 'w-24 text-right'
             },
             { 
               header: 'Status', 
               accessor: r => (
                 <div onClick={(e) => e.stopPropagation()}>
                   <select 
                     className={`bg-slate-950 border border-slate-700 rounded text-xs font-bold py-1 px-2 uppercase cursor-pointer outline-none focus:border-amber-500 ${r.status === 'CONFIRMED' ? 'text-emerald-500' : r.status === 'REQUEST' ? 'text-blue-500' : r.status === 'CANCELLED' ? 'text-red-500' : 'text-amber-500'}`}
                     value={r.status}
                     onChange={(e) => initiateStatusChange(r.id, e.target.value as BookingStatus)}
                   >
                     <option value="REQUEST">REQUEST</option>
                     <option value="OPTION">OPTION</option>
                     <option value="CONFIRMED">CONFIRMED</option>
                     <option value="CANCELLED">CANCELLED</option>
                   </select>
                 </div>
               ),
               className: 'w-32'
             }
           ]}
         />
      </div>

      {/* --- CONFIRMATION MODAL FOR STATUS CHANGE --- */}
      <DestructiveActionModal 
        isOpen={!!statusConfirm}
        onClose={() => setStatusConfirm(null)}
        onConfirm={confirmStatusChange}
        title="Status Wijzigen"
        description={<div><p className="mb-2">Weet u zeker dat u de status wilt wijzigen naar <strong>{statusConfirm?.newStatus}</strong>?</p></div>}
        verificationText={statusConfirm?.newStatus || ""}
        confirmButtonText="Wijzig Status"
        requireVerification={statusConfirm?.newStatus !== BookingStatus.CONFIRMED}
      />

      {/* --- BULK CONFIRM MODAL --- */}
      <DestructiveActionModal 
        isOpen={!!bulkAction}
        onClose={() => setBulkAction(null)}
        onConfirm={executeBulkAction}
        title={`Bulk ${bulkAction?.type === 'CONFIRM' ? 'Bevestigen' : bulkAction?.type === 'CANCEL' ? 'Annuleren' : 'Verwijderen'}`}
        description={
            <div>
                <p>U staat op het punt om <strong>{bulkAction?.count}</strong> reserveringen te verwerken.</p>
                {bulkAction?.type === 'CONFIRM' && <div className="mt-2 bg-emerald-900/20 p-2 rounded text-emerald-400 text-xs">Er worden {bulkAction.count} bevestigingsmails verstuurd.</div>}
            </div>
        }
        verificationText={bulkAction?.type || ""}
        confirmButtonText="Start Bulk Verwerking"
        requireVerification={bulkAction?.type !== 'CONFIRM'}
      />

      {/* --- DETAIL DRAWER --- */}
      <ResponsiveDrawer
        isOpen={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
        title="Reservering Details"
      >
        {selectedReservation && (
          <div className="space-y-6 pb-12">
             <div className="flex border-b border-slate-800 mb-4">
                <button onClick={() => setDetailTab('DETAILS')} className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${detailTab === 'DETAILS' ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Details</button>
                <button onClick={() => setDetailTab('HISTORY')} className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${detailTab === 'HISTORY' ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Geschiedenis</button>
             </div>

             {detailTab === 'HISTORY' && <AuditTimeline entityId={selectedReservation.id} />}

             {detailTab === 'DETAILS' && (
               <div className="space-y-8 animate-in fade-in">
                 <div className="grid grid-cols-2 gap-4 relative group">
                      <Button variant="secondary" onClick={() => setShowFullEditModal(true)} className="absolute top-2 right-2 h-8 px-3 z-10 bg-slate-800 hover:bg-amber-500 hover:text-black border-slate-700 transition-colors flex items-center text-xs"><Edit3 size={12} className="mr-1"/> Bewerken</Button>
                      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                          <p className="text-xs font-bold text-slate-500 uppercase">Klant</p>
                          <p className="font-bold text-white text-lg">{selectedReservation.customer.salutation} {formatGuestName(selectedReservation.customer.firstName, selectedReservation.customer.lastName)}</p>
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

                 {isEditingPrice ? (
                   <PriceOverridePanel reservation={selectedReservation} onSave={(override) => { const updated = { ...selectedReservation, adminPriceOverride: override }; bookingRepo.update(selectedReservation.id, () => updated); setIsEditingPrice(false); refreshData(); }} onCancel={() => setIsEditingPrice(false)} />
                 ) : (
                   <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-400">Totaalbedrag</span>
                        <div className="flex items-baseline space-x-2">
                          <span className="text-xl font-mono text-white">€{(selectedReservation.financials.finalTotal || 0).toFixed(2)}</span>
                          {selectedReservation.adminPriceOverride && <Badge status="OPTION" className="scale-75 origin-left">Aangepast</Badge>}
                        </div>
                        {selectedReservation.financials.isPaid ? <span className="text-xs text-emerald-500 font-bold mt-1">Betaald via {selectedReservation.financials.paymentMethod || 'Onbekend'}</span> : <span className="text-xs text-red-500 font-bold mt-1">Nog te betalen</span>}
                      </div>
                      <div className="flex space-x-2">
                        {!selectedReservation.financials.isPaid && <Button className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 border-none" onClick={() => setShowPaymentModal(true)}>Betalen</Button>}
                        <Button variant="ghost" onClick={() => setIsEditingPrice(true)} className="h-8 text-xs px-2">Aanpassen</Button>
                      </div>
                   </div>
                 )}

                 <div className="pt-4 border-t border-slate-800">
                    <Button variant="ghost" onClick={() => setShowDeleteModal(true)} className="w-full text-red-500 hover:bg-red-900/20 hover:text-red-400"><Trash2 size={16} className="mr-2" /> Verplaats naar Prullenbak</Button>
                 </div>
               </div>
             )}
          </div>
        )}
      </ResponsiveDrawer>

      {showFullEditModal && selectedReservation && <EditReservationModal reservation={selectedReservation} onClose={() => setShowFullEditModal(false)} onSave={refreshData} />}
      {showDeleteModal && selectedReservation && <DestructiveActionModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={executeDelete} title="Verplaats naar Prullenbak" description={<p>Weet je zeker dat je de reservering van <strong>{selectedReservation.customer.lastName}</strong> wilt verwijderen?</p>} verificationText="VERWIJDER" confirmButtonText="Verwijderen" />}
    </div>
  );
};
