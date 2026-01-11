
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
  ChevronLeft, ChevronRight, Check, ListPlus, FileText, DollarSign, Settings
} from 'lucide-react';
import { EventDate, ShowDefinition, ShowEvent, CalendarEvent, EventType, RehearsalEvent, PrivateEvent, BlackoutEvent, PrivateEventPreferences, Reservation } from '../../types';
import { getShowDefinitions, getCalendarEvents, saveData, STORAGE_KEYS, calendarRepo, bookingRepo } from '../../utils/storage';
import { logAuditAction } from '../../utils/auditLogger';
import { PreferencesForm } from './PreferencesForm';
import { BulkReservationEditor } from './BulkReservationEditor';

// --- Types & Constants ---

type BulkEventType = 'SHOW' | 'REHEARSAL' | 'PRIVATE' | 'BLACKOUT';

const WEEKDAYS_SHORT = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];

// Default Prefs
const DEFAULT_PREFS: PrivateEventPreferences = {
  occasionType: 'COMPANY',
  barType: 'STANDARD',
  techConfig: { mic: false, music: false, lights: false, projector: false }
};

export const CalendarManager = () => {
  // Use ADMIN mode to see all event types
  const { currentMonth, navigateMonth, calendarDays, viewMode, setViewMode, refreshData, isDense, setIsDense } = useCalendarLogic(undefined, 'ADMIN');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [shows, setShows] = useState<ShowDefinition[]>([]);
  const [dayReservations, setDayReservations] = useState<Reservation[]>([]);
  
  // Selection State (Main Calendar)
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  
  // Single Editor State
  const [selectedDay, setSelectedDay] = useState<any>(null);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editFormData, setEditFormData] = useState<any>(null);
  
  // Bulk Wizard State
  const [isBulkWizardOpen, setIsBulkWizardOpen] = useState(false);
  const [isBulkBookingOpen, setIsBulkBookingOpen] = useState(false); // NEW STATE for Bulk Reservations
  
  // Bulk Form State
  const [bulkTargetDates, setBulkTargetDates] = useState<Set<string>>(new Set());
  const [miniCalMonth, setMiniCalMonth] = useState(new Date()); // Internal nav for wizard calendar
  
  const [bulkType, setBulkType] = useState<BulkEventType>('SHOW');
  
  // Event Details State
  const [bulkDetails, setBulkDetails] = useState({
    // Shared
    startTime: '10:00',
    endTime: '17:00',
    notes: '',
    
    // Show Specific
    showId: '',
    profileId: '',
    showStatus: 'OPEN',
    capacity: 230,
    doorTime: '19:00', 
    
    // Rehearsal Specific
    team: ['CAST', 'TECH'], 
    location: 'Main Hall',
    
    // Private/Blackout Specific
    title: '', 
    contactName: '',
    reason: '',
    
    // Private Preferences Structured
    preferences: DEFAULT_PREFS
  });

  useEffect(() => {
    setShows(getShowDefinitions());
  }, []);

  useEffect(() => {
    if (selectedDay && selectedDay.dateStr) {
      const allRes = bookingRepo.getAll();
      const relevant = allRes.filter(r => r.date === selectedDay.dateStr && r.status !== 'CANCELLED');
      setDayReservations(relevant);
      
      // Reset edit state when day changes
      setIsEditingEvent(false);
      setEditFormData(null);
    }
  }, [selectedDay]);

  // --- Logic: Single Event Editing ---

  const handleDayClick = (day: any) => {
    if (isSelectMode) {
      const newSet = new Set(selectedDates);
      if (newSet.has(day.dateStr)) newSet.delete(day.dateStr);
      else newSet.add(day.dateStr);
      setSelectedDates(newSet);
    } else {
      // Open Single Editor
      setSelectedDay(day);
    }
  };

  const handleStartEdit = () => {
    if (!selectedDay?.event) return;
    // Clone event data for editing
    setEditFormData(JSON.parse(JSON.stringify(selectedDay.event)));
    setIsEditingEvent(true);
  };

  const handleSaveEvent = () => {
    if (!editFormData) return;
    
    calendarRepo.update(editFormData.id, () => editFormData);
    logAuditAction('UPDATE_EVENT', 'CALENDAR', editFormData.id, {
      description: `Updated event details for ${editFormData.date}`,
      after: editFormData
    });
    
    refreshData();
    setIsEditingEvent(false);
    setSelectedDay(null);
  };

  const handleDeleteEvent = () => {
    // Prefer the ID from the form being edited, fallback to selectedDay
    const idToDelete = editFormData?.id || selectedDay?.event?.id;
    
    if (!idToDelete) {
      console.error("No ID found to delete");
      return;
    }

    if (window.confirm('Weet je zeker dat je dit evenement wilt verwijderen? Dit kan niet ongedaan worden gemaakt.')) {
      calendarRepo.delete(idToDelete);
      
      logAuditAction('DELETE_EVENT', 'CALENDAR', idToDelete, {
        description: `Deleted event ${idToDelete}`
      });
      
      // Reset states
      setIsEditingEvent(false);
      setEditFormData(null);
      setSelectedDay(null);
      
      // Force refresh
      setTimeout(() => {
        refreshData();
      }, 50);
    }
  };

  // --- Logic: Bulk Operations ---

  const openBulkWizard = (fromSelection = false) => {
    if (fromSelection && selectedDates.size > 0) {
      setBulkTargetDates(new Set(selectedDates));
      // Set mini cal to the month of the first selected date
      const firstDate = Array.from(selectedDates).sort()[0] as string;
      setMiniCalMonth(new Date(firstDate));
    } else {
      setBulkTargetDates(new Set());
      setMiniCalMonth(new Date());
    }
    setIsBulkWizardOpen(true);
  };

  // Mini Calendar Logic
  const getMiniCalendarDays = () => {
    const year = miniCalMonth.getFullYear();
    const month = miniCalMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    // Padding
    const startDay = firstDay.getDay(); 
    for (let i = 0; i < startDay; i++) days.push(null);
    
    // Days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  };

  const toggleBulkDate = (dateStr: string) => {
    const newSet = new Set(bulkTargetDates);
    if (newSet.has(dateStr)) newSet.delete(dateStr);
    else newSet.add(dateStr);
    setBulkTargetDates(newSet);
  };

  const selectAllWeekdaysInMonth = (dayIndex: number) => {
    const days = getMiniCalendarDays();
    const newSet = new Set(bulkTargetDates);
    
    // Check if we should select or deselect (if all visible of that day are selected, deselect)
    const visibleDays = days.filter(d => d && d.getDay() === dayIndex) as Date[];
    const allSelected = visibleDays.every(d => newSet.has(d.toISOString().split('T')[0]));

    visibleDays.forEach(d => {
      const s = d.toISOString().split('T')[0];
      if (allSelected) newSet.delete(s);
      else newSet.add(s);
    });
    setBulkTargetDates(newSet);
  };

  const sortedTargetDates = useMemo(() => Array.from(bulkTargetDates).sort(), [bulkTargetDates]);

  const conflicts = useMemo(() => {
    const allEvents = calendarRepo.getAll();
    const conflictList: { date: string, existing: CalendarEvent }[] = [];
    
    sortedTargetDates.forEach(date => {
      const existing = allEvents.find(e => e.date === date);
      if (existing) conflictList.push({ date, existing });
    });
    return conflictList;
  }, [sortedTargetDates]);

  const handleBulkApply = () => {
    if (sortedTargetDates.length === 0) return;
    if (bulkType === 'SHOW' && !bulkDetails.showId) {
      alert("Selecteer een show.");
      return;
    }

    const allEvents = calendarRepo.getAll();
    const showDef = shows.find(s => s.id === bulkDetails.showId);
    
    // Use the selected profile, or default to the first one
    const profile = showDef?.profiles.find(p => p.id === bulkDetails.profileId) || showDef?.profiles[0];

    // Filter out dates we are about to update to avoid dupes (overwrite strategy)
    const newEventsList = allEvents.filter(e => !bulkTargetDates.has(e.date));

    sortedTargetDates.forEach(date => {
      let newEvent: CalendarEvent;

      if (bulkType === 'SHOW') {
        newEvent = {
          id: `SHOW-${date}`,
          type: 'SHOW',
          date: date,
          title: showDef?.name || 'Show',
          visibility: 'PUBLIC',
          bookingEnabled: bulkDetails.showStatus !== 'CLOSED',
          times: {
            doorsOpen: bulkDetails.doorTime,
            start: bulkDetails.startTime, 
            end: bulkDetails.endTime
          },
          showId: bulkDetails.showId,
          profileId: profile?.id || bulkDetails.profileId,
          status: bulkDetails.showStatus as any,
          capacity: bulkDetails.capacity,
          bookedCount: 0, 
          colorKey: profile?.color || 'slate', // Inherit color from profile
          pricing: profile?.pricing
        };
      } else if (bulkType === 'REHEARSAL') {
        newEvent = {
          id: `REH-${date}`,
          type: 'REHEARSAL',
          date: date,
          title: bulkDetails.title || 'Repetitie',
          visibility: 'INTERNAL',
          bookingEnabled: false,
          times: { start: bulkDetails.startTime, end: bulkDetails.endTime },
          team: bulkDetails.team,
          location: bulkDetails.location,
          notes: bulkDetails.notes
        } as RehearsalEvent;
      } else if (bulkType === 'PRIVATE') {
        newEvent = {
          id: `PRIV-${date}`,
          type: 'PRIVATE_EVENT',
          date: date,
          title: bulkDetails.title || 'Besloten Event',
          visibility: 'INTERNAL',
          bookingEnabled: false,
          times: { start: bulkDetails.startTime, end: bulkDetails.endTime },
          contactName: bulkDetails.contactName || 'Admin',
          contactEmail: '',
          contactPhone: '',
          pricingModel: 'FIXED_TOTAL',
          financials: { expectedGuests: 0, invoiceStatus: 'DRAFT' },
          preferences: bulkDetails.preferences
        } as PrivateEvent;
      } else {
        // BLACKOUT
        newEvent = {
          id: `BLK-${date}`,
          type: 'BLACKOUT',
          date: date,
          title: 'Gesloten',
          visibility: 'PUBLIC',
          bookingEnabled: false,
          times: { start: '00:00', end: '23:59' },
          reason: bulkDetails.reason
        } as BlackoutEvent;
      }

      newEventsList.push(newEvent);
    });

    calendarRepo.saveAll(newEventsList);
    logAuditAction('BULK_CREATE_EVENTS', 'CALENDAR', 'MULTIPLE', { 
      description: `Bulk created ${sortedTargetDates.length} events of type ${bulkType}`,
      after: { dates: sortedTargetDates } 
    });

    refreshData();
    setIsBulkWizardOpen(false);
    setIsSelectMode(false);
    setSelectedDates(new Set());
  };

  // --- Calculations for Drawer ---
  const dayStats = useMemo(() => {
    const totalGuests = dayReservations.reduce((s, r) => s + r.partySize, 0);
    const totalRevenue = dayReservations.reduce((s, r) => s + (r.financials.finalTotal || 0), 0);
    return { totalGuests, totalRevenue };
  }, [dayReservations]);

  // --- Render Helpers ---

  const renderBulkForm = () => {
    switch (bulkType) {
      case 'SHOW':
        const selectedShow = shows.find(s => s.id === bulkDetails.showId);
        
        return (
          <div className="space-y-4 animate-in fade-in">
             <div className="space-y-1.5">
               <label className="text-xs font-bold text-amber-500 uppercase tracking-widest">Selecteer Show Type</label>
               <select 
                 className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500"
                 value={bulkDetails.showId}
                 onChange={(e) => {
                   const s = shows.find(x => x.id === e.target.value);
                   const p = s?.profiles[0];
                   setBulkDetails({
                     ...bulkDetails, 
                     showId: e.target.value,
                     profileId: p?.id || '',
                     startTime: p?.timing.startTime || '19:30',
                     doorTime: p?.timing.doorTime || '18:30',
                     endTime: p?.timing.endTime || '22:30'
                   });
                 }}
               >
                 <option value="">-- Kies Show Type --</option>
                 {shows.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
               </select>
             </div>

             {/* Profile Selector if multiple exist */}
             {selectedShow && selectedShow.profiles.length > 1 && (
               <div className="space-y-1.5">
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Profiel / Variant</label>
                 <select 
                   className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500"
                   value={bulkDetails.profileId}
                   onChange={(e) => {
                     const p = selectedShow.profiles.find(x => x.id === e.target.value);
                     if (p) {
                       setBulkDetails({
                         ...bulkDetails,
                         profileId: p.id,
                         startTime: p.timing.startTime,
                         doorTime: p.timing.doorTime,
                         endTime: p.timing.endTime
                       });
                     }
                   }}
                 >
                   {selectedShow.profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                 </select>
               </div>
             )}

             <div className="grid grid-cols-2 gap-4">
                <Input label="Deur Open" type="time" value={bulkDetails.doorTime} onChange={(e: any) => setBulkDetails({...bulkDetails, doorTime: e.target.value})} />
                <Input label="Aanvang" type="time" value={bulkDetails.startTime} onChange={(e: any) => setBulkDetails({...bulkDetails, startTime: e.target.value})} />
             </div>
             <div className="grid grid-cols-2 gap-4">
                <Input label="Capaciteit" type="number" value={bulkDetails.capacity} onChange={(e: any) => setBulkDetails({...bulkDetails, capacity: parseInt(e.target.value)})} />
                <div className="space-y-1.5">
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Status</label>
                   <select 
                     className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500"
                     value={bulkDetails.showStatus}
                     onChange={(e: any) => setBulkDetails({...bulkDetails, showStatus: e.target.value})}
                   >
                     <option value="OPEN">Open</option>
                     <option value="WAITLIST">Wachtlijst</option>
                     <option value="CLOSED">Gesloten</option>
                   </select>
                </div>
             </div>
          </div>
        );
      case 'REHEARSAL':
        return (
          <div className="space-y-4 animate-in fade-in">
             <Input label="Titel / Omschrijving" value={bulkDetails.title} onChange={(e: any) => setBulkDetails({...bulkDetails, title: e.target.value})} placeholder="Bijv. Doorloop Akte 1" />
             <div className="grid grid-cols-2 gap-4">
                <Input label="Start Tijd" type="time" value={bulkDetails.startTime} onChange={(e: any) => setBulkDetails({...bulkDetails, startTime: e.target.value})} />
                <Input label="Eind Tijd" type="time" value={bulkDetails.endTime} onChange={(e: any) => setBulkDetails({...bulkDetails, endTime: e.target.value})} />
             </div>
             <div className="space-y-1.5">
               <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Teams</label>
               <div className="flex flex-wrap gap-2">
                 {['CAST', 'TECH', 'BAND', 'CREATIVE'].map(team => (
                   <button 
                     key={team}
                     onClick={() => {
                        const newTeams = bulkDetails.team.includes(team) 
                          ? bulkDetails.team.filter(t => t !== team)
                          : [...bulkDetails.team, team];
                        setBulkDetails({...bulkDetails, team: newTeams});
                     }}
                     className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${bulkDetails.team.includes(team) ? 'bg-purple-500 border-purple-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                   >
                     {team}
                   </button>
                 ))}
               </div>
             </div>
             <Input label="Locatie" value={bulkDetails.location} onChange={(e: any) => setBulkDetails({...bulkDetails, location: e.target.value})} />
          </div>
        );
      case 'PRIVATE':
        return (
          <div className="space-y-6 animate-in fade-in">
             <div className="grid grid-cols-1 gap-4">
               <Input label="Klant / Bedrijfsnaam" value={bulkDetails.title} onChange={(e: any) => setBulkDetails({...bulkDetails, title: e.target.value})} />
               <Input label="Contactpersoon" value={bulkDetails.contactName} onChange={(e: any) => setBulkDetails({...bulkDetails, contactName: e.target.value})} />
               <div className="grid grid-cols-2 gap-4">
                  <Input label="Start" type="time" value={bulkDetails.startTime} onChange={(e: any) => setBulkDetails({...bulkDetails, startTime: e.target.value})} />
                  <Input label="Eind" type="time" value={bulkDetails.endTime} onChange={(e: any) => setBulkDetails({...bulkDetails, endTime: e.target.value})} />
               </div>
             </div>
             <div className="pt-6 border-t border-slate-800">
               <h3 className="text-sm font-bold text-white mb-4">Event Details & Wensen</h3>
               <PreferencesForm 
                 data={bulkDetails.preferences} 
                 onChange={(prefs) => setBulkDetails({...bulkDetails, preferences: prefs})}
               />
             </div>
          </div>
        );
      case 'BLACKOUT':
        return (
          <div className="space-y-4 animate-in fade-in">
             <Input label="Reden van sluiting" value={bulkDetails.reason} onChange={(e: any) => setBulkDetails({...bulkDetails, reason: e.target.value})} placeholder="Bijv. Onderhoud, Vakantie" />
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-8 space-y-6 relative">
      {/* Top Bar */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-serif text-white">Agenda Beheer</h2>
          <p className="text-slate-500 text-sm">Plan shows en beheer capaciteit.</p>
        </div>
        <div className="flex space-x-2">
           <Button variant="secondary" onClick={() => openBulkWizard(false)} className="flex items-center">
             <Layers size={18} className="mr-2" /> Bulk Planner
           </Button>
        </div>
      </div>

      {/* Calendar Controls */}
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
          if (isSelectMode) {
            // If finishing selection with items selected, prompt wizard
            if (selectedDates.size > 0) openBulkWizard(true);
            else setIsSelectMode(false);
          } else {
            setIsSelectMode(true);
          }
        }}
      />
      
      {/* Calendar View */}
      <div className="flex-grow overflow-y-auto custom-scrollbar pb-24">
        {viewMode === 'GRID' ? (
          <CalendarGrid 
            days={calendarDays} 
            onDayClick={handleDayClick} 
            isAdmin={true} 
            isDense={isDense} 
            isBulkMode={isSelectMode}
            selectedDates={selectedDates}
          />
        ) : (
          <CalendarAgenda days={calendarDays} onDayClick={handleDayClick} isAdmin={true} />
        )}
      </div>

      {/* Selection Floating Action Bar */}
      {isSelectMode && selectedDates.size > 0 && !isBulkWizardOpen && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 animate-in slide-in-from-bottom-6 z-30">
          <div className="bg-slate-900 border border-amber-500/50 shadow-[0_0_40px_rgba(0,0,0,0.5)] rounded-2xl p-4 flex items-center justify-between">
             <div className="flex items-center space-x-3 px-2">
               <div className="bg-amber-500 text-black font-bold w-8 h-8 rounded-full flex items-center justify-center">
                 {selectedDates.size}
               </div>
               <span className="text-white font-bold text-sm">Geselecteerd</span>
             </div>
             
             <div className="flex space-x-2">
               <Button variant="ghost" onClick={() => { setIsSelectMode(false); setSelectedDates(new Set()); }}>Annuleren</Button>
               <Button onClick={() => openBulkWizard(true)} className="bg-amber-500 text-black hover:bg-amber-400 border-none">
                 Bewerken
               </Button>
             </div>
          </div>
        </div>
      )}

      {/* --- BULK WIZARD DRAWER (Event Creation) --- */}
      <ResponsiveDrawer
        isOpen={isBulkWizardOpen}
        onClose={() => setIsBulkWizardOpen(false)}
        title="Bulk Operaties"
        widthClass="md:w-[600px]"
      >
        <div className="space-y-8 pb-20">
          
          {/* STEP 1: INTERACTIVE SELECTION */}
          <section className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
               <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">1. Selecteer Dagen</h3>
               <div className="flex items-center space-x-2">
                 <button onClick={() => setMiniCalMonth(new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth()-1, 1))} className="p-1 hover:bg-slate-800 rounded"><ChevronLeft size={16} /></button>
                 <span className="text-sm font-bold text-white w-24 text-center">{miniCalMonth.toLocaleString('nl-NL', {month:'long'})}</span>
                 <button onClick={() => setMiniCalMonth(new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth()+1, 1))} className="p-1 hover:bg-slate-800 rounded"><ChevronRight size={16} /></button>
               </div>
            </div>

            <div className="bg-black/40 rounded-xl p-3 border border-slate-800">
               {/* Weekday Headers */}
               <div className="grid grid-cols-7 mb-2">
                 {WEEKDAYS_SHORT.map((d, i) => (
                   <button 
                     key={d} 
                     onClick={() => selectAllWeekdaysInMonth(i)}
                     className="text-[10px] uppercase font-bold text-slate-500 hover:text-amber-500 transition-colors py-1 text-center"
                     title={`Selecteer alle ${d}`}
                   >
                     {d}
                   </button>
                 ))}
               </div>
               
               {/* Calendar Grid */}
               <div className="grid grid-cols-7 gap-1">
                 {getMiniCalendarDays().map((date, idx) => {
                   if (!date) return <div key={`pad-${idx}`} />;
                   
                   const dateStr = date.toISOString().split('T')[0];
                   const isSelected = bulkTargetDates.has(dateStr);
                   const isPast = date < new Date(new Date().setHours(0,0,0,0)); // Simple past check
                   
                   return (
                     <button
                       key={dateStr}
                       onClick={() => toggleBulkDate(dateStr)}
                       disabled={isPast}
                       className={`
                         aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all
                         ${isSelected ? 'bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}
                         ${isPast ? 'opacity-30 cursor-not-allowed' : ''}
                       `}
                     >
                       {date.getDate()}
                     </button>
                   );
                 })}
               </div>
            </div>
            
            <div className="flex justify-between items-center px-2">
               <span className="text-xs text-slate-500">{bulkTargetDates.size} datums geselecteerd</span>
               <button onClick={() => setBulkTargetDates(new Set())} className="text-xs text-slate-500 hover:text-white underline">Wissen</button>
            </div>
          </section>

          {/* STEP 2: TYPE */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">2. Type Evenement</h3>
            <div className="grid grid-cols-2 gap-3">
               <button onClick={() => setBulkType('SHOW')} className={`p-4 rounded-xl border text-left transition-all ${bulkType === 'SHOW' ? 'bg-amber-900/20 border-amber-500 ring-1 ring-amber-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}>
                 <div className="flex items-center space-x-2 mb-1 text-amber-500"><CalIcon size={18}/> <span className="font-bold">Show</span></div>
                 <p className="text-xs text-slate-400">Publieke voorstelling</p>
               </button>
               <button onClick={() => setBulkType('REHEARSAL')} className={`p-4 rounded-xl border text-left transition-all ${bulkType === 'REHEARSAL' ? 'bg-purple-900/20 border-purple-500 ring-1 ring-purple-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}>
                 <div className="flex items-center space-x-2 mb-1 text-purple-500"><Mic size={18}/> <span className="font-bold">Repetitie</span></div>
                 <p className="text-xs text-slate-400">Interne planning</p>
               </button>
               <button onClick={() => setBulkType('PRIVATE')} className={`p-4 rounded-xl border text-left transition-all ${bulkType === 'PRIVATE' ? 'bg-blue-900/20 border-blue-500 ring-1 ring-blue-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}>
                 <div className="flex items-center space-x-2 mb-1 text-blue-500"><Users size={18}/> <span className="font-bold">Besloten</span></div>
                 <p className="text-xs text-slate-400">Privé evenement</p>
               </button>
               <button onClick={() => setBulkType('BLACKOUT')} className={`p-4 rounded-xl border text-left transition-all ${bulkType === 'BLACKOUT' ? 'bg-red-900/20 border-red-500 ring-1 ring-red-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}>
                 <div className="flex items-center space-x-2 mb-1 text-red-500"><Lock size={18}/> <span className="font-bold">Blokkeren</span></div>
                 <p className="text-xs text-slate-400">Locatie gesloten</p>
               </button>
            </div>
          </section>

          {/* STEP 3: DETAILS */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">3. Details</h3>
            {renderBulkForm()}
          </section>

          {/* STEP 4: PREVIEW */}
          <section className="space-y-4 bg-black/20 p-4 rounded-xl border border-slate-800">
             <div className="flex justify-between items-center">
               <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Samenvatting</h3>
               <span className="text-xs font-bold bg-slate-800 px-2 py-1 rounded text-white">{sortedTargetDates.length} Datums</span>
             </div>
             
             {conflicts.length > 0 && (
               <div className="p-3 bg-orange-900/20 border border-orange-900/50 rounded-lg flex items-start space-x-3">
                 <AlertTriangle size={16} className="text-orange-500 mt-0.5 shrink-0" />
                 <div className="text-xs text-orange-200">
                   <strong>Let op:</strong> {conflicts.length} datums hebben al een event. Deze actie zal bestaande events overschrijven.
                 </div>
               </div>
             )}

             <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1">
               {sortedTargetDates.slice(0, 20).map(d => (
                 <div key={d} className="text-xs text-slate-500 flex justify-between">
                   <span>{new Date(d).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'long' })}</span>
                   {conflicts.find(c => c.date === d) && <span className="text-orange-500 font-bold">Overschrijft</span>}
                 </div>
               ))}
               {sortedTargetDates.length > 20 && <p className="text-xs text-slate-600 italic">...en nog {sortedTargetDates.length - 20} anderen</p>}
             </div>
          </section>

          {/* Actions */}
          <div className="fixed bottom-0 right-0 w-full md:w-[600px] p-6 bg-slate-900 border-t border-slate-800 flex justify-end space-x-3">
             <Button variant="ghost" onClick={() => setIsBulkWizardOpen(false)}>Annuleren</Button>
             <Button onClick={handleBulkApply} disabled={sortedTargetDates.length === 0} className="bg-emerald-600 hover:bg-emerald-700">
               Toepassen ({sortedTargetDates.length})
             </Button>
          </div>
        </div>
      </ResponsiveDrawer>

      {/* --- SINGLE EDIT DRAWER --- */}
      <ResponsiveDrawer
        isOpen={!!selectedDay}
        onClose={() => { setSelectedDay(null); setIsEditingEvent(false); }}
        title={isEditingEvent ? 'Event Bewerken' : (selectedDay?.dateStr ? `Overzicht ${new Date(selectedDay.dateStr as string).toLocaleDateString()}` : 'Dag Detail')}
      >
        <div className="space-y-8">
           
           {/* EDIT MODE */}
           {isEditingEvent && editFormData ? (
             <div className="space-y-6 animate-in fade-in">
               
               {/* Show Specific Fields */}
               {editFormData.type === 'SHOW' && (
                 <>
                   <div className="space-y-1.5">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Show Profiel</label>
                     <select 
                       className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500"
                       value={editFormData.showId}
                       onChange={(e) => {
                         // Update show AND reset profile
                         const s = shows.find(sh => sh.id === e.target.value);
                         const p = s?.profiles[0];
                         setEditFormData({
                           ...editFormData,
                           showId: e.target.value,
                           profileId: p?.id || '',
                           title: s?.name,
                           // Auto-update times/prices based on new profile default
                           times: {
                             start: p?.timing.startTime || '19:30',
                             doorsOpen: p?.timing.doorTime || '18:30',
                             end: p?.timing.endTime || '22:30'
                           },
                           pricing: p?.pricing
                         });
                       }}
                     >
                        {shows.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                     </select>
                   </div>

                   {/* Profile Selector if current show has multiple */}
                   {(() => {
                      const currentShow = shows.find(s => s.id === editFormData.showId);
                      if (currentShow && currentShow.profiles.length > 1) {
                        return (
                          <div className="space-y-1.5">
                             <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Variant</label>
                             <select
                               className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500"
                               value={editFormData.profileId}
                               onChange={(e) => {
                                 const p = currentShow.profiles.find(pr => pr.id === e.target.value);
                                 if (p) {
                                   setEditFormData({
                                     ...editFormData,
                                     profileId: p.id,
                                     times: {
                                       start: p.timing.startTime,
                                       doorsOpen: p.timing.doorTime,
                                       end: p.timing.endTime
                                     },
                                     pricing: p.pricing
                                   });
                                 }
                               }}
                             >
                               {currentShow.profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                             </select>
                          </div>
                        );
                      }
                      return null;
                   })()}

                   <div className="grid grid-cols-2 gap-4">
                      <Input label="Start Tijd" type="time" value={editFormData.times?.start} onChange={(e: any) => setEditFormData({...editFormData, times: {...editFormData.times, start: e.target.value}})} />
                      <Input label="Deur Open" type="time" value={editFormData.times?.doorsOpen} onChange={(e: any) => setEditFormData({...editFormData, times: {...editFormData.times, doorsOpen: e.target.value}})} />
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <Input label="Capaciteit" type="number" value={editFormData.capacity} onChange={(e: any) => setEditFormData({...editFormData, capacity: parseInt(e.target.value)})} />
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Status</label>
                        <select 
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500"
                          value={editFormData.status}
                          onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                        >
                          <option value="OPEN">Open</option>
                          <option value="WAITLIST">Wachtlijst</option>
                          <option value="CLOSED">Gesloten</option>
                        </select>
                      </div>
                   </div>
                 </>
               )}

               {/* Private Event Fields */}
               {editFormData.type === 'PRIVATE_EVENT' && (
                 <>
                   <Input label="Titel / Klant" value={editFormData.title} onChange={(e: any) => setEditFormData({...editFormData, title: e.target.value})} />
                   <div className="grid grid-cols-2 gap-4">
                      <Input label="Start" type="time" value={editFormData.times?.start} onChange={(e: any) => setEditFormData({...editFormData, times: {...editFormData.times, start: e.target.value}})} />
                      <Input label="Eind" type="time" value={editFormData.times?.end} onChange={(e: any) => setEditFormData({...editFormData, times: {...editFormData.times, end: e.target.value}})} />
                   </div>
                   {/* Could add PreferencesForm here for full edit if needed */}
                 </>
               )}

               {/* Blackout Fields */}
               {editFormData.type === 'BLACKOUT' && (
                 <Input label="Reden" value={editFormData.reason} onChange={(e: any) => setEditFormData({...editFormData, reason: e.target.value})} />
               )}

               <div className="flex gap-4 pt-6 border-t border-slate-800">
                 <Button variant="ghost" onClick={handleDeleteEvent} className="flex-1 text-red-500 hover:bg-red-900/20 hover:text-red-400">
                   <Trash2 size={16} className="mr-2" /> Verwijder
                 </Button>
                 <div className="flex-grow"></div>
                 <Button variant="ghost" onClick={() => setIsEditingEvent(false)}>Annuleren</Button>
                 <Button onClick={handleSaveEvent} className="bg-emerald-600 hover:bg-emerald-700">Opslaan</Button>
               </div>
             </div>
           ) : (
             <>
               {/* 1. Header Card with Actions */}
               <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
                 <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Event</span>
                    <Badge status={selectedDay?.event?.status || 'CLOSED'}>{selectedDay?.event?.status || 'Closed'}</Badge>
                 </div>
                 
                 <h3 className="text-2xl font-bold text-white mb-1">{selectedDay?.event?.title || 'Geen Event'}</h3>
                 {selectedDay?.event?.type === 'SHOW' && (
                    <p className="text-slate-400 text-sm mb-6">
                      {selectedDay.event.times?.start} Aanvang • {selectedDay.event.capacity} Capaciteit
                    </p>
                 )}

                 {selectedDay?.event?.type === 'SHOW' && (
                   <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                         <p className="text-[10px] text-slate-500 uppercase font-bold">Gasten</p>
                         <div className="flex items-baseline space-x-1">
                            <span className="text-xl font-bold text-white">{dayStats.totalGuests}</span>
                            <span className="text-xs text-slate-500">/ {selectedDay.event.capacity}</span>
                         </div>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                         <p className="text-[10px] text-slate-500 uppercase font-bold">Omzet</p>
                         <span className="text-xl font-bold text-emerald-500">€{dayStats.totalRevenue.toLocaleString()}</span>
                      </div>
                   </div>
                 )}
                 
                 <div className="space-y-3">
                   {/* Primary Action */}
                   <Button 
                     onClick={() => navigate('/admin/reports', { state: { date: selectedDay.dateStr } })} 
                     className="w-full bg-slate-800 hover:bg-slate-700 border-slate-700 flex items-center justify-center text-white"
                   >
                     <FileText size={16} className="mr-2" /> Dag Rapport Afdrukken
                   </Button>

                   {/* Secondary Actions Grid */}
                   <div className="grid grid-cols-2 gap-3">
                     <Button 
                       className="w-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center text-xs"
                       onClick={() => navigate('/admin/reservations/new', { 
                         state: { date: selectedDay.dateStr, showId: selectedDay.event.showId } 
                       })}
                     >
                       <Ticket size={16} className="mr-2" /> Nieuwe Boeking
                     </Button>
                     
                     <Button 
                       className="w-full bg-slate-950 hover:bg-slate-900 border-slate-800 flex items-center justify-center text-xs text-emerald-500"
                       onClick={() => setIsBulkBookingOpen(true)}
                     >
                       <ListPlus size={16} className="mr-2" /> Bulk Invoer
                     </Button>
                   </div>
                 </div>
               </div>

               {/* Event Configuration Section */}
               {selectedDay?.event && (
                 <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex justify-between items-center">
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center"><Settings size={12} className="mr-1"/> Instellingen</h4>
                      <p className="text-sm text-white mt-1">Wijzig show details of verwijder event.</p>
                    </div>
                    <Button variant="secondary" onClick={handleStartEdit} className="h-8 text-xs">
                      Bewerk Event
                    </Button>
                 </div>
               )}

               {/* 2. Mini Reservation List */}
               {selectedDay?.event?.type === 'SHOW' && (
                 <div className="space-y-4">
                    <div className="flex justify-between items-center">
                       <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest">Laatste Boekingen</h4>
                       <button 
                         onClick={() => navigate(`/admin/reservations?date=${selectedDay.dateStr}`)}
                         className="text-xs text-slate-400 hover:text-white underline"
                       >
                         Alles bekijken ({dayReservations.length})
                       </button>
                    </div>
                    
                    {dayReservations.length === 0 ? (
                      <p className="text-sm text-slate-500 italic text-center py-4">Nog geen reserveringen.</p>
                    ) : (
                      <div className="space-y-2">
                        {dayReservations.slice(0, 5).map(r => (
                          <div key={r.id} className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg flex justify-between items-center text-sm">
                             <div>
                               <span className="font-bold text-white block">{r.customer.lastName}</span>
                               <span className="text-[10px] text-slate-500">{r.id}</span>
                             </div>
                             <div className="text-right">
                               <span className="font-bold text-slate-300 block">{r.partySize}p</span>
                               <span className={`text-[9px] uppercase font-bold ${r.status === 'CONFIRMED' ? 'text-emerald-500' : 'text-slate-500'}`}>{r.status}</span>
                             </div>
                          </div>
                        ))}
                      </div>
                    )}
                 </div>
               )}

               {/* 3. Event Settings Info (Read Only) */}
               {!selectedDay?.event?.type && (
                 <div className="text-center p-8 border-2 border-dashed border-slate-800 rounded-xl text-slate-500">
                   <p className="text-sm">Geen event op deze dag.</p>
                   <Button onClick={() => openBulkWizard(true)} variant="secondary" className="mt-4">
                     Event Aanmaken
                   </Button>
                 </div>
               )}
             </>
           )}
        </div>
      </ResponsiveDrawer>

      {/* --- BULK RESERVATION EDITOR OVERLAY --- */}
      {isBulkBookingOpen && selectedDay?.event && selectedDay?.show && (
        <BulkReservationEditor 
          event={selectedDay.event}
          show={selectedDay.show}
          onClose={() => setIsBulkBookingOpen(false)}
          onSuccess={() => {
            setIsBulkBookingOpen(false);
            setSelectedDay(null); // Close main drawer
            refreshData(); // Refresh UI
          }}
        />
      )}

    </div>
  );
};
