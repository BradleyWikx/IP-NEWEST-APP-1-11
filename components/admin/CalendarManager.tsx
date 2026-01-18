
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCalendarLogic } from '../../hooks/useCalendarLogic';
import { 
  CalendarHeader, CalendarGrid, CalendarAgenda 
} from '../calendar/CalendarComponents';
import { ResponsiveDrawer, Button, Input, Card, Badge } from '../UI';
import { 
  Plus, X, Trash2, Save, Layers, Edit3, Calendar as CalIcon, 
  CheckCircle2, Copy, AlertTriangle, ArrowRight, Repeat, Users, Lock, Mic, Ticket,
  ChevronLeft, ChevronRight, Check, ListPlus, FileText, DollarSign, Settings,
  List, Clock, XCircle, MoreHorizontal, Mail, UserPlus, Eye, PieChart, Filter
} from 'lucide-react';
import { ShowDefinition, ShowEvent, CalendarEvent, EventType, RehearsalEvent, PrivateEvent, BlackoutEvent, PrivateEventPreferences, Reservation, WaitlistEntry, BookingStatus } from '../../types';
import { getShowDefinitions, getCalendarEvents, saveData, STORAGE_KEYS, calendarRepo, bookingRepo, waitlistRepo, getShows } from '../../utils/storage';
import { logAuditAction } from '../../utils/auditLogger';
import { triggerEmail } from '../../utils/emailEngine';
import { PreferencesForm } from './PreferencesForm';
import { BulkReservationEditor } from './BulkReservationEditor';
import { toLocalISOString } from '../../utils/dateHelpers';
import { undoManager } from '../../utils/undoManager';
import { WaitlistModal } from '../WaitlistModal';
import { CalendarBulkWizard } from './CalendarBulkWizard';
import { DestructiveActionModal } from '../UI/DestructiveActionModal';
import { calculateBookingTotals, getEffectivePricing } from '../../utils/pricing';

// --- Types & Constants ---

type DetailTab = 'OVERVIEW' | 'BOOKINGS' | 'WAITLIST';
type FilterType = 'ALL' | 'SHOW' | 'PRIVATE' | 'BLACKOUT';

const WEEKDAYS_SHORT = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

// --- Helper Components ---

const StatCard = ({ label, value, sub, icon: Icon, color }: any) => (
  <div className={`p-4 rounded-2xl border bg-slate-900/50 flex items-center space-x-4 ${color === 'amber' ? 'border-amber-500/30' : color === 'blue' ? 'border-blue-500/30' : 'border-emerald-500/30'}`}>
    <div className={`p-3 rounded-xl ${color === 'amber' ? 'bg-amber-500/10 text-amber-500' : color === 'blue' ? 'bg-blue-500/10 text-blue-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
      <Icon size={24} />
    </div>
    <div>
      <p className={`text-[10px] uppercase font-bold text-slate-500 tracking-widest`}>{label}</p>
      <p className="text-2xl font-serif text-white leading-none mt-1">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-1">{sub}</p>}
    </div>
  </div>
);

export const CalendarManager = () => {
  // Use ADMIN mode to see all event types
  const { currentMonth, navigateMonth, calendarDays, viewMode, setViewMode, refreshData, isDense, setIsDense } = useCalendarLogic(undefined, 'ADMIN');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [shows, setShows] = useState<ShowDefinition[]>([]);
  
  // Local Data for Drawer
  const [dayReservations, setDayReservations] = useState<Reservation[]>([]);
  const [dayWaitlist, setDayWaitlist] = useState<WaitlistEntry[]>([]);
  const [dayCancelled, setDayCancelled] = useState<Reservation[]>([]);
  
  // Selection State (Main Calendar)
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  
  // Single Editor State
  const [selectedDay, setSelectedDay] = useState<any>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>('OVERVIEW');
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editFormData, setEditFormData] = useState<any>(null);
  const [showAddWaitlist, setShowAddWaitlist] = useState(false);
  const [waitlistEntryToConvert, setWaitlistEntryToConvert] = useState<WaitlistEntry | null>(null);
  
  // Bulk Wizard State
  const [isBulkWizardOpen, setIsBulkWizardOpen] = useState(false);
  const [isBulkBookingOpen, setIsBulkBookingOpen] = useState(false);
  const [bulkTargetDates, setBulkTargetDates] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    setShows(getShowDefinitions());
  }, []);

  useEffect(() => {
    if (selectedDay && selectedDay.dateStr) {
      const allRes = bookingRepo.getAll(true); // Include archived for cancelled tab
      const allWL = waitlistRepo.getAll();

      // Filter Active
      const relevant = allRes.filter(r => r.date === selectedDay.dateStr && r.status !== 'CANCELLED' && r.status !== 'ARCHIVED' && r.status !== 'WAITLIST');
      setDayReservations(relevant);

      // Filter Waitlist
      const wl = allWL.filter(w => w.date === selectedDay.dateStr && w.status === 'PENDING');
      setDayWaitlist(wl);

      // Filter Cancelled
      const cx = allRes.filter(r => r.date === selectedDay.dateStr && r.status === 'CANCELLED');
      setDayCancelled(cx);
      
      // Reset edit state when day changes
      setIsEditingEvent(false);
      setEditFormData(null);
      setActiveDetailTab('OVERVIEW');
      setShowAddWaitlist(false);
    }
  }, [selectedDay, refreshData]);

  // --- Logic: Month Stats ---
  const monthStats = useMemo(() => {
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
    // Get visible days (approx)
    const visibleEvents = calendarRepo.getAll().filter(e => {
        const d = new Date(e.date);
        return d >= startOfMonth && d <= endOfMonth;
    });

    const showCount = visibleEvents.filter(e => e.type === 'SHOW').length;
    const privateCount = visibleEvents.filter(e => e.type === 'PRIVATE_EVENT').length;
    
    // Calculate total guests & revenue for this month
    const allRes = bookingRepo.getAll();
    const monthRes = allRes.filter(r => {
        const d = new Date(r.date);
        return d >= startOfMonth && d <= endOfMonth && r.status !== 'CANCELLED';
    });

    const totalGuests = monthRes.reduce((s, r) => s + r.partySize, 0);
    const totalRevenue = monthRes.reduce((s, r) => s + (r.financials.finalTotal || 0), 0);

    return { showCount, privateCount, totalGuests, totalRevenue };
  }, [currentMonth, calendarDays]); // Re-calc on navigation or refresh

  // --- Logic: Filtering ---
  const filteredDays = useMemo(() => {
    if (activeFilter === 'ALL') return calendarDays;
    return calendarDays.map(day => {
        if (!day.event) return day;
        // If filter mismatch, strip event from view (keeping date tile)
        if (activeFilter === 'SHOW' && day.event.type !== 'SHOW') return { ...day, event: undefined };
        if (activeFilter === 'PRIVATE' && day.event.type !== 'PRIVATE_EVENT') return { ...day, event: undefined };
        if (activeFilter === 'BLACKOUT' && day.event.type !== 'BLACKOUT') return { ...day, event: undefined };
        return day;
    });
  }, [calendarDays, activeFilter]);

  // --- Logic: Single Event Editing ---

  const handleDayClick = (day: any) => {
    if (isSelectMode) {
      const newSet = new Set(selectedDates);
      if (newSet.has(day.dateStr)) newSet.delete(day.dateStr);
      else newSet.add(day.dateStr);
      setSelectedDates(newSet);
    } else {
      setSelectedDay(day);
    }
  };

  const handleStartEdit = () => {
    if (!selectedDay?.event) return;
    setEditFormData(JSON.parse(JSON.stringify(selectedDay.event)));
    setIsEditingEvent(true);
  };

  const handleSaveEvent = () => {
    if (!editFormData) return;
    
    // Strip computed fields to prevent stale data storage
    const { bookedCount, ...cleanData } = editFormData;
    
    calendarRepo.update(cleanData.id, () => cleanData);
    logAuditAction('UPDATE_EVENT', 'CALENDAR', cleanData.id, { description: `Updated event details for ${cleanData.date}` });
    undoManager.showSuccess("Event opgeslagen.");
    refreshData();
    setIsEditingEvent(false);
    setSelectedDay(null);
  };

  const handleDeleteEvent = () => {
    const idToDelete = editFormData?.id || selectedDay?.event?.id;
    if (!idToDelete) return;
    if (window.confirm('Weet je zeker dat je dit evenement wilt verwijderen?')) {
      calendarRepo.delete(idToDelete);
      logAuditAction('DELETE_EVENT', 'CALENDAR', idToDelete, { description: `Deleted event ${idToDelete}` });
      undoManager.showSuccess("Event verwijderd.");
      setIsEditingEvent(false);
      setEditFormData(null);
      setSelectedDay(null);
      refreshData();
    }
  };

  const confirmWaitlistConvert = () => {
    if (!waitlistEntryToConvert || !selectedDay?.event) return;
    
    const entry = waitlistEntryToConvert;
    
    // Resolve Pricing
    const show = getShows().find(s => s.id === selectedDay.event.showId);
    let totals: any = { subtotal: 0, amountDue: 0 };
    
    if (show) {
        const pricing = getEffectivePricing(selectedDay.event, show);
        totals = calculateBookingTotals({
            totalGuests: entry.partySize,
            packageType: 'standard',
            addons: [],
            merchandise: [],
            date: entry.date,
            showId: show.id
        }, pricing);
    }

    // Create new reservation
    const newRes: Reservation = {
        id: `RES-WL-${Date.now()}`,
        createdAt: new Date().toISOString(),
        customerId: entry.customerId,
        customer: { id: entry.customerId, firstName: entry.contactName.split(' ')[0], lastName: entry.contactName.split(' ').slice(1).join(' ') || 'Gast', email: entry.contactEmail, phone: entry.contactPhone || '' },
        date: entry.date,
        showId: selectedDay.event.showId || 'unknown',
        status: BookingStatus.CONFIRMED, // DIRECT CONFIRM
        partySize: entry.partySize,
        packageType: 'standard',
        addons: [], merchandise: [],
        financials: { 
            total: totals.subtotal || 0, 
            subtotal: totals.subtotal || 0, 
            discount: 0, 
            finalTotal: totals.amountDue || 0, 
            paid: 0, 
            isPaid: false,
            paymentDueAt: new Date(new Date().setDate(new Date().getDate() + 14)).toISOString()
        },
        notes: { internal: `Converted from waitlist (${entry.notes || '-'})` },
        startTime: selectedDay.event.times?.start || '19:30'
    };
    
    bookingRepo.add(newRes);
    waitlistRepo.delete(entry.id);
    
    // AUDIT
    logAuditAction('CONVERT_WAITLIST', 'RESERVATION', newRes.id, { description: 'Manual conversion from Calendar' });
    
    // EMAIL
    triggerEmail('BOOKING_CONFIRMED', { type: 'RESERVATION', id: newRes.id, data: newRes });

    undoManager.showSuccess("Wachtende geplaatst en bevestigd!");
    setWaitlistEntryToConvert(null);
    refreshData();
  };

  // --- Logic: Bulk Operations ---
  const openBulkWizard = (fromSelection = false) => {
    setBulkTargetDates(fromSelection && selectedDates.size > 0 ? new Set(selectedDates) : new Set());
    setIsBulkWizardOpen(true);
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-8 space-y-6 relative">
      
      {/* 1. Header & Controls */}
      <div className="flex flex-col xl:flex-row justify-between xl:items-end gap-6">
        <div>
          <h2 className="text-3xl font-serif text-white">Agenda Beheer</h2>
          <p className="text-slate-500 text-sm">Beheer de programmering en capaciteit.</p>
        </div>

        {/* Month Stats Bar */}
        <div className="grid grid-cols-3 gap-3 flex-grow max-w-3xl">
           <StatCard label="Shows" value={monthStats.showCount} sub={`${monthStats.privateCount} Privé`} icon={Layers} color="blue" />
           <StatCard label="Gasten" value={monthStats.totalGuests} sub="Deze maand" icon={Users} color="amber" />
           <StatCard label="Omzet (Est.)" value={`€${(monthStats.totalRevenue/1000).toFixed(1)}k`} sub="Ticketverkoop" icon={DollarSign} color="emerald" />
        </div>

        <div className="flex space-x-2">
           <Button variant="secondary" onClick={() => openBulkWizard(false)} className="flex items-center bg-slate-800 border-slate-700 hover:bg-slate-700">
             <Layers size={18} className="mr-2" /> Bulk Planner
           </Button>
        </div>
      </div>

      {/* 2. Calendar Toolbar */}
      <div className="bg-slate-900/50 p-2 rounded-2xl border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
         <CalendarHeader 
            currentMonth={currentMonth} 
            onPrev={() => navigateMonth(-1)} 
            onNext={() => navigateMonth(1)}
            viewMode={viewMode}
            onViewChange={setViewMode}
            isDense={isDense}
            onToggleDense={() => setIsDense(!isDense)}
            isBulkMode={isSelectMode}
            onToggleBulk={() => {
              if (isSelectMode && selectedDates.size > 0) openBulkWizard(true);
              else setIsSelectMode(!isSelectMode);
            }}
         />
         
         {/* Filter Toggles */}
         <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'ALL', label: 'Alles' },
              { id: 'SHOW', label: 'Shows' },
              { id: 'PRIVATE', label: 'Privé' },
              { id: 'BLACKOUT', label: 'Gesloten' }
            ].map((f) => (
              <button 
                key={f.id}
                onClick={() => setActiveFilter(f.id as FilterType)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeFilter === f.id ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {f.label}
              </button>
            ))}
         </div>
      </div>
      
      {/* 3. Calendar View */}
      <div className="flex-grow overflow-y-auto custom-scrollbar pb-24 rounded-2xl border border-slate-800 bg-slate-950/30">
        {viewMode === 'GRID' ? (
          <CalendarGrid 
            days={filteredDays} 
            onDayClick={handleDayClick} 
            isAdmin={true} 
            isDense={isDense} 
            isBulkMode={isSelectMode}
            selectedDates={selectedDates}
          />
        ) : (
          <CalendarAgenda days={filteredDays} onDayClick={handleDayClick} isAdmin={true} />
        )}
      </div>

      {/* --- DAY DETAIL SUPER DRAWER --- */}
      <ResponsiveDrawer
        isOpen={!!selectedDay}
        onClose={() => { setSelectedDay(null); setIsEditingEvent(false); }}
        title={isEditingEvent ? 'Event Bewerken' : (selectedDay?.dateStr ? `${new Date(selectedDay.dateStr).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}` : 'Detail')}
        widthClass="md:w-[800px]"
      >
        <div className="space-y-8 pb-12">
           
           {/* EDIT MODE FORM */}
           {isEditingEvent && editFormData ? (
             <div className="space-y-6 animate-in fade-in">
               <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                  <Input label="Titel" value={editFormData.title} onChange={(e: any) => setEditFormData({...editFormData, title: e.target.value})} />
                  <div className="grid grid-cols-2 gap-4">
                     <Input label="Capaciteit" type="number" value={editFormData.capacity} onChange={(e: any) => setEditFormData({...editFormData, capacity: parseInt(e.target.value)})} />
                     <div className="space-y-1.5">
                       <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Status</label>
                       <select 
                         className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500"
                         value={editFormData.status}
                         onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                       >
                         <option value="OPEN">Open</option>
                         <option value="WAITLIST">Wachtlijst</option>
                         <option value="CLOSED">Gesloten</option>
                       </select>
                     </div>
                  </div>
               </div>
               <div className="flex gap-4 pt-6 border-t border-slate-800">
                 <Button variant="ghost" onClick={handleDeleteEvent} className="flex-1 text-red-500 hover:bg-red-900/20 hover:text-red-400">Verwijder Event</Button>
                 <div className="flex-grow"></div>
                 <Button variant="ghost" onClick={() => setIsEditingEvent(false)}>Annuleren</Button>
                 <Button onClick={handleSaveEvent} className="bg-emerald-600 hover:bg-emerald-700">Opslaan</Button>
               </div>
             </div>
           ) : (
             <>
               {/* 1. HERO HEADER */}
               <div className={`p-8 rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[180px] ${selectedDay?.event?.status === 'CLOSED' ? 'bg-red-950 border border-red-900' : 'bg-slate-900 border border-slate-800'}`}>
                 {/* Background Effect */}
                 <div className="absolute top-0 right-0 p-8 opacity-5">
                    {selectedDay?.event?.type === 'SHOW' ? <Ticket size={120} /> : <Lock size={120} />}
                 </div>
                 
                 <div className="relative z-10">
                    <div className="flex justify-between items-start mb-2">
                       <Badge status={selectedDay?.event?.status || 'CLOSED'} className="shadow-lg">{selectedDay?.event?.status}</Badge>
                       <Button variant="secondary" onClick={handleStartEdit} className="h-8 text-xs bg-black/20 hover:bg-black/40 border-white/10 text-white">
                         <Settings size={14} className="mr-2"/> Instellingen
                       </Button>
                    </div>
                    <h3 className="text-3xl font-serif font-bold text-white mb-1">{selectedDay?.event?.title || 'Geen Event'}</h3>
                    {selectedDay?.event?.type === 'SHOW' && (
                       <p className="text-slate-400 text-sm flex items-center">
                         <Clock size={14} className="mr-2"/> {selectedDay.event.times?.start} Aanvang &bull; Deur {selectedDay.event.times?.doorsOpen}
                       </p>
                    )}
                 </div>

                 {/* Capacity Bar in Hero */}
                 {selectedDay?.event?.type === 'SHOW' && (
                   <div className="relative z-10 mt-6">
                      <div className="flex justify-between text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                         <span>Bezetting</span>
                         <span>{dayReservations.reduce((s,r)=>s+r.partySize,0)} / {selectedDay.event.capacity}</span>
                      </div>
                      <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden backdrop-blur-sm">
                         <div 
                           className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]" 
                           style={{ width: `${Math.min(100, (dayReservations.reduce((s,r)=>s+r.partySize,0) / selectedDay.event.capacity) * 100)}%` }} 
                         />
                      </div>
                   </div>
                 )}
               </div>

               {/* 2. TABS & CONTENT */}
               {selectedDay?.event?.type === 'SHOW' && (
                 <div className="space-y-6">
                    {/* Tab Navigation */}
                    <div className="flex p-1 bg-slate-900 rounded-xl border border-slate-800">
                       {[
                         { id: 'OVERVIEW', label: 'Overzicht', icon: PieChart },
                         { id: 'BOOKINGS', label: `Boekingen (${dayReservations.length})`, icon: List },
                         { id: 'WAITLIST', label: `Wachtlijst (${dayWaitlist.length})`, icon: Clock },
                       ].map(tab => (
                         <button
                           key={tab.id}
                           onClick={() => setActiveDetailTab(tab.id as DetailTab)}
                           className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center transition-all ${activeDetailTab === tab.id ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                         >
                           <tab.icon size={14} className="mr-2" /> {tab.label}
                         </button>
                       ))}
                    </div>

                    {/* Content Area */}
                    <div className="min-h-[300px]">
                       
                       {/* OVERVIEW TAB */}
                       {activeDetailTab === 'OVERVIEW' && (
                         <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2">
                            <div onClick={() => setIsBulkBookingOpen(true)} className="col-span-2 p-4 bg-blue-900/10 border border-blue-900/30 rounded-xl flex items-center justify-between cursor-pointer hover:bg-blue-900/20 transition-colors group">
                               <div className="flex items-center space-x-3">
                                  <div className="p-2 bg-blue-500 rounded-lg text-black group-hover:scale-110 transition-transform"><Plus size={20}/></div>
                                  <div>
                                     <h4 className="font-bold text-white">Snel Boeken</h4>
                                     <p className="text-xs text-blue-200">Voeg handmatig reserveringen toe (Bulk).</p>
                                  </div>
                               </div>
                               <ChevronRight className="text-blue-500"/>
                            </div>

                            <Card className="p-4 bg-slate-900 border-slate-800 flex flex-col justify-center items-center text-center">
                               <p className="text-[10px] uppercase font-bold text-slate-500">Verwachte Omzet</p>
                               <p className="text-2xl font-serif text-white mt-1">€{dayReservations.reduce((s,r)=>s+(r.financials.finalTotal||0),0).toLocaleString()}</p>
                            </Card>
                            
                            <Card className="p-4 bg-slate-900 border-slate-800 flex flex-col justify-center items-center text-center">
                               <p className="text-[10px] uppercase font-bold text-slate-500">Premium Gasten</p>
                               <p className="text-2xl font-serif text-amber-500 mt-1">{dayReservations.filter(r=>r.packageType==='premium').reduce((s,r)=>s+r.partySize,0)}</p>
                            </Card>

                            <div className="col-span-2 mt-4">
                               <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Recente Activiteit</h4>
                               <div className="space-y-2">
                                  {dayReservations.slice(0,3).map(r => (
                                    <div key={r.id} className="flex justify-between items-center text-sm p-2 rounded hover:bg-slate-900/50">
                                       <span className="text-slate-300">Nieuwe boeking: <strong>{r.customer.lastName}</strong> ({r.partySize}p)</span>
                                       <span className="text-slate-500 text-[10px]">{new Date(r.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                    </div>
                                  ))}
                                  {dayReservations.length === 0 && <p className="text-xs text-slate-500 italic">Nog geen boekingen.</p>}
                               </div>
                            </div>
                         </div>
                       )}

                       {/* BOOKINGS TAB */}
                       {activeDetailTab === 'BOOKINGS' && (
                         <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
                           <div className="flex justify-between items-center mb-2 px-1">
                              <span className="text-xs font-bold text-slate-500 uppercase">Lijstweergave</span>
                              <Button variant="secondary" onClick={() => setIsBulkBookingOpen(true)} className="h-7 text-[10px] px-2">
                                <Plus size={12} className="mr-1"/> Toevoegen
                              </Button>
                           </div>
                           {dayReservations.map(r => (
                             <div 
                               key={r.id} 
                               onClick={() => navigate(`/admin/reservations?open=${r.id}`)}
                               className="flex justify-between items-center p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl cursor-pointer group transition-all"
                             >
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 rounded-full bg-slate-950 flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-800">
                                    {r.partySize}
                                  </div>
                                  <div>
                                    <p className="font-bold text-white text-sm group-hover:text-amber-500 transition-colors">{r.customer.lastName}, {r.customer.firstName}</p>
                                    <p className="text-[10px] text-slate-500 font-mono">{r.id}</p>
                                  </div>
                                </div>
                                <Badge status={r.status} className="scale-75 origin-right">{r.status}</Badge>
                             </div>
                           ))}
                           {dayReservations.length === 0 && (
                             <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                               <CalIcon size={24} className="mx-auto mb-2 opacity-50" />
                               <p className="text-xs">Nog geen reserveringen.</p>
                             </div>
                           )}
                         </div>
                       )}

                       {/* WAITLIST TAB */}
                       {activeDetailTab === 'WAITLIST' && (
                         <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                           <div className="flex justify-between items-center bg-amber-900/10 p-3 rounded-xl border border-amber-900/30 mb-4">
                              <div className="flex items-center text-amber-500">
                                <Clock size={16} className="mr-2" />
                                <span className="text-xs font-bold uppercase">Wachtlijst: {dayWaitlist.reduce((s,w)=>s+w.partySize,0)} pax</span>
                              </div>
                              <Button variant="secondary" onClick={() => setShowAddWaitlist(true)} className="text-xs h-7 px-2 bg-slate-900 border-slate-800">
                                <Plus size={12} className="mr-1"/> Handmatig
                              </Button>
                           </div>

                           {dayWaitlist.map(w => (
                             <div key={w.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex justify-between items-center group hover:border-amber-500/30 transition-colors">
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <p className="font-bold text-white text-sm">{w.contactName}</p>
                                    <span className="bg-slate-950 text-slate-400 text-[10px] px-1.5 py-0.5 rounded border border-slate-800 font-bold">{w.partySize}p</span>
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1">
                                    {w.contactEmail} &bull; {new Date(w.requestDate).toLocaleDateString()}
                                  </div>
                                </div>
                                <Button 
                                  onClick={() => setWaitlistEntryToConvert(w)}
                                  className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white border-none text-[10px] font-bold uppercase tracking-wider shadow-lg"
                                >
                                  Plaatsen
                                </Button>
                             </div>
                           ))}
                           {dayWaitlist.length === 0 && <p className="text-center text-slate-500 italic py-8">Wachtlijst is leeg.</p>}
                         </div>
                       )}
                    </div>
                 </div>
               )}

               {!selectedDay?.event?.type && (
                 <div className="text-center p-12 border-2 border-dashed border-slate-800 rounded-xl text-slate-500">
                   <p className="text-sm font-bold text-white mb-1">Geen event op deze dag.</p>
                   <p className="text-xs mb-4">Plan een show of evenement in.</p>
                   <Button onClick={() => openBulkWizard(true)} className="bg-amber-500 text-black hover:bg-amber-400">
                     Event Aanmaken
                   </Button>
                 </div>
               )}
             </>
           )}
        </div>
      </ResponsiveDrawer>

      {/* Manual Waitlist Add Modal */}
      {showAddWaitlist && selectedDay?.dateStr && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
           <WaitlistModal 
             date={selectedDay.dateStr}
             onClose={() => { setShowAddWaitlist(false); refreshData(); }}
           />
        </div>
      )}

      {/* Bulk Wizard Drawer */}
      {isBulkWizardOpen && (
        <ResponsiveDrawer
          isOpen={isBulkWizardOpen}
          onClose={() => setIsBulkWizardOpen(false)}
          title="Bulk Planner"
          widthClass="md:w-[700px]"
        >
           <CalendarBulkWizard 
             onClose={() => setIsBulkWizardOpen(false)}
             onSuccess={() => {
                setIsBulkWizardOpen(false);
                refreshData();
             }}
             preselectedDates={Array.from(bulkTargetDates)}
           />
        </ResponsiveDrawer>
      )}

      {/* Bulk Res Editor */}
      {isBulkBookingOpen && selectedDay?.event && selectedDay?.show && (
        <BulkReservationEditor 
          event={selectedDay.event}
          show={selectedDay.show}
          onClose={() => setIsBulkBookingOpen(false)}
          onSuccess={() => {
            setIsBulkBookingOpen(false);
            setSelectedDay(null);
            refreshData();
          }}
        />
      )}

      {/* CONFIRMATION MODAL FOR WAITLIST CONVERT */}
      <DestructiveActionModal
        isOpen={!!waitlistEntryToConvert}
        onClose={() => setWaitlistEntryToConvert(null)}
        onConfirm={confirmWaitlistConvert}
        title="Bevestig Plaatsing"
        description={
            <div className="space-y-2">
                <p>Weet je zeker dat je <strong>{waitlistEntryToConvert?.contactName}</strong> wilt omzetten naar een definitieve boeking?</p>
                <div className="p-3 bg-emerald-900/20 border border-emerald-900/50 rounded-lg text-sm text-emerald-200">
                    <ul className="list-disc pl-4 space-y-1">
                        <li>Status wordt <strong>BEVESTIGD</strong></li>
                        <li>Bevestigingsmail wordt verstuurd</li>
                        <li>Wachtlijst item wordt verwijderd</li>
                    </ul>
                </div>
            </div>
        }
        verificationText="PLAATSEN"
        confirmButtonText="Definitief Boeken"
        requireVerification={false}
      />

    </div>
  );
};
