
import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Save, Users, Calendar, ShoppingBag, CreditCard, 
  AlertTriangle, RefreshCw, CheckCircle2, ArrowRight,
  Utensils, Info, Mail, Wine, PartyPopper, MessageSquare, StickyNote,
  Minus, Plus, Trash2, Phone, Building2, MapPin
} from 'lucide-react';
import { Button, Input, Card, Badge } from '../UI';
import { Reservation, BookingStatus, ShowDefinition, CalendarEvent, ShowEvent, AdminPriceOverride } from '../../types';
import { bookingRepo, calendarRepo, showRepo, getShowDefinitions, getEvents } from '../../utils/storage';
import { calculateBookingTotals, getEffectivePricing } from '../../utils/pricing';
import { calculateEventStatus } from '../../utils/status';
import { logAuditAction } from '../../utils/auditLogger';
import { triggerEmail } from '../../utils/emailEngine';
import { MerchandisePicker } from '../MerchandisePicker';
import { MOCK_ADDONS } from '../../mock/data';
import { undoManager } from '../../utils/undoManager';
import { PriceOverridePanel } from './PriceOverridePanel';

const DIETARY_OPTIONS = [
  'Glutenvrij', 
  'Lactosevrij', 
  'Notenallergie', 
  'Vegetarisch', 
  'Veganistisch',
  'Geen Vis',
  'Halal',
  'Zwanger'
];

const PHONE_CODES = [
  { code: '+31', label: 'NL (+31)' },
  { code: '+32', label: 'BE (+32)' },
  { code: '+49', label: 'DE (+49)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+33', label: 'FR (+33)' },
];

const COUNTRIES = [
  { code: 'NL', label: 'Nederland' },
  { code: 'BE', label: 'België' },
  { code: 'DE', label: 'Duitsland' },
  { code: 'OTHER', label: 'Anders' },
];

interface EditReservationModalProps {
  reservation: Reservation;
  onClose: () => void;
  onSave: () => void;
  initialTab?: string;
}

const DRAFT_KEY_PREFIX = 'edit_reservation_draft_';

export const EditReservationModal: React.FC<EditReservationModalProps> = ({ reservation, onClose, onSave, initialTab = 'GENERAL' }) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  
  // Clone data for editing - Check Draft first
  const [formData, setFormData] = useState<Reservation>(() => {
    const draft = localStorage.getItem(DRAFT_KEY_PREFIX + reservation.id);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        return { ...reservation, ...parsed }; // Merge to keep safe
      } catch(e) {
        return JSON.parse(JSON.stringify(reservation));
      }
    }
    return JSON.parse(JSON.stringify(reservation));
  });
  
  const [hasDraft, setHasDraft] = useState(!!localStorage.getItem(DRAFT_KEY_PREFIX + reservation.id));
  
  // Local state for manual dietary comment to append to structured data
  const [manualDietaryNote, setManualDietaryNote] = useState('');

  // UI States
  const [sendEmail, setSendEmail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dateWarning, setDateWarning] = useState<string | null>(null);
  const [isOverridingPrice, setIsOverridingPrice] = useState(false);
  
  // Derived Calculation State
  const [financials, setFinancials] = useState<any>(null);
  const [shows, setShows] = useState<ShowDefinition[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    setShows(getShowDefinitions());
    setEvents(calendarRepo.getAll());
    
    // Try to extract initial manual note from existing string if it's not just the structured parts
    if (reservation.notes.dietary && (!reservation.notes.structuredDietary || Object.keys(reservation.notes.structuredDietary).length === 0)) {
        setManualDietaryNote(reservation.notes.dietary);
    }
    
    // Notify user of draft
    if (hasDraft) {
        undoManager.showSuccess("Concept hersteld van vorige sessie.");
    }
  }, []);

  // --- DRAFT SAVING ---
  const saveDraft = () => {
    localStorage.setItem(DRAFT_KEY_PREFIX + reservation.id, JSON.stringify(formData));
  };

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY_PREFIX + reservation.id);
    setHasDraft(false);
  };

  // --- LIVE RECALCULATION ---
  useEffect(() => {
    const event = events.find(e => e.date === formData.date);
    const show = shows.find(s => s.id === formData.showId);

    if (event && show && event.type === 'SHOW') {
      const showEvent = event as ShowEvent;
      // 1. Availability Check
      const allRes = bookingRepo.getAll().filter(r => r.date === formData.date && r.status !== 'CANCELLED' && r.id !== formData.id);
      const currentPax = allRes.reduce((sum, r) => sum + r.partySize, 0);
      const newPaxCount = currentPax + formData.partySize;
      
      const status = calculateEventStatus(newPaxCount, showEvent.capacity || 230, 0);
      if (status === 'CLOSED') {
        setDateWarning(`Let op: Deze datum is vol (${newPaxCount} pax). Opslaan forceert overboeking.`);
      } else {
        setDateWarning(null);
      }

      // 2. Pricing Calculation
      const pricingProfile = getEffectivePricing(showEvent, show);
      const totals = calculateBookingTotals({
        totalGuests: formData.partySize,
        packageType: formData.packageType,
        addons: formData.addons,
        merchandise: formData.merchandise,
        promo: formData.financials.voucherCode, 
        date: formData.date,
        showId: formData.showId,
        adminOverride: formData.adminPriceOverride
      }, pricingProfile);

      setFinancials(totals);
    }
  }, [formData.partySize, formData.packageType, formData.addons, formData.merchandise, formData.date, formData.showId, formData.adminPriceOverride, events, shows]);

  // --- HANDLERS ---

  const handleClose = () => {
    // Basic dirty check could be done here, for now we assume any open/edit might be worthy of a draft if not saved
    if (JSON.stringify(formData) !== JSON.stringify(reservation)) {
        if(confirm("Wijzigingen bewaren als concept voor later?")) {
            saveDraft();
        } else {
            clearDraft();
        }
    }
    onClose();
  };

  const handleDiscardDraft = () => {
    if(confirm("Concept verwijderen en terugkeren naar originele data?")) {
        clearDraft();
        setFormData(JSON.parse(JSON.stringify(reservation)));
        setHasDraft(false);
    }
  };

  const handleSave = async () => {
    if (!financials) return;
    setIsSaving(true);

    // 1. Update Financials in Object
    const updatedReservation: Reservation = {
      ...formData,
      financials: {
        ...formData.financials,
        total: financials.subtotal,
        subtotal: financials.subtotal,
        discount: financials.discountAmount,
        finalTotal: financials.amountDue,
        isPaid: formData.financials.paid >= financials.amountDue,
        priceBreakdown: financials.items
      }
    };

    // 2. Save to Repo
    bookingRepo.update(reservation.id, () => updatedReservation);

    // 3. Audit Log
    logAuditAction('ADMIN_EDIT', 'RESERVATION', reservation.id, {
      description: 'Reservation modified via Admin Modal',
      before: reservation,
      after: updatedReservation
    });

    // 4. Email
    if (sendEmail) {
      triggerEmail('BOOKING_CONFIRMED', { type: 'RESERVATION', id: reservation.id, data: updatedReservation });
    }

    clearDraft(); // Clear draft on successful save
    undoManager.showSuccess("Wijzigingen opgeslagen.");
    await new Promise(r => setTimeout(r, 500));
    onSave();
    onClose();
  };

  const updateCustomer = (field: string, val: any) => {
    setFormData(prev => ({
      ...prev,
      customer: { ...prev.customer, [field]: val }
    }));
  };

  const updateNotes = (field: string, val: any) => {
    setFormData(prev => ({
      ...prev,
      notes: { ...prev.notes, [field]: val }
    }));
  };

  // Helper for dietary counters
  const handleDietaryCount = (type: string, delta: number) => {
    setFormData(prev => {
        const counts = prev.notes.structuredDietary || {};
        const current = counts[type] || 0;
        const next = Math.max(0, current + delta);
        
        const newCounts = { ...counts, [type]: next };
        if (next === 0) delete newCounts[type];
        
        // Rebuild string
        const parts = Object.entries(newCounts).map(([k, v]) => `${v}x ${k}`);
        if (manualDietaryNote) parts.push(manualDietaryNote);
        
        return {
            ...prev,
            notes: {
                ...prev.notes,
                structuredDietary: newCounts,
                dietary: parts.join(', ')
            }
        };
    });
  };

  // Helper for manual dietary note
  const handleManualDietaryChange = (val: string) => {
      setManualDietaryNote(val);
      setFormData(prev => {
          const counts = prev.notes.structuredDietary || {};
          const parts = Object.entries(counts).map(([k, v]) => `${v}x ${k}`);
          if (val) parts.push(val);
          return {
              ...prev,
              notes: {
                  ...prev.notes,
                  dietary: parts.join(', ')
              }
          };
      });
  };

  // Helper for Price Override Save (Internal)
  const handlePriceOverride = (override: AdminPriceOverride | undefined) => {
      setFormData(prev => ({ ...prev, adminPriceOverride: override }));
      setIsOverridingPrice(false);
  };

  // --- RENDER ---

  if (!financials) return null; // Loading

  const delta = financials.amountDue - (reservation.financials.finalTotal || 0);
  const paid = reservation.financials.paid || 0;
  const newBalance = financials.amountDue - paid;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl bg-slate-950 border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <div className="flex items-center space-x-4">
            <div>
                <h2 className="text-xl font-serif text-white flex items-center">
                Reservering Bewerken <span className="ml-3 text-sm font-sans text-slate-500 bg-slate-900 px-2 py-1 rounded">{formData.id}</span>
                </h2>
                <p className="text-slate-500 text-xs mt-1">Wijzigingen worden direct berekend.</p>
            </div>
            {hasDraft && (
                <div className="flex items-center space-x-2 bg-amber-900/20 px-3 py-1 rounded-full border border-amber-900/50">
                    <span className="text-xs text-amber-500 font-bold">Concept Geladen</span>
                    <button onClick={handleDiscardDraft} className="text-slate-400 hover:text-red-500" title="Verwerp concept">
                        <Trash2 size={12} />
                    </button>
                </div>
            )}
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/20 px-6 overflow-x-auto">
          {[
            { id: 'GENERAL', label: 'Algemeen', icon: Users },
            { id: 'WISHES', label: 'Wensen', icon: Utensils },
            { id: 'PRODUCTS', label: 'Producten', icon: ShoppingBag },
            { id: 'FINANCIAL', label: 'Financieel', icon: CreditCard },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center px-4 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              <tab.icon size={14} className="mr-2" /> {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-grow overflow-y-auto p-6 bg-black/20 custom-scrollbar">
          
          {/* TAB: GENERAL */}
          {activeTab === 'GENERAL' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                   <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center"><Calendar size={14} className="mr-2"/> Datum & Show</h3>
                   <div className="space-y-2">
                     <label className="text-xs text-slate-400 font-bold">Datum</label>
                     <Input 
                       type="date" 
                       value={formData.date} 
                       onChange={(e: any) => setFormData({ ...formData, date: e.target.value })} 
                     />
                     {dateWarning && (
                       <div className="flex items-center text-xs text-amber-500 bg-amber-900/20 p-2 rounded border border-amber-900/50">
                         <AlertTriangle size={12} className="mr-2" /> {dateWarning}
                       </div>
                     )}
                   </div>
                   <div className="space-y-2">
                     <label className="text-xs text-slate-400 font-bold">Show Type</label>
                     <select 
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500"
                        value={formData.showId}
                        onChange={(e) => setFormData({ ...formData, showId: e.target.value })}
                     >
                       {shows.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                     </select>
                   </div>
                   <div className="space-y-2">
                     <label className="text-xs text-slate-400 font-bold">Aantal Personen</label>
                     <div className="flex items-center space-x-3">
                       <Input 
                         type="number"
                         min="1"
                         className="bg-black/40 text-center font-bold text-lg"
                         value={formData.partySize}
                         onChange={(e: any) => setFormData(prev => ({ ...prev, partySize: Math.max(1, parseInt(e.target.value) || 1) }))}
                       />
                     </div>
                   </div>
                   
                   <div className="space-y-2 pt-2 border-t border-slate-800">
                      <label className="text-xs text-slate-400 font-bold">Status</label>
                      <select 
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500"
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as BookingStatus })}
                      >
                        <option value="REQUEST">Aanvraag</option>
                        <option value="OPTION">Optie</option>
                        <option value="CONFIRMED">Bevestigd</option>
                        <option value="INVITED">Genodigde</option>
                        <option value="CANCELLED">Geannuleerd</option>
                        <option value="ARCHIVED">Archief</option>
                      </select>
                   </div>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                   <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center"><Users size={14} className="mr-2"/> Contactgegevens</h3>
                   <div className="grid grid-cols-2 gap-4">
                      <Input label="Voornaam" value={formData.customer.firstName} onChange={(e: any) => updateCustomer('firstName', e.target.value)} />
                      <Input label="Achternaam" value={formData.customer.lastName} onChange={(e: any) => updateCustomer('lastName', e.target.value)} />
                      <Input label="Email" value={formData.customer.email} onChange={(e: any) => updateCustomer('email', e.target.value)} className="col-span-2 bg-black/40" />
                      
                      {/* Phone Edit */}
                      <div className="col-span-2 flex gap-2">
                        <div className="w-1/3">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Code</label>
                            <select 
                                className="w-full px-2 py-3 bg-black/40 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500 appearance-none"
                                value={formData.customer.phoneCode || '+31'}
                                onChange={(e) => updateCustomer('phoneCode', e.target.value)}
                            >
                                {PHONE_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                            </select>
                        </div>
                        <div className="flex-grow">
                            <Input label="Telefoon" value={formData.customer.phone} onChange={(e: any) => updateCustomer('phone', e.target.value)} />
                        </div>
                      </div>

                      {/* Business Edit */}
                      <Input label="Bedrijfsnaam" value={formData.customer.companyName || ''} onChange={(e: any) => updateCustomer('companyName', e.target.value)} className="col-span-2 bg-black/40" />
                      
                      <div className="col-span-2 space-y-2 border-t border-slate-800 pt-2">
                          <Input label="Factuur Opmerking" value={formData.customer.billingInstructions || ''} onChange={(e: any) => updateCustomer('billingInstructions', e.target.value)} />
                          <div>
                             <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Alternatieve Datum</label>
                             <div className="relative">
                               <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                               <input 
                                 type="date"
                                 className="w-full pl-10 pr-4 py-3 bg-black/40 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500"
                                 value={formData.alternativeDate || ''}
                                 onChange={(e) => setFormData({...formData, alternativeDate: e.target.value})}
                               />
                             </div>
                          </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: WISHES */}
          {activeTab === 'WISHES' && (
            <div className="space-y-6 animate-in fade-in">
                
                {/* Viering */}
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                        <PartyPopper size={14} className="mr-2 text-purple-500"/> Viering
                    </h3>
                    <div className="flex flex-col space-y-4">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={formData.notes.isCelebrating} 
                                onChange={(e) => updateNotes('isCelebrating', e.target.checked)}
                                className="w-5 h-5 rounded bg-slate-800 border-slate-600 checked:bg-purple-500"
                            />
                            <span className="text-sm text-white">Is er iets te vieren?</span>
                        </label>
                        
                        {formData.notes.isCelebrating && (
                            <Input 
                                label="Wat wordt er gevierd?"
                                placeholder="Bijv. 50 jaar getrouwd"
                                value={formData.notes.celebrationText || ''}
                                onChange={(e: any) => updateNotes('celebrationText', e.target.value)}
                            />
                        )}
                    </div>
                </div>

                {/* Dieetwensen (UPDATED with Counters) */}
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                        <Utensils size={14} className="mr-2 text-amber-500"/> Dieetwensen & Allergieën
                    </h3>
                    
                    {/* Interactive Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {DIETARY_OPTIONS.map(opt => {
                        const count = formData.notes.structuredDietary?.[opt] || 0;
                        return (
                          <div key={opt} className={`flex items-center justify-between p-2 rounded-lg border transition-all ${count > 0 ? 'bg-amber-900/10 border-amber-500/50' : 'bg-black/30 border-slate-800'}`}>
                             <span className={`text-xs ${count > 0 ? 'text-white font-bold' : 'text-slate-400'}`}>{opt}</span>
                             <div className="flex items-center bg-slate-900 rounded p-0.5">
                                <button onClick={() => handleDietaryCount(opt, -1)} className="p-1 text-slate-500 hover:text-white disabled:opacity-30" disabled={count === 0}><Minus size={12}/></button>
                                <span className="w-6 text-center text-xs font-bold text-white">{count}</span>
                                <button onClick={() => handleDietaryCount(opt, 1)} className="p-1 text-slate-500 hover:text-amber-500"><Plus size={12}/></button>
                             </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Manual Override / Addition */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Extra toelichting (Dieet)</label>
                      <textarea 
                          className="w-full h-20 bg-black/40 border border-slate-800 rounded-xl p-3 text-white text-sm focus:border-amber-500 outline-none resize-none placeholder:text-slate-600"
                          placeholder="Bijv. Kruisbesmetting is fataal, allergie voor schelpdieren..."
                          value={manualDietaryNote}
                          onChange={(e) => handleManualDietaryChange(e.target.value)}
                      />
                      <p className="text-[10px] text-slate-500 mt-1 italic">
                        Resultaat op call sheet: <span className="text-amber-500">{formData.notes.dietary || '-'}</span>
                      </p>
                    </div>
                </div>

                {/* Opmerkingen */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                            <MessageSquare size={14} className="mr-2 text-blue-500"/> Opmerkingen (Klant)
                        </h3>
                        <textarea 
                            className="w-full h-32 bg-black/40 border border-slate-800 rounded-xl p-3 text-white text-sm focus:border-blue-500 outline-none resize-none"
                            placeholder="Extra wensen van de klant..."
                            value={formData.notes.comments || ''}
                            onChange={(e) => updateNotes('comments', e.target.value)}
                        />
                    </div>
                    <div className="p-6 bg-amber-900/10 border border-amber-900/30 rounded-xl space-y-4">
                        <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center">
                            <StickyNote size={14} className="mr-2"/> Interne Notities (Admin)
                        </h3>
                        <textarea 
                            className="w-full h-32 bg-black/20 border border-amber-900/30 rounded-xl p-3 text-amber-100 text-sm focus:border-amber-500 outline-none resize-none placeholder:text-amber-500/30"
                            placeholder="Alleen zichtbaar voor personeel..."
                            value={formData.notes.internal || ''}
                            onChange={(e) => updateNotes('internal', e.target.value)}
                        />
                    </div>
                </div>
            </div>
          )}

          {/* TAB: PRODUCTS */}
          {activeTab === 'PRODUCTS' && (
            <div className="space-y-6 animate-in fade-in">
               <div className="flex space-x-4">
                  <div 
                    onClick={() => setFormData({ ...formData, packageType: 'standard' })}
                    className={`flex-1 p-4 rounded-xl border cursor-pointer transition-all ${formData.packageType === 'standard' ? 'bg-slate-800 border-amber-500 ring-1 ring-amber-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
                  >
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-white">Standard</h4>
                      {formData.packageType === 'standard' && <CheckCircle2 className="text-amber-500" size={20} />}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Reguliere zitplaatsen & drankjes.</p>
                  </div>
                  <div 
                    onClick={() => setFormData({ ...formData, packageType: 'premium' })}
                    className={`flex-1 p-4 rounded-xl border cursor-pointer transition-all ${formData.packageType === 'premium' ? 'bg-slate-800 border-amber-500 ring-1 ring-amber-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
                  >
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-white">Premium</h4>
                      {formData.packageType === 'premium' && <CheckCircle2 className="text-amber-500" size={20} />}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Beste plaatsen & luxe drankjes.</p>
                  </div>
               </div>

               <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
                  <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-4 flex items-center"><Wine size={14} className="mr-2"/> Arrangement Add-ons</h3>
                  <div className="space-y-2">
                    {MOCK_ADDONS.map(addon => {
                      const qty = formData.addons.find(a => a.id === addon.id)?.quantity || 0;
                      return (
                        <div key={addon.id} className="flex justify-between items-center p-3 bg-black/40 rounded-lg border border-slate-800">
                           <span className="text-sm text-slate-300">{addon.name} (€{addon.price})</span>
                           <div className="flex items-center space-x-3">
                             {qty > 0 && <span className="text-xs font-bold text-amber-500">{qty}x</span>}
                             <label className="relative inline-flex items-center cursor-pointer">
                               <input 
                                 type="checkbox" 
                                 checked={qty > 0} 
                                 onChange={(e) => {
                                   const newAddons = formData.addons.filter(a => a.id !== addon.id);
                                   if (e.target.checked) newAddons.push({ id: addon.id, quantity: formData.partySize });
                                   setFormData({ ...formData, addons: newAddons });
                                 }}
                                 className="sr-only peer" 
                               />
                               <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                             </label>
                           </div>
                        </div>
                      );
                    })}
                  </div>
               </div>

               <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Merchandise</h3>
                  <MerchandisePicker 
                    selections={formData.merchandise} 
                    totalGuests={formData.partySize}
                    onUpdate={(id, d) => {
                      const current = formData.merchandise.find(m => m.id === id)?.quantity || 0;
                      const newQty = Math.max(0, current + d);
                      const newMerch = formData.merchandise.filter(m => m.id !== id);
                      if (newQty > 0) newMerch.push({ id, quantity: newQty });
                      setFormData({...formData, merchandise: newMerch});
                    }}
                    onSet={(id, qty) => {
                      const newMerch = formData.merchandise.filter(m => m.id !== id);
                      if (qty > 0) newMerch.push({ id, quantity: qty });
                      setFormData({...formData, merchandise: newMerch});
                    }}
                  />
               </div>
            </div>
          )}

          {/* TAB: FINANCIAL */}
          {activeTab === 'FINANCIAL' && (
            <div className="space-y-6 animate-in fade-in">
               
               {isOverridingPrice ? (
                   <PriceOverridePanel 
                      reservation={formData}
                      onSave={handlePriceOverride}
                      onCancel={() => setIsOverridingPrice(false)}
                   />
               ) : (
                   <>
                       <div className="grid grid-cols-2 gap-6">
                          {/* Before */}
                          <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl opacity-50">
                             <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Huidig</h3>
                             <div className="space-y-2">
                                <div className="flex justify-between text-sm"><span>Totaal</span> <span>€{reservation.financials.finalTotal.toFixed(2)}</span></div>
                                <div className="flex justify-between text-sm text-emerald-500"><span>Betaald</span> <span>€{paid.toFixed(2)}</span></div>
                             </div>
                          </div>

                          {/* After */}
                          <div className="p-6 bg-slate-900 border border-amber-500/50 rounded-xl shadow-lg relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-2 bg-amber-500 text-black text-[10px] font-bold uppercase rounded-bl-xl">Nieuw</div>
                             <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-4">Voorstel</h3>
                             <div className="space-y-2">
                                <div className="flex justify-between text-sm text-white"><span>Subtotaal</span> <span>€{financials.subtotal.toFixed(2)}</span></div>
                                {financials.discountAmount > 0 && (
                                  <div className="flex justify-between text-sm text-emerald-500"><span>Korting</span> <span>-€{financials.discountAmount.toFixed(2)}</span></div>
                                )}
                                <div className="flex justify-between text-lg font-bold text-white border-t border-slate-700 pt-2 mt-2">
                                  <span>Nieuw Totaal</span> 
                                  <span>€{financials.amountDue.toFixed(2)}</span>
                                </div>
                             </div>
                          </div>
                       </div>

                       {/* Action: Manual Override */}
                       <div className="flex justify-end">
                           <Button variant="secondary" onClick={() => setIsOverridingPrice(true)} className="text-xs">
                               Handmatige Prijsaanpassing
                           </Button>
                       </div>

                       {/* Delta Banner */}
                       <div className={`p-6 rounded-xl border flex items-center justify-between ${newBalance > 0 ? 'bg-amber-900/20 border-amber-500/50' : newBalance < 0 ? 'bg-blue-900/20 border-blue-500/50' : 'bg-slate-900 border-slate-800'}`}>
                          <div className="flex items-center space-x-4">
                            <div className={`p-3 rounded-full ${newBalance > 0 ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-500'}`}>
                              <RefreshCw size={24} />
                            </div>
                            <div>
                              <h4 className="font-bold text-white text-lg">
                                {newBalance > 0 ? 'Bijbetaling Vereist' : newBalance < 0 ? 'Teruggave Vereist' : 'Geen Verschil'}
                              </h4>
                              <p className="text-slate-400 text-sm">Saldo wordt aangepast na opslaan.</p>
                            </div>
                          </div>
                          <span className={`text-3xl font-mono font-bold ${newBalance > 0 ? 'text-amber-500' : newBalance < 0 ? 'text-blue-400' : 'text-slate-500'}`}>
                            {newBalance > 0 ? '+' : ''}€{newBalance.toFixed(2)}
                          </span>
                       </div>

                       {/* Breakdown List */}
                       <div className="bg-black/30 rounded-xl p-4 border border-slate-800">
                         <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Specificatie Nieuw</h4>
                         <div className="space-y-1">
                           {financials.items.map((item: any, idx: number) => (
                             <div key={idx} className="flex justify-between text-xs text-slate-300">
                               <span>{item.quantity}x {item.label}</span>
                               <span>€{item.total.toFixed(2)}</span>
                             </div>
                           ))}
                         </div>
                       </div>
                   </>
               )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-900 border-t border-slate-800 flex justify-between items-center">
           <label className="flex items-center space-x-3 cursor-pointer">
             <input 
               type="checkbox" 
               checked={sendEmail} 
               onChange={(e) => setSendEmail(e.target.checked)}
               className="w-5 h-5 rounded bg-slate-800 border-slate-600 checked:bg-amber-500"
             />
             <span className="text-sm text-slate-300">Stuur bevestiging naar klant ({formData.customer.email})</span>
           </label>

           <div className="flex space-x-3">
             <Button variant="ghost" onClick={handleClose}>Annuleren</Button>
             <Button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 min-w-[150px]">
               {isSaving ? 'Bezig...' : 'Wijzigingen Opslaan'}
             </Button>
           </div>
        </div>

      </Card>
    </div>
  );
};
