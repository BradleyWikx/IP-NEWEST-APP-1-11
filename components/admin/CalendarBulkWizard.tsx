
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, Layers, CheckCircle2, AlertTriangle, 
  ArrowRight, Clock, Trash2, Check, X, ShieldAlert, Euro,
  ChevronLeft, ChevronRight, Filter, Plus, RotateCcw
} from 'lucide-react';
import { Button, Input, Card, Stepper } from '../UI';
import { ShowDefinition, CalendarEvent, EventType, ShowEvent, BookingStatus } from '../../types';
import { getShowDefinitions, calendarRepo, bookingRepo } from '../../utils/storage';
import { logAuditAction } from '../../utils/auditLogger';
import { undoManager } from '../../utils/undoManager';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  preselectedDates?: string[]; // ISO YYYY-MM-DD
}

const STEPS = ['Selecteer Data', 'Instellingen', 'Bevestigen'];
const WEEKDAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

export const CalendarBulkWizard: React.FC<Props> = ({ onClose, onSuccess, preselectedDates = [] }) => {
  const [step, setStep] = useState(0);
  const [shows, setShows] = useState<ShowDefinition[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- STEP 1: SELECTION STATE (Visual Calendar) ---
  const [viewDate, setViewDate] = useState(new Date()); // For navigation
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set(preselectedDates));
  
  // Selection Tools State
  const [toolRangeStart, setToolRangeStart] = useState('');
  const [toolRangeEnd, setToolRangeEnd] = useState('');
  const [toolWeekdays, setToolWeekdays] = useState<number[]>([5, 6]); // Default Fri, Sat

  // --- STEP 2: CONFIG STATE ---
  const [eventType, setEventType] = useState<EventType>('SHOW');
  const [selectedShowId, setSelectedShowId] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  
  // Override Defaults
  const [times, setTimes] = useState({ start: '19:30', door: '19:00', end: '22:30' });
  const [capacity, setCapacity] = useState(230);
  const [status, setStatus] = useState<'OPEN' | 'CLOSED'>('OPEN');
  
  // Generic fields (for non-show events)
  const [title, setTitle] = useState('');
  
  // --- STEP 3: CONFLICT STATE ---
  const [overwrite, setOverwrite] = useState(false);
  const [forceBookings, setForceBookings] = useState(false);

  // --- LOAD DATA ---
  useEffect(() => {
    setShows(getShowDefinitions());
  }, []);

  // Auto-select first show/profile
  useEffect(() => {
    if (shows.length > 0 && !selectedShowId) {
        setSelectedShowId(shows[0].id);
        if (shows[0].profiles.length > 0) {
            setSelectedProfileId(shows[0].profiles[0].id);
        }
    }
  }, [shows]);

  // Update times when profile changes
  useEffect(() => {
    if (eventType === 'SHOW' && selectedShowId && selectedProfileId) {
        const show = shows.find(s => s.id === selectedShowId);
        const profile = show?.profiles.find(p => p.id === selectedProfileId);
        if (profile) {
            setTimes({
                start: profile.timing.startTime,
                door: profile.timing.doorTime,
                end: profile.timing.endTime
            });
        }
    }
  }, [selectedShowId, selectedProfileId, eventType]);

  // --- CALENDAR GRID GENERATION ---
  const calendarGrid = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    // Adjust for Monday start (0=Sun, 1=Mon) -> (1=Mon ... 7=Sun)
    const startDay = firstDayOfMonth.getDay(); 
    const dutchStartDay = startDay === 0 ? 6 : startDay - 1; // Mon=0, Sun=6

    const days = [];
    
    // Padding Start
    for (let i = 0; i < dutchStartDay; i++) {
        days.push(null);
    }
    
    // Days
    for (let d = 1; d <= lastDayOfMonth.getDate(); d++) {
        const date = new Date(year, month, d);
        const dateStr = date.toISOString().split('T')[0];
        days.push({ date, dateStr });
    }

    return days;
  }, [viewDate]);

  // --- CONFLICT & DATA LOGIC ---

  const targetDates = useMemo(() => Array.from(selectedDates).sort(), [selectedDates]);

  // Check Existing Events
  const existingEventsMap = useMemo(() => {
    const map = new Set<string>();
    calendarRepo.getAll().forEach(e => map.add(e.date));
    return map;
  }, []);

  const eventConflicts = useMemo(() => {
    return targetDates.filter(d => existingEventsMap.has(d));
  }, [targetDates, existingEventsMap]);

  // Check Existing Bookings
  const bookingConflicts = useMemo(() => {
    const allReservations = bookingRepo.getAll();
    const conflictMap: Record<string, number> = {};

    targetDates.forEach(date => {
        const bookings = allReservations.filter(r => 
            r.date === date && 
            r.status !== BookingStatus.CANCELLED && 
            r.status !== BookingStatus.ARCHIVED
        );
        if (bookings.length > 0) {
            conflictMap[date] = bookings.reduce((s, r) => s + r.partySize, 0);
        }
    });
    return conflictMap;
  }, [targetDates]);

  // --- ACTIONS ---

  const toggleDate = (dateStr: string) => {
    const newSet = new Set(selectedDates);
    if (newSet.has(dateStr)) newSet.delete(dateStr);
    else newSet.add(dateStr);
    setSelectedDates(newSet);
  };

  const applyRangeSelection = () => {
    if (!toolRangeStart || !toolRangeEnd) return;
    
    const start = new Date(toolRangeStart);
    const end = new Date(toolRangeEnd);
    const newSet = new Set(selectedDates);
    
    // Safety break
    if ((end.getTime() - start.getTime()) / (1000 * 3600 * 24) > 365) {
        alert("Maximum bereik is 1 jaar.");
        return;
    }

    let current = new Date(start);
    while (current <= end) {
        if (toolWeekdays.includes(current.getDay())) {
            newSet.add(current.toISOString().split('T')[0]);
        }
        current.setDate(current.getDate() + 1);
    }
    
    setSelectedDates(newSet);
  };

  const clearSelection = () => setSelectedDates(new Set());

  const handleSubmit = async () => {
    const bookingConflictKeys = Object.keys(bookingConflicts);
    if (bookingConflictKeys.length > 0 && !forceBookings) {
        alert("Er zijn actieve boekingen op de geselecteerde data. Vink 'Forceer' aan om door te gaan.");
        return;
    }

    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 800));

    const eventsToCreate: CalendarEvent[] = [];
    const existingEvents = calendarRepo.getAll();
    
    targetDates.forEach(date => {
        // Skip if event conflict and not overwrite
        if (eventConflicts.includes(date) && !overwrite) return;

        // Skip if booking conflict and not force
        if (bookingConflicts[date] && !forceBookings) return;

        const baseEvent = {
            id: `EVT-${date}`, 
            date,
            type: eventType,
            visibility: 'PUBLIC' as const,
            bookingEnabled: status === 'OPEN',
            times: {
                start: times.start,
                doorsOpen: times.door,
                end: times.end
            }
        };

        if (eventType === 'SHOW') {
            eventsToCreate.push({
                ...baseEvent,
                title: shows.find(s => s.id === selectedShowId)?.name || 'Show',
                showId: selectedShowId,
                profileId: selectedProfileId,
                status: status as any,
                capacity: capacity,
                bookedCount: 0, 
                pricing: undefined
            } as ShowEvent);
        } else {
            // Generic Event
            eventsToCreate.push({
                ...baseEvent,
                title: title || (eventType === 'REHEARSAL' ? 'Repetitie' : 'Gesloten'),
                visibility: eventType === 'BLACKOUT' ? 'INTERNAL' : 'PUBLIC',
                bookingEnabled: false
            } as CalendarEvent);
        }
    });

    // Merge: Filter out overwrites from existing, then add new
    const cleanExisting = existingEvents.filter(e => !eventsToCreate.some(n => n.date === e.date));
    calendarRepo.saveAll([...cleanExisting, ...eventsToCreate]);

    logAuditAction('BULK_CREATE_EVENTS', 'CALENDAR', 'MULTIPLE', {
        description: `Created ${eventsToCreate.length} events (${eventType}). Forced bookings: ${forceBookings}`
    });

    undoManager.showSuccess(`${eventsToCreate.length} events aangemaakt.`);
    setIsProcessing(false);
    onSuccess();
  };

  // --- RENDER STEPS ---

  const renderVisualCalendar = () => (
    <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[400px]">
        {/* Left: Tools */}
        <div className="w-full lg:w-64 space-y-4 shrink-0">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center">
                    <Filter size={14} className="mr-2"/> Patroon Genereren
                </h4>
                
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <Input type="date" label="Van" value={toolRangeStart} onChange={(e:any) => setToolRangeStart(e.target.value)} className="h-8 text-xs px-2" />
                        <Input type="date" label="Tot" value={toolRangeEnd} onChange={(e:any) => setToolRangeEnd(e.target.value)} className="h-8 text-xs px-2" />
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Dagen</label>
                        <div className="flex flex-wrap gap-1">
                            {['Zo','Ma','Di','Wo','Do','Vr','Za'].map((d, i) => (
                                <button
                                    key={i}
                                    onClick={() => setToolWeekdays(prev => prev.includes(i) ? prev.filter(x => x!==i) : [...prev, i])}
                                    className={`w-6 h-6 text-[10px] font-bold rounded border ${toolWeekdays.includes(i) ? 'bg-amber-500 text-black border-amber-500' : 'bg-slate-950 border-slate-700 text-slate-400'}`}
                                >
                                    {d.charAt(0)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <Button onClick={applyRangeSelection} disabled={!toolRangeStart || !toolRangeEnd} className="w-full h-8 text-xs bg-slate-800 border-slate-700 hover:bg-slate-700">
                        Genereer Data
                    </Button>
                </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center">
                <p className="text-xs text-slate-500 uppercase font-bold mb-1">Geselecteerd</p>
                <p className="text-3xl font-serif text-white">{selectedDates.size}</p>
                {selectedDates.size > 0 && (
                    <button onClick={clearSelection} className="text-[10px] text-red-400 hover:text-red-300 mt-2 underline flex items-center">
                        <RotateCcw size={10} className="mr-1"/> Alles Wissen
                    </button>
                )}
            </div>
        </div>

        {/* Right: Calendar Grid */}
        <div className="flex-grow flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-slate-950 border-b border-slate-800">
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth()-1, 1))} className="p-1 hover:bg-slate-800 rounded text-slate-400"><ChevronLeft size={20}/></button>
                <h3 className="font-bold text-white capitalize">{viewDate.toLocaleString('nl-NL', { month: 'long', year: 'numeric' })}</h3>
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth()+1, 1))} className="p-1 hover:bg-slate-800 rounded text-slate-400"><ChevronRight size={20}/></button>
            </div>

            {/* Grid */}
            <div className="flex-grow p-4">
                <div className="grid grid-cols-7 mb-2">
                    {WEEKDAYS.map(d => <div key={d} className="text-center text-[10px] font-bold text-slate-500 uppercase">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {calendarGrid.map((day, idx) => {
                        if (!day) return <div key={`empty-${idx}`} />;
                        
                        const isSelected = selectedDates.has(day.dateStr);
                        const hasEvent = existingEventsMap.has(day.dateStr);
                        const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;

                        return (
                            <div 
                                key={day.dateStr}
                                onClick={() => toggleDate(day.dateStr)}
                                className={`
                                    aspect-square rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all relative border
                                    ${isSelected 
                                        ? 'bg-amber-500 text-black border-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.3)]' 
                                        : isWeekend ? 'bg-slate-800/50 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-transparent border-slate-800/50 text-slate-400 hover:bg-slate-800'}
                                `}
                            >
                                <span className="text-sm font-bold">{day.date.getDate()}</span>
                                
                                {hasEvent && (
                                    <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-black' : 'bg-red-500'}`} />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    </div>
  );

  const renderConfigStep = () => {
    // Determine selected profile for preview
    const currentShow = shows.find(s => s.id === selectedShowId);
    const currentProfile = currentShow?.profiles.find(p => p.id === selectedProfileId);

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Event Type */}
            <div className="grid grid-cols-2 gap-4">
                <div 
                    onClick={() => setEventType('SHOW')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${eventType === 'SHOW' ? 'bg-purple-900/20 border-purple-500 text-purple-200' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                >
                    <div className="font-bold mb-1">Voorstelling</div>
                    <div className="text-xs opacity-70">Publiek event met tickets</div>
                </div>
                <div 
                    onClick={() => setEventType('BLACKOUT')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${eventType === 'BLACKOUT' ? 'bg-red-900/20 border-red-500 text-red-200' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                >
                    <div className="font-bold mb-1">Sluiting / Blackout</div>
                    <div className="text-xs opacity-70">Gesloten voor boekingen</div>
                </div>
            </div>

            {/* Config Form */}
            <Card className="p-6 bg-slate-900 border-slate-800">
                {eventType === 'SHOW' ? (
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Selecteer Show</label>
                            <select 
                                className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500"
                                value={selectedShowId}
                                onChange={(e) => {
                                    const newShowId = e.target.value;
                                    setSelectedShowId(newShowId);
                                    // Smart Autofill: Default to first profile when show changes
                                    const show = shows.find(s => s.id === newShowId);
                                    if (show && show.profiles.length > 0) {
                                        setSelectedProfileId(show.profiles[0].id);
                                    }
                                }}
                            >
                                {shows.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tijd & Prijs Profiel</label>
                            <select 
                                className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500"
                                value={selectedProfileId}
                                onChange={(e) => setSelectedProfileId(e.target.value)}
                            >
                                {shows.find(s => s.id === selectedShowId)?.profiles.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.timing.startTime})</option>
                                ))}
                            </select>
                        </div>

                        {/* Live Preview Card */}
                        {currentProfile && (
                            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl animate-in fade-in slide-in-from-top-2 shadow-inner">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Tijdschema</p>
                                        <div className="flex items-center text-sm text-slate-300 font-medium">
                                            <Clock size={14} className="mr-2 text-amber-500" />
                                            <span>{currentProfile.timing.doorTime} Deur | <span className="text-white">{currentProfile.timing.startTime} Start</span> | {currentProfile.timing.endTime} Einde</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Financieel</p>
                                        <div className="flex items-center text-sm text-slate-300 font-medium">
                                            <Euro size={14} className="mr-2 text-emerald-500" />
                                            <span>STD: €{currentProfile.pricing.standard.toFixed(2)} | PREM: €{currentProfile.pricing.premium.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-4">
                            <Input label="Deur Open" type="time" value={times.door} onChange={(e:any) => setTimes({...times, door: e.target.value})} />
                            <Input label="Start Show" type="time" value={times.start} onChange={(e:any) => setTimes({...times, start: e.target.value})} />
                            <Input label="Einde" type="time" value={times.end} onChange={(e:any) => setTimes({...times, end: e.target.value})} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Capaciteit" type="number" value={capacity} onChange={(e:any) => setCapacity(parseInt(e.target.value))} />
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Status</label>
                                <select 
                                    className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500"
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value as any)}
                                >
                                    <option value="OPEN">Open voor verkoop</option>
                                    <option value="CLOSED">Gesloten (Admin only)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <Input label="Label (Intern)" value={title} onChange={(e:any) => setTitle(e.target.value)} placeholder="Bijv. Onderhoud of Privé Event" />
                    </div>
                )}
            </Card>
        </div>
    );
  };

  const renderConfirmStep = () => {
    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
                    <p className="text-xs font-bold text-slate-500 uppercase">Te Genereren Events</p>
                    <p className="text-4xl font-serif text-white mt-2">{targetDates.length}</p>
                </div>
                <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
                    <p className="text-xs font-bold text-slate-500 uppercase">Conflicten (Events)</p>
                    <p className={`text-4xl font-serif mt-2 ${eventConflicts.length > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>{eventConflicts.length}</p>
                </div>
            </div>

            {/* CRITICAL WARNING: BOOKINGS EXIST */}
            {Object.keys(bookingConflicts).length > 0 && (
                <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-xl space-y-4 shadow-lg shadow-red-900/20">
                    <div className="flex items-start space-x-3 text-red-500">
                        <ShieldAlert size={32} className="animate-pulse" />
                        <div>
                            <h4 className="font-bold text-base">LET OP: Actieve Reserveringen Gevonden!</h4>
                            <p className="text-sm text-red-200/80 mt-1">
                                Op <strong>{Object.keys(bookingConflicts).length}</strong> data zijn er reserveringen.
                            </p>
                            <p className="text-sm text-red-200 mt-2 font-bold">
                                Als je doorgaat, wordt het eventtype/show gewijzigd, maar de reserveringen blijven staan (mogelijk mismatch).
                            </p>
                        </div>
                    </div>
                    
                    <label className="flex items-center space-x-3 p-3 bg-black/40 rounded-lg cursor-pointer hover:bg-black/60 transition-colors border border-red-900/50">
                        <input 
                            type="checkbox" 
                            checked={forceBookings} 
                            onChange={(e) => setForceBookings(e.target.checked)}
                            className="rounded bg-slate-800 border-red-500 text-red-500 focus:ring-red-500 w-5 h-5"
                        />
                        <span className="text-sm text-red-100 font-bold">Ik begrijp de risico's, forceer wijziging.</span>
                    </label>
                </div>
            )}

            {/* Standard Conflicts (Event on Event) */}
            {eventConflicts.length > 0 && (
                <div className="p-4 bg-amber-900/20 border border-amber-900/50 rounded-xl space-y-4">
                    <div className="flex items-start space-x-3 text-amber-500">
                        <AlertTriangle size={24} />
                        <div>
                            <h4 className="font-bold text-sm">Opgelet: Bestaande event data</h4>
                            <p className="text-xs text-amber-200/70">Er staan al events op {eventConflicts.length} van de geselecteerde data.</p>
                        </div>
                    </div>
                    
                    <label className="flex items-center space-x-3 p-3 bg-black/20 rounded-lg cursor-pointer hover:bg-black/40 transition-colors">
                        <input 
                            type="checkbox" 
                            checked={overwrite} 
                            onChange={(e) => setOverwrite(e.target.checked)}
                            className="rounded bg-slate-800 border-amber-500/50 text-amber-500 focus:ring-amber-500"
                        />
                        <span className="text-sm text-amber-100">Overschrijf bestaande events (Verwijder oude)</span>
                    </label>
                    
                    {!overwrite && (
                        <p className="text-xs text-slate-400 italic pl-2">
                            * Zonder dit vinkje worden conflicterende data overgeslagen.
                        </p>
                    )}
                </div>
            )}

            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Samenvatting</h4>
                <ul className="text-sm text-slate-300 space-y-1 list-disc pl-4">
                    <li>Type: <strong>{eventType}</strong></li>
                    {eventType === 'SHOW' && <li>Show: <strong>{shows.find(s => s.id === selectedShowId)?.name}</strong></li>}
                    <li>Totaal Data: <strong>{targetDates.length}</strong></li>
                    <li>Status: <strong>{status}</strong></li>
                </ul>
            </div>
        </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-950">
        <div className="px-6 py-4 bg-black/20 border-b border-slate-900">
            <Stepper steps={STEPS} current={step} />
        </div>

        <div className="flex-grow overflow-y-auto p-6 md:p-8">
            <div className="max-w-5xl mx-auto h-full">
                {step === 0 && renderVisualCalendar()}
                <div className="max-w-3xl mx-auto">
                    {step === 1 && renderConfigStep()}
                    {step === 2 && renderConfirmStep()}
                </div>
            </div>
        </div>

        <div className="p-6 border-t border-slate-900 bg-slate-900/50 flex justify-between items-center">
            <Button variant="ghost" onClick={step === 0 ? onClose : () => setStep(s => s-1)}>
                {step === 0 ? 'Annuleren' : 'Vorige'}
            </Button>
            
            {step < 2 ? (
                <Button onClick={() => setStep(s => s+1)} disabled={selectedDates.size === 0}>
                    Volgende <ArrowRight size={16} className="ml-2"/>
                </Button>
            ) : (
                <Button 
                    onClick={handleSubmit} 
                    disabled={isProcessing || (Object.keys(bookingConflicts).length > 0 && !forceBookings)} 
                    className={`${(Object.keys(bookingConflicts).length > 0 && !forceBookings) ? 'bg-slate-700 text-slate-500' : 'bg-emerald-600 hover:bg-emerald-700'} min-w-[150px]`}
                >
                    {isProcessing ? 'Bezig...' : 'Genereren'}
                </Button>
            )}
        </div>
    </div>
  );
};
