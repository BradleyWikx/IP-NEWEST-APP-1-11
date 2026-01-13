
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Calendar, Users, CheckCircle2, AlertCircle, ShoppingBag, 
  CreditCard, FileText, User, Tag, ArrowRight, Save, X, RotateCcw,
  Zap, Search, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button, Card, Input, Stepper } from '../UI';
import { AvailabilityFinder } from './AvailabilityFinder';
import { MerchandisePicker, MerchandiseSummaryList } from '../MerchandisePicker';
import { 
  bookingRepo, getEvents, getShowDefinitions, 
  tasksRepo, promoRepo, voucherRepo, customerRepo 
} from '../../utils/storage';
import { calculateBookingTotals, getEffectivePricing } from '../../utils/pricing';
import { triggerEmail } from '../../utils/emailEngine';
import { logAuditAction } from '../../utils/auditLogger';
import { Reservation, BookingStatus, EventDate, ShowDefinition, Customer } from '../../types';
import { MOCK_ADDONS } from '../../mock/data';

const STEPS = ['Datum & Show', 'Details & Extra\'s', 'Klantgegevens', 'Status & Betaling'];

export const AdminBookingWizard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Initialize from Router State (if clicked from Calendar)
  const prefill = location.state as { date?: string; showId?: string } | undefined;
  
  const [step, setStep] = useState(prefill?.date && prefill?.showId ? 1 : 0);
  
  // --- STATE ---
  const [formData, setFormData] = useState({
    date: prefill?.date || '',
    showId: prefill?.showId || '',
    totalGuests: 2,
    packageType: 'standard' as 'standard' | 'premium',
    addons: [] as { id: string; quantity: number }[],
    merchandise: [] as { id: string; quantity: number }[],
    customer: {
      salutation: 'Dhr.',
      firstName: '', lastName: '', email: '', phone: '',
      street: '', houseNumber: '', zip: '', city: '', country: 'NL',
      companyName: ''
    },
    notes: { dietary: '', isCelebrating: false, celebrationText: '', internal: '' },
    // Admin Specifics
    status: 'REQUEST' as BookingStatus,
    optionExpiry: '',
    discountCode: '',
    manualDiscount: 0,
    overrideTotal: null as number | null,
    isPaid: false,
    paymentMethod: 'FACTUUR',
    sendEmail: true,
    ignoreAddonThresholds: false
  });

  // Local state for expiry picker
  const [expiryType, setExpiryType] = useState('1WEEK');

  // Derived Data
  const [selectedEvent, setSelectedEvent] = useState<EventDate | null>(null);
  const [selectedShow, setSelectedShow] = useState<ShowDefinition | null>(null);
  const [financials, setFinancials] = useState<any>(null);
  const [showMobileSummary, setShowMobileSummary] = useState(false);

  // Customer Search State
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter to Submit (only on final step or if valid)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
      
      // Enter to Next (if not text area)
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'TEXTAREA' && step > 0 && step < STEPS.length - 1) {
           e.preventDefault();
           setStep(s => s + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, formData]); // Re-bind on state change for valid submit

  // --- CALCULATIONS ---
  useEffect(() => {
    if (formData.date && formData.showId) {
      const events = getEvents();
      const shows = getShowDefinitions();
      const event = events.find(e => e.date === formData.date);
      const show = shows.find(s => s.id === formData.showId);
      
      if (event && show) {
        setSelectedEvent(event);
        setSelectedShow(show);
        
        const pricingProfile = getEffectivePricing(event, show);
        
        // Calculate Base Totals
        const totals = calculateBookingTotals({
          totalGuests: formData.totalGuests,
          packageType: formData.packageType,
          addons: formData.addons,
          merchandise: formData.merchandise,
          promo: formData.discountCode, // Standard engine promo
        }, pricingProfile);

        // Apply Admin Overrides
        if (formData.manualDiscount > 0) {
          totals.discountAmount += formData.manualDiscount;
          totals.priceAfterDiscount = Math.max(0, totals.subtotal - totals.discountAmount);
          totals.amountDue = Math.max(0, totals.priceAfterDiscount - totals.voucherApplied);
        }

        if (formData.overrideTotal !== null) {
          // Force final total
          totals.amountDue = formData.overrideTotal;
          (totals as any).isOverridden = true;
        }

        setFinancials(totals);
      }
    }
  }, [formData]);

  // --- CUSTOMER SEARCH ---
  useEffect(() => {
    if (customerQuery.length > 2) {
      const allCustomers = customerRepo.getAll();
      const lowerQ = customerQuery.toLowerCase();
      const matches = allCustomers.filter(c => 
        c.lastName.toLowerCase().includes(lowerQ) || 
        c.email.toLowerCase().includes(lowerQ) ||
        c.companyName?.toLowerCase().includes(lowerQ)
      ).slice(0, 5);
      setCustomerSuggestions(matches);
      setShowSuggestions(true);
    } else {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
    }
  }, [customerQuery]);

  // --- EXPIRY LOGIC ---
  useEffect(() => {
    if (formData.status === 'OPTION') {
        const today = new Date();
        let newDate = new Date();
        
        if (expiryType === '1WEEK') {
            newDate.setDate(today.getDate() + 7);
            setFormData(prev => ({ ...prev, optionExpiry: newDate.toISOString().split('T')[0] }));
        } else if (expiryType === '2WEEKS') {
            newDate.setDate(today.getDate() + 14);
            setFormData(prev => ({ ...prev, optionExpiry: newDate.toISOString().split('T')[0] }));
        }
        // If CUSTOM, we don't auto-update, let user pick
    }
  }, [expiryType, formData.status]);

  const handleCustomerSelect = (customer: Customer) => {
    setFormData(prev => ({
      ...prev,
      customer: {
        salutation: customer.salutation || 'Dhr.',
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        street: customer.street || '',
        houseNumber: customer.houseNumber || '',
        zip: customer.zip || '',
        city: customer.city || '',
        country: customer.country || 'NL',
        companyName: customer.companyName || ''
      }
    }));
    setShowSuggestions(false);
    setCustomerQuery('');
  };

  // --- ACTIONS ---

  const handleDateSelect = (date: string, showId: string, event: any) => {
    setFormData(prev => ({ ...prev, date, showId }));
    setStep(1);
  };

  const handleSubmit = async () => {
    if (!financials) return;

    // 1. Create Reservation Object
    const resId = `RES-${Date.now()}`;
    const newReservation: Reservation = {
      id: resId,
      createdAt: new Date().toISOString(),
      customerId: `CUST-${Date.now()}`,
      customer: {
        id: `CUST-${Date.now()}`,
        ...formData.customer,
        address: `${formData.customer.street} ${formData.customer.houseNumber}, ${formData.customer.city}`
      },
      date: formData.date,
      showId: formData.showId,
      status: formData.status,
      partySize: formData.totalGuests,
      packageType: formData.packageType,
      addons: formData.addons,
      merchandise: formData.merchandise,
      financials: {
        total: financials.subtotal,
        subtotal: financials.subtotal,
        discount: financials.discountAmount,
        finalTotal: financials.amountDue,
        paid: formData.isPaid ? financials.amountDue : 0,
        isPaid: formData.isPaid,
        paymentMethod: formData.isPaid ? formData.paymentMethod : undefined,
        paidAt: formData.isPaid ? new Date().toISOString() : undefined,
        paymentDueAt: new Date(new Date().setDate(new Date().getDate() + 14)).toISOString(),
        voucherCode: formData.discountCode // Store promo used
      },
      notes: formData.notes,
      optionExpiresAt: formData.status === 'OPTION' && formData.optionExpiry ? formData.optionExpiry : undefined,
      startTime: selectedEvent?.startTime || '19:30'
    };

    // 2. Save
    bookingRepo.add(newReservation);

    // 3. Audit
    logAuditAction('CREATE_RESERVATION_ADMIN', 'RESERVATION', resId, {
      description: `Created booking as admin. Status: ${formData.status}`,
      after: newReservation
    });

    // 4. Tasks (Option Expiry)
    if (formData.status === 'OPTION' && formData.optionExpiry) {
        const callDate = new Date(formData.optionExpiry);
        callDate.setDate(callDate.getDate() - 1);
        
        tasksRepo.createAutoTask({
            type: 'CALL_OPTION_EXPIRING',
            title: `Optie verloopt: ${formData.customer.lastName}`,
            notes: `Admin optie aangemaakt. Verloopt ${new Date(formData.optionExpiry).toLocaleDateString()}.`,
            dueAt: callDate.toISOString(),
            entityType: 'RESERVATION',
            entityId: resId
        });
    }

    // 5. Emails
    if (formData.sendEmail) {
       if (formData.status === 'CONFIRMED') {
         triggerEmail('BOOKING_CONFIRMED', { type: 'RESERVATION', id: resId, data: newReservation });
       } else if (formData.status === 'REQUEST') {
         triggerEmail('BOOKING_REQUEST_RECEIVED', { type: 'RESERVATION', id: resId, data: newReservation });
       } else if (formData.status === 'OPTION') {
         triggerEmail('BOOKING_OPTION_EXPIRING', { type: 'RESERVATION', id: resId, data: newReservation });
       }
    }

    navigate('/admin/reservations');
  };

  // --- COMPONENTS ---

  const CompactSummary = () => (
    <Card className="p-4 md:p-6 bg-slate-950 border-slate-800 flex flex-col h-full shadow-xl">
      <div className="mb-4 pb-4 border-b border-slate-800">
        <h3 className="text-lg font-bold text-white flex items-center justify-between">
          <span>Totaal</span>
          <span className="font-serif text-2xl text-amber-500">€{(financials?.amountDue || 0).toFixed(2)}</span>
        </h3>
        {(financials as any)?.isOverridden && (
          <p className="text-[10px] text-amber-500 text-right mt-1 font-bold">Handmatig aangepast</p>
        )}
      </div>
      
      <div className="space-y-3 text-sm text-slate-300 flex-grow overflow-y-auto max-h-[60vh] custom-scrollbar">
          {selectedShow && (
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Show</span>
              <span className="text-white font-bold text-right">{selectedShow.name}<br/>{new Date(formData.date).toLocaleDateString()}</span>
            </div>
          )}
          
          <div className="flex justify-between">
            <span>Arrangement ({formData.totalGuests}p)</span>
            <span>€{(financials?.subtotal || 0).toFixed(2)}</span>
          </div>
          
          <MerchandiseSummaryList selections={formData.merchandise} />
          
          {/* Adjustments */}
          <div className="pt-4 border-t border-slate-800 space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Promo Code</label>
              <Input 
                placeholder="Bijv. FAMILY10" 
                value={formData.discountCode}
                onChange={(e: any) => setFormData({...formData, discountCode: e.target.value.toUpperCase()})}
                className="h-9 text-xs bg-slate-900"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Korting (€)</label>
                <Input 
                  type="number"
                  value={formData.manualDiscount}
                  onChange={(e: any) => setFormData({...formData, manualDiscount: parseFloat(e.target.value) || 0})}
                  className="h-9 text-xs bg-slate-900"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Override (€)</label>
                <Input 
                  type="number"
                  placeholder="Auto"
                  value={formData.overrideTotal ?? ''}
                  onChange={(e: any) => setFormData({...formData, overrideTotal: e.target.value ? parseFloat(e.target.value) : null})}
                  className="h-9 text-xs border-amber-900/50 focus:border-amber-500 bg-slate-900"
                />
              </div>
            </div>
          </div>
      </div>
    </Card>
  );

  const renderStepContent = () => {
    switch (step) {
      case 0: // FINDER
        return (
          <div className="space-y-6 animate-in fade-in">
            <div>
              <h2 className="text-2xl font-serif text-white mb-2">Beschikbaarheid Zoeken</h2>
              <p className="text-slate-400">Zoek een geschikte datum voor de nieuwe reservering.</p>
            </div>
            <AvailabilityFinder 
              initialGuests={formData.totalGuests} 
              onSelect={handleDateSelect} 
            />
          </div>
        );

      case 1: // CORE & EXTRAS
        return (
          <div className="space-y-6 animate-in fade-in">
             <Card className="p-6 bg-slate-900 border-slate-800">
               <h3 className="text-lg font-bold text-white mb-4 flex items-center"><Users className="mr-2 text-amber-500"/> Basis</h3>
               <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="Aantal Personen" 
                    type="number" 
                    autoFocus={!!prefill?.date}
                    value={formData.totalGuests}
                    onChange={(e: any) => setFormData({...formData, totalGuests: parseInt(e.target.value) || 1})}
                  />
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Arrangement</label>
                    <select 
                      className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500"
                      value={formData.packageType}
                      onChange={(e: any) => setFormData({...formData, packageType: e.target.value})}
                    >
                      <option value="standard">Standard</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>
               </div>
             </Card>

             <Card className="p-6 bg-slate-900 border-slate-800">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="text-lg font-bold text-white flex items-center"><CheckCircle2 className="mr-2 text-emerald-500"/> Extra's</h3>
                 <label className="flex items-center space-x-2 text-xs text-slate-400 cursor-pointer">
                   <input 
                     type="checkbox" 
                     checked={formData.ignoreAddonThresholds} 
                     onChange={(e) => setFormData({...formData, ignoreAddonThresholds: e.target.checked})}
                     className="rounded bg-slate-800 border-slate-700"
                   />
                   <span>Negeer drempel (25p)</span>
                 </label>
               </div>
               
               <div className="space-y-3">
                 {MOCK_ADDONS.map(addon => {
                   const qty = formData.addons.find(a => a.id === addon.id)?.quantity || 0;
                   const isDisabled = !formData.ignoreAddonThresholds && formData.totalGuests < (addon.minGroupSize || 0);

                   return (
                     <div key={addon.id} className={`flex justify-between items-center p-3 rounded-lg border ${isDisabled ? 'bg-slate-950 border-slate-800 opacity-50' : 'bg-slate-950 border-slate-700'}`}>
                        <div>
                          <p className="text-white text-sm font-bold">{addon.name}</p>
                          <p className="text-xs text-amber-500">€{addon.price.toFixed(2)} p.p.</p>
                          {isDisabled && <p className="text-[10px] text-red-500">Min. {addon.minGroupSize} personen</p>}
                        </div>
                        <div className="flex items-center space-x-3">
                           <input 
                             type="checkbox"
                             checked={qty > 0}
                             disabled={isDisabled}
                             onChange={(e) => {
                               const newAddons = formData.addons.filter(a => a.id !== addon.id);
                               if (e.target.checked) newAddons.push({ id: addon.id, quantity: formData.totalGuests });
                               setFormData({...formData, addons: newAddons});
                             }}
                             className="w-5 h-5 rounded bg-slate-800 border-slate-600 checked:bg-amber-500"
                           />
                        </div>
                     </div>
                   );
                 })}
               </div>
             </Card>

             <Card className="p-6 bg-slate-900 border-slate-800">
               <h3 className="text-lg font-bold text-white mb-4 flex items-center"><ShoppingBag className="mr-2 text-blue-500"/> Merchandise</h3>
               <MerchandisePicker 
                 selections={formData.merchandise} 
                 totalGuests={formData.totalGuests}
                 onUpdate={(id, delta) => {
                    const current = formData.merchandise.find(m => m.id === id)?.quantity || 0;
                    const newQty = Math.max(0, current + delta);
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
             </Card>
          </div>
        );

      case 2: // CUSTOMER & NOTES
        return (
          <div className="space-y-6 animate-in fade-in">
             <Card className="p-6 bg-slate-900 border-slate-800 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-white flex items-center"><User className="mr-2 text-amber-500"/> Klantgegevens</h3>
                  <div className="relative w-64">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                      <input 
                        className="w-full bg-black border border-slate-700 rounded-full pl-9 pr-4 py-1.5 text-xs text-white focus:border-amber-500 outline-none placeholder:text-slate-600"
                        placeholder="Zoek bestaande klant..."
                        value={customerQuery}
                        onChange={(e) => setCustomerQuery(e.target.value)}
                        onFocus={() => setShowSuggestions(true)}
                      />
                    </div>
                    {showSuggestions && customerSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden">
                        {customerSuggestions.map(c => (
                          <div 
                            key={c.id} 
                            onClick={() => handleCustomerSelect(c)}
                            className="p-3 hover:bg-slate-800 cursor-pointer border-b border-slate-800 last:border-0"
                          >
                            <p className="text-sm font-bold text-white">{c.firstName} {c.lastName}</p>
                            <p className="text-xs text-slate-500">{c.email}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                   <div className="md:col-span-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Aanhef</label>
                      <select 
                        className="w-full px-4 py-3 bg-black/40 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500"
                        value={formData.customer.salutation}
                        onChange={(e) => setFormData({...formData, customer: {...formData.customer, salutation: e.target.value}})}
                      >
                        <option value="Dhr.">Dhr.</option>
                        <option value="Mevr.">Mevr.</option>
                        <option value="Fam.">Fam.</option>
                        <option value="-">-</option>
                      </select>
                   </div>
                   <div className="md:col-span-3">
                      <Input autoFocus label="Voornaam" value={formData.customer.firstName} onChange={(e: any) => setFormData({...formData, customer: {...formData.customer, firstName: e.target.value}})} />
                   </div>
                   
                   <div className="md:col-span-2">
                      <Input label="Achternaam" value={formData.customer.lastName} onChange={(e: any) => setFormData({...formData, customer: {...formData.customer, lastName: e.target.value}})} />
                   </div>
                   <div className="md:col-span-2">
                      <Input label="Email" value={formData.customer.email} onChange={(e: any) => setFormData({...formData, customer: {...formData.customer, email: e.target.value}})} />
                   </div>
                   
                   <div className="md:col-span-2">
                      <Input label="Telefoon" value={formData.customer.phone} onChange={(e: any) => setFormData({...formData, customer: {...formData.customer, phone: e.target.value}})} />
                   </div>
                   <div className="md:col-span-2">
                     <Input label="Bedrijf (Optioneel)" value={formData.customer.companyName} onChange={(e: any) => setFormData({...formData, customer: {...formData.customer, companyName: e.target.value}})} />
                   </div>
                </div>
             </Card>

             <Card className="p-6 bg-slate-900 border-slate-800 space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center"><FileText className="mr-2 text-blue-500"/> Notities</h3>
                <div className="space-y-4">
                   <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Dieetwensen</label>
                     <textarea 
                       className="w-full bg-black/40 border border-slate-800 rounded-xl p-3 text-white text-sm focus:border-amber-500 outline-none h-20 resize-none"
                       value={formData.notes.dietary}
                       onChange={(e) => setFormData({...formData, notes: {...formData.notes, dietary: e.target.value}})}
                     />
                   </div>
                   <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Interne Notitie (Admin Only)</label>
                     <textarea 
                       className="w-full bg-amber-900/10 border border-amber-900/30 rounded-xl p-3 text-amber-100 text-sm focus:border-amber-500 outline-none h-20 resize-none placeholder:text-amber-500/30"
                       placeholder="Bijv. VIP gast, extra aandacht nodig..."
                       value={formData.notes.internal}
                       onChange={(e) => setFormData({...formData, notes: {...formData.notes, internal: e.target.value}})}
                     />
                   </div>
                </div>
             </Card>
          </div>
        );

      case 3: // STATUS & PAYMENT
        return (
          <div className="space-y-6 animate-in fade-in">
             <Card className="p-6 bg-slate-900 border-slate-800 space-y-6">
                <h3 className="text-lg font-bold text-white flex items-center"><Tag className="mr-2 text-emerald-500"/> Status & Communicatie</h3>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Status</label>
                    <select 
                      className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500"
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as BookingStatus})}
                    >
                      <option value="REQUEST">Aanvraag (Request)</option>
                      <option value="OPTION">Optie (Option)</option>
                      <option value="CONFIRMED">Bevestigd (Confirmed)</option>
                      <option value="INVITED">Genodigde (Invited)</option>
                    </select>
                  </div>

                  {/* Smart Expiry Picker for Options */}
                  {formData.status === 'OPTION' && (
                    <div className="space-y-1.5 animate-in fade-in">
                      <label className="text-xs font-bold text-amber-500 uppercase tracking-widest">Optie Verloopt Op</label>
                      <div className="grid grid-cols-2 gap-4">
                          <select 
                            className="w-full px-4 py-3 bg-black/40 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500"
                            value={expiryType}
                            onChange={(e) => setExpiryType(e.target.value)}
                          >
                            <option value="1WEEK">1 Week (Standaard)</option>
                            <option value="2WEEKS">2 Weken</option>
                            <option value="CUSTOM">Aangepast...</option>
                          </select>
                          
                          {expiryType === 'CUSTOM' ? (
                              <Input 
                                type="date" 
                                value={formData.optionExpiry}
                                onChange={(e: any) => setFormData({...formData, optionExpiry: e.target.value})}
                              />
                          ) : (
                              <div className="px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-slate-400 text-sm flex items-center">
                                  {new Date(formData.optionExpiry).toLocaleDateString()}
                              </div>
                          )}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-800">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.sendEmail} 
                        onChange={(e) => setFormData({...formData, sendEmail: e.target.checked})}
                        className="w-5 h-5 rounded bg-slate-800 border-slate-600 checked:bg-amber-500"
                      />
                      <span className="text-sm text-white">Stuur automatische bevestigingsmail naar klant</span>
                    </label>
                  </div>
                </div>
             </Card>

             <Card className="p-6 bg-slate-900 border-slate-800 space-y-6">
                <h3 className="text-lg font-bold text-white flex items-center"><CreditCard className="mr-2 text-blue-500"/> Betaling</h3>
                
                <div className="grid grid-cols-2 gap-4">
                   <div className="col-span-2 flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-sm text-slate-400">Direct als betaald markeren?</span>
                      <div 
                         onClick={() => setFormData({...formData, isPaid: !formData.isPaid})}
                         className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${formData.isPaid ? 'bg-emerald-500' : 'bg-slate-800'}`}
                      >
                         <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.isPaid ? 'left-7' : 'left-1'}`} />
                      </div>
                   </div>

                   {formData.isPaid && (
                     <div className="col-span-2 space-y-1.5 animate-in fade-in">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Betaalmethode</label>
                        <select 
                          className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500"
                          value={formData.paymentMethod}
                          onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                        >
                          <option value="FACTUUR">Op Factuur</option>
                          <option value="PIN">Pin</option>
                          <option value="CASH">Contant</option>
                          <option value="IDEAL">iDeal</option>
                        </select>
                     </div>
                   )}
                </div>
             </Card>
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-slate-900 rounded-full text-amber-500 border border-slate-800 hidden md:block">
            <Zap size={20} />
          </div>
          <div>
            <h1 className="text-3xl font-serif text-white">Nieuwe Reservering</h1>
            <p className="text-slate-500 text-sm flex items-center">Admin Booking <span className="mx-2">•</span> <span className="text-xs text-slate-600 bg-slate-900 px-1.5 rounded">Ctrl+Enter to Submit</span></p>
          </div>
        </div>
        <div className="flex space-x-3">
           <Button variant="ghost" onClick={() => navigate('/admin/reservations')}>Annuleren</Button>
        </div>
      </div>

      {/* Stepper */}
      <div className="mb-8">
        <Stepper steps={STEPS} current={step} />
      </div>

      {/* Content Layout: Sidebar for Summary */}
      <div className="flex flex-col lg:flex-row gap-8 pb-32">
        <div className="flex-grow">
          {renderStepContent()}
        </div>
        
        {/* Desktop Sticky Sidebar Summary */}
        {step > 0 && (
          <div className="hidden lg:block w-80 shrink-0">
            <div className="sticky top-6">
              <CompactSummary />
            </div>
          </div>
        )}
      </div>

      {/* Sticky Footer (Actions & Mobile Summary Toggle) */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-950/90 backdrop-blur-md border-t border-slate-900 p-4 z-40 lg:pl-72">
         <div className="max-w-7xl mx-auto flex justify-between items-center">
            {/* Mobile Summary Trigger */}
            <div 
              className="lg:hidden flex flex-col cursor-pointer"
              onClick={() => setShowMobileSummary(!showMobileSummary)}
            >
               <div className="flex items-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                 Totaal {showMobileSummary ? <ChevronDown size={12} className="ml-1"/> : <ChevronUp size={12} className="ml-1"/>}
               </div>
               <div className="text-xl font-serif text-amber-500">€{(financials?.amountDue || 0).toFixed(2)}</div>
            </div>

            {/* Desktop Hint */}
            <div className="hidden lg:block text-sm text-slate-400">
               {step > 0 && selectedShow && (
                 <span>
                   Boeking voor <strong>{selectedShow.name}</strong> op <strong>{new Date(formData.date).toLocaleDateString()}</strong>
                 </span>
               )}
            </div>

            {/* Actions */}
            <div className="flex space-x-3 ml-auto">
               {step > 0 && <Button variant="secondary" onClick={() => setStep(s => s-1)}>Terug</Button>}
               {step < STEPS.length - 1 ? (
                 <Button onClick={() => setStep(s => s+1)} disabled={step === 0 && !formData.date}>
                   Volgende <ArrowRight size={16} className="ml-2"/>
                 </Button>
               ) : (
                 <Button onClick={handleSubmit} className="bg-emerald-600 hover:bg-emerald-700 shadow-[0_0_20px_rgba(5,150,105,0.3)]">
                   <Save size={16} className="mr-2"/> Boeking Aanmaken
                 </Button>
               )}
            </div>
         </div>
      </div>

      {/* Mobile Summary Sheet */}
      {showMobileSummary && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileSummary(false)} />
          <div className="absolute bottom-[80px] left-0 w-full animate-in slide-in-from-bottom-10 max-h-[60vh] overflow-hidden rounded-t-2xl shadow-2xl">
            <CompactSummary />
          </div>
        </div>
      )}
    </div>
  );
};
