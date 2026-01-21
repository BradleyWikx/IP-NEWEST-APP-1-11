
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Calendar, Users, CheckCircle2, AlertCircle, ShoppingBag, 
  CreditCard, FileText, User, Tag, ArrowRight, Save, X, RotateCcw,
  Zap, Search, ChevronDown, ChevronUp, AlertTriangle, Building2, MapPin, Phone, Mail,
  Utensils, PartyPopper, LayoutGrid
} from 'lucide-react';
import { Button, Card, Input, Stepper } from '../UI';
import { AvailabilityFinder } from './AvailabilityFinder';
import { MerchandisePicker, MerchandiseSummaryList } from '../MerchandisePicker';
import { 
  bookingRepo, getEvents, getShowDefinitions, 
  tasksRepo, promoRepo, voucherRepo, customerRepo, getNextTableNumber, calendarRepo 
} from '../../utils/storage';
import { calculateBookingTotals, getEffectivePricing } from '../../utils/pricing';
import { triggerEmail } from '../../utils/emailEngine';
import { logAuditAction } from '../../utils/auditLogger';
import { Reservation, BookingStatus, ShowEvent, ShowDefinition, Customer, AdminPriceOverride } from '../../types';
import { MOCK_ADDONS } from '../../mock/data';
import { toLocalISOString } from '../../utils/dateHelpers';
import { ReservationSchema } from '../../utils/validation';
import { PriceOverridePanel } from './PriceOverridePanel';

const STEPS = ['Datum & Show', 'Details & Extra\'s', 'Klantgegevens', 'Status & Betaling'];

const PHONE_CODES = [
  { code: '+31', label: 'NL (+31)' },
  { code: '+32', label: 'BE (+32)' },
  { code: '+49', label: 'DE (+49)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+33', label: 'FR (+33)' },
];

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
      firstName: '', lastName: '', email: '', phone: '', phoneCode: '+31',
      street: '', houseNumber: '', zip: '', city: '', country: 'NL',
      companyName: '', billingInstructions: ''
    },
    notes: { dietary: '', structuredDietary: {}, dietaryComments: '', isCelebrating: false, celebrationText: '', internal: '' },
    // Admin Specifics
    status: 'REQUEST' as BookingStatus,
    optionExpiry: '',
    discountCode: '',
    // Price Override Logic
    adminPriceOverride: undefined as AdminPriceOverride | undefined,
    
    isPaid: false,
    paymentMethod: 'FACTUUR',
    sendEmail: true,
    alternativeDate: '',
    tableNumber: '' // NEW: Explicit Table Assignment
  });

  // Local state for expiry picker & UI toggles
  const [expiryType, setExpiryType] = useState('1WEEK');
  const [isOverridingPrice, setIsOverridingPrice] = useState(false);

  // Derived Data
  const [selectedEvent, setSelectedEvent] = useState<ShowEvent | null>(null);
  const [selectedShow, setSelectedShow] = useState<ShowDefinition | null>(null);
  const [pricing, setPricing] = useState<any>(null);
  const [financials, setFinancials] = useState<any>(null);
  const [showMobileSummary, setShowMobileSummary] = useState(false);
  
  // Capacity Check
  const [capacityData, setCapacityData] = useState<{ booked: number, max: number } | null>(null);

  // Customer Search State
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter to Submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, formData]); 

  // --- SYNC ADDONS WITH GUESTS ---
  useEffect(() => {
    // Only sync if quantity matches previous guest count or is 0, otherwise keep manual overrides
    // For simplicity in this wizard, we reset addons to guest count if they are selected
    setFormData(prev => ({
        ...prev,
        addons: prev.addons.map(a => ({ ...a, quantity: prev.totalGuests }))
    }));
  }, [formData.totalGuests]);

  // --- CALCULATIONS & DATA FETCH ---
  useEffect(() => {
    if (formData.date && formData.showId) {
      const events = getEvents();
      const shows = getShowDefinitions();
      const event = events.find(e => e.date === formData.date);
      const show = shows.find(s => s.id === formData.showId);
      
      if (event && show) {
        setSelectedEvent(event);
        setSelectedShow(show);
        
        // Auto-assign next table number if not set
        if (!formData.tableNumber) {
           const nextTable = getNextTableNumber(formData.date);
           setFormData(prev => ({ ...prev, tableNumber: nextTable.toString() }));
        }
        
        // --- LIVE CAPACITY CHECK ---
        const allRes = bookingRepo.getAll();
        const activeRes = allRes.filter(r => 
            r.date === formData.date && 
            r.status !== 'CANCELLED' && 
            r.status !== 'ARCHIVED' && 
            r.status !== 'NOSHOW' &&
            r.status !== 'WAITLIST'
        );
        const booked = activeRes.reduce((s, r) => s + r.partySize, 0);
        setCapacityData({ booked, max: Number(event.capacity) || 230 });
        
        const pricingProfile = getEffectivePricing(event, show);
        setPricing(pricingProfile);
        
        // Calculate Totals
        const totals = calculateBookingTotals({
          totalGuests: formData.totalGuests,
          packageType: formData.packageType,
          addons: formData.addons,
          merchandise: formData.merchandise,
          promo: formData.discountCode,
          date: formData.date,
          showId: formData.showId,
          adminOverride: formData.adminPriceOverride
        }, pricingProfile);

        setFinancials(totals);
      }
    }
  }, [formData.date, formData.showId, formData.totalGuests, formData.packageType, formData.addons, formData.merchandise, formData.discountCode, formData.adminPriceOverride]);

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
            setFormData(prev => ({ ...prev, optionExpiry: toLocalISOString(newDate) }));
        } else if (expiryType === '2WEEKS') {
            newDate.setDate(today.getDate() + 14);
            setFormData(prev => ({ ...prev, optionExpiry: toLocalISOString(newDate) }));
        }
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
        phoneCode: customer.phoneCode || '+31',
        street: customer.street || '',
        houseNumber: customer.houseNumber || '',
        zip: customer.zip || '',
        city: customer.city || '',
        country: customer.country || 'NL',
        companyName: customer.companyName || '',
        billingInstructions: customer.billingInstructions || ''
      }
    }));
    setShowSuggestions(false);
    setCustomerQuery('');
  };

  // --- ACTIONS ---

  const handleDateSelect = (date: string, showId: string, event: any, guests: number) => {
    setFormData(prev => ({ ...prev, date, showId, totalGuests: guests }));
    setStep(1);
  };

  const handlePriceOverrideSave = (override: AdminPriceOverride | undefined, sendEmail: boolean) => {
      setFormData(prev => ({ ...prev, adminPriceOverride: override }));
      setIsOverridingPrice(false);
  };

  const handleSubmit = async () => {
    if (!financials) return;
    setSubmitError(null);
    setIsSubmitting(true);

    const fullPhone = `${formData.customer.phoneCode} ${formData.customer.phone}`;
    
    // Format Table ID (ensure TAB- prefix)
    const formattedTableId = formData.tableNumber 
      ? (formData.tableNumber.startsWith('TAB-') ? formData.tableNumber : `TAB-${formData.tableNumber}`) 
      : undefined;

    // 1. Create Reservation Object
    const resId = `RES-${Date.now()}`;
    const newReservation: Reservation = {
      id: resId,
      createdAt: new Date().toISOString(),
      customerId: `CUST-${Date.now()}`,
      customer: {
        id: `CUST-${Date.now()}`,
        ...formData.customer,
        phone: fullPhone,
        address: `${formData.customer.street} ${formData.customer.houseNumber}, ${formData.customer.city}`,
        isBusiness: !!formData.customer.companyName
      },
      date: formData.date,
      showId: formData.showId,
      status: formData.status,
      partySize: formData.totalGuests,
      packageType: formData.packageType,
      addons: formData.addons,
      merchandise: formData.merchandise,
      alternativeDate: formData.alternativeDate,
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
        voucherCode: formData.discountCode,
        priceBreakdown: financials.items
      },
      notes: {
          ...formData.notes,
          dietary: formData.notes.dietary // Combined string should be constructed before submit if needed, or rely on structured
      },
      adminPriceOverride: formData.adminPriceOverride,
      optionExpiresAt: formData.status === 'OPTION' && formData.optionExpiry ? formData.optionExpiry : undefined,
      startTime: selectedEvent?.times?.start || '19:30',
      tableId: formattedTableId
    };

    // --- ZOD VALIDATION ---
    const validationResult = ReservationSchema.safeParse(newReservation);
    if (!validationResult.success) {
        console.error("Validation Error:", validationResult.error.format());
        const firstError = validationResult.error.errors[0];
        setSubmitError(`Validatie fout (${firstError.path.join('.')}): ${firstError.message}`);
        setIsSubmitting(false);
        return;
    }

    // 2. Save
    bookingRepo.add(newReservation);

    // 3. Audit
    logAuditAction('CREATE_RESERVATION_ADMIN', 'RESERVATION', resId, {
      description: `Created booking as admin. Status: ${formData.status}. Table: ${formattedTableId || 'None'}`,
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

  const updateCustomer = (field: string, val: any) => {
    setFormData(prev => ({
      ...prev,
      customer: { ...prev.customer, [field]: val }
    }));
  };

  // --- COMPONENTS ---
  
  const CompactSummary = () => (
    <Card className="p-4 md:p-6 bg-slate-950 border-slate-800 flex flex-col h-full shadow-xl">
      <div className="mb-4 pb-4 border-b border-slate-800">
        <h3 className="text-lg font-bold text-white flex items-center justify-between">
          <span>Totaal</span>
          <span className="font-serif text-2xl text-amber-500">€{(financials?.amountDue || 0).toFixed(2)}</span>
        </h3>
        {formData.adminPriceOverride && (
          <p className="text-[10px] text-amber-500 text-right mt-1 font-bold">⚠️ Handmatig aangepast</p>
        )}
      </div>
      
      <div className="space-y-3 text-sm text-slate-300 flex-grow overflow-y-auto max-h-[60vh] custom-scrollbar">
          {selectedShow && (
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Show</span>
              <span className="text-white font-bold text-right">{selectedShow.name}<br/>{new Date(formData.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </div>
          )}
          
          <div className="flex justify-between">
            <span>Arrangement ({formData.totalGuests}p)</span>
            <span>€{((financials?.items.find((i: any) => i.category === 'TICKET')?.total) || 0).toFixed(2)}</span>
          </div>
          
          {financials?.items.filter((i:any) => i.category === 'ADDON').map((item: any) => (
             <div key={item.id} className="flex justify-between text-xs text-slate-400">
                <span>{item.label} ({item.quantity}x)</span>
                <span>€{item.total.toFixed(2)}</span>
             </div>
          ))}

          <MerchandiseSummaryList selections={formData.merchandise} />
          
          {/* Admin Override Controls in Summary */}
          <div className="pt-6 border-t border-slate-800 space-y-4 bg-slate-900/50 -mx-4 px-4 pb-4 mb-[-1rem]">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                <Tag size={12} className="mr-1"/> Prijs Correcties
            </h4>
            
            {!isOverridingPrice ? (
                <Button variant="secondary" onClick={() => setIsOverridingPrice(true)} className="w-full text-xs h-8">
                    Prijs Aanpassen / Korting
                </Button>
            ) : (
                <div className="text-xs text-slate-400 italic">
                    Gebruik de modal om aan te passen.
                </div>
            )}
            
            {/* Promo Code Input */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Promo Code</label>
              <Input 
                placeholder="Bijv. SUMMER2024" 
                value={formData.discountCode}
                onChange={(e: any) => setFormData({...formData, discountCode: e.target.value.toUpperCase()})}
                className="h-10 text-xs bg-black/40 border-slate-700 focus:border-amber-500"
              />
            </div>
          </div>
      </div>
    </Card>
  );

  const renderStepContent = () => {
    switch (step) {
      case 0: return (
        <div className="space-y-6 animate-in fade-in">
          <div><h2 className="text-2xl font-serif text-white mb-2">Beschikbaarheid Zoeken</h2></div>
          <AvailabilityFinder initialGuests={formData.totalGuests} onSelect={handleDateSelect} />
        </div>
      );
      case 1: return (
        <div className="space-y-6 animate-in fade-in">
           {/* Package Cards */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                onClick={() => setFormData({ ...formData, packageType: 'standard' })}
                className={`p-6 rounded-xl border cursor-pointer transition-all ${formData.packageType === 'standard' ? 'bg-slate-800 border-white ring-1 ring-white' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-white text-lg">Standard</h4>
                  {formData.packageType === 'standard' && <CheckCircle2 className="text-white" size={24} />}
                </div>
                <p className="text-2xl font-serif text-amber-500">€{pricing?.standard.toFixed(2)}</p>
              </div>
              <div 
                onClick={() => setFormData({ ...formData, packageType: 'premium' })}
                className={`p-6 rounded-xl border cursor-pointer transition-all ${formData.packageType === 'premium' ? 'bg-slate-800 border-amber-500 ring-1 ring-amber-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-white text-lg">Premium</h4>
                  {formData.packageType === 'premium' && <CheckCircle2 className="text-amber-500" size={24} />}
                </div>
                <p className="text-2xl font-serif text-amber-500">€{pricing?.premium.toFixed(2)}</p>
              </div>
           </div>

           <Card className="p-6 bg-slate-900 border-slate-800">
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <Input label="Aantal Personen" type="number" className="text-lg font-bold" value={formData.totalGuests} onChange={(e: any) => setFormData({...formData, totalGuests: Math.max(1, parseInt(e.target.value) || 1)})} />
                  {capacityData && (capacityData.booked + formData.totalGuests) > capacityData.max && (
                      <div className="flex items-center text-xs text-amber-500 bg-amber-900/20 p-2 rounded border border-amber-900/50 mt-2">
                         <AlertTriangle size={14} className="mr-2 shrink-0" />
                         <span>Let op: {capacityData.booked}/{capacityData.max} bezet.</span>
                      </div>
                  )}
               </div>
             </div>
           </Card>

           {/* Add-ons */}
           <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
              <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-4 flex items-center"><Utensils size={14} className="mr-2"/> Extra Opties</h3>
              <div className="space-y-2">
                {MOCK_ADDONS.map(addon => {
                  const qty = formData.addons.find(a => a.id === addon.id)?.quantity || 0;
                  return (
                    <div key={addon.id} className="flex justify-between items-center p-3 bg-black/40 rounded-lg border border-slate-800">
                       <span className="text-sm text-slate-300">{addon.name} (€{addon.price})</span>
                       <div className="flex items-center space-x-3">
                         <label className="relative inline-flex items-center cursor-pointer">
                           <input 
                             type="checkbox" 
                             checked={qty > 0} 
                             onChange={(e) => {
                               const newAddons = formData.addons.filter(a => a.id !== addon.id);
                               if (e.target.checked) newAddons.push({ id: addon.id, quantity: formData.totalGuests });
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

           {/* Merchandise */}
           <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Merchandise</h3>
              <MerchandisePicker 
                selections={formData.merchandise} 
                totalGuests={formData.totalGuests}
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
      );
      case 2: return (
        <div className="space-y-6 animate-in fade-in">
           {/* Customer Search & Form - Same as previous */}
           <Card className="p-6 bg-slate-900 border-slate-800 space-y-4">
              <div className="flex justify-between items-center"><h3 className="text-lg font-bold text-white flex items-center"><User className="mr-2 text-amber-500"/> Klantgegevens</h3>
                <div className="relative w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} /><input className="w-full bg-black border border-slate-700 rounded-full pl-9 pr-4 py-1.5 text-xs text-white" placeholder="Zoek klant..." value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} onFocus={() => setShowSuggestions(true)} /></div>
                {showSuggestions && customerSuggestions.length > 0 && (
                  <div className="absolute top-16 right-6 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden">{customerSuggestions.map(c => (<div key={c.id} onClick={() => handleCustomerSelect(c)} className="p-3 hover:bg-slate-800 cursor-pointer text-sm text-white">{c.firstName} {c.lastName}</div>))}</div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Input label="Voornaam" value={formData.customer.firstName} onChange={(e: any) => setFormData({...formData, customer: {...formData.customer, firstName: e.target.value}})} />
                 <Input label="Achternaam" value={formData.customer.lastName} onChange={(e: any) => setFormData({...formData, customer: {...formData.customer, lastName: e.target.value}})} />
                 <Input label="Email" value={formData.customer.email} onChange={(e: any) => updateCustomer('email', e.target.value)} />
                 <Input label="Telefoon" value={formData.customer.phone} onChange={(e: any) => updateCustomer('phone', e.target.value)} />
              </div>
              
              <div className="pt-4 border-t border-slate-800">
                 <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Zakelijk & Adres</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <Input label="Bedrijfsnaam" value={formData.customer.companyName || ''} onChange={(e: any) => updateCustomer('companyName', e.target.value)} />
                    <Input label="Factuur Referentie" value={formData.customer.billingInstructions || ''} onChange={(e: any) => updateCustomer('billingInstructions', e.target.value)} />
                 </div>
              </div>
           </Card>
        </div>
      );
      case 3: return (
          <div className="space-y-6 animate-in fade-in">
             <Card className="p-6 bg-slate-900 border-slate-800 space-y-6">
                <h3 className="text-lg font-bold text-white flex items-center"><Tag className="mr-2 text-emerald-500"/> Status & Communicatie</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Status</label>
                    <select className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value as BookingStatus})}>
                      <option value="REQUEST">Aanvraag</option>
                      <option value="OPTION">Optie</option>
                      <option value="CONFIRMED">Bevestigd</option>
                      <option value="INVITED">Genodigde</option>
                    </select>
                  </div>
                  
                  {/* NEW TABLE ASSIGNMENT FIELD */}
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center"><LayoutGrid size={12} className="mr-1"/> Tafel (Optioneel)</label>
                     <Input 
                       value={formData.tableNumber} 
                       onChange={(e: any) => setFormData({...formData, tableNumber: e.target.value})}
                       placeholder="Auto"
                       className="bg-black/40"
                     />
                  </div>

                  {formData.status === 'OPTION' && (
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-xs font-bold text-amber-500 uppercase tracking-widest">Optie Verloopt Op</label>
                      <div className="grid grid-cols-2 gap-4">
                          <select className="w-full px-4 py-3 bg-black/40 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500" value={expiryType} onChange={(e) => setExpiryType(e.target.value)}>
                            <option value="1WEEK">1 Week</option>
                            <option value="2WEEKS">2 Weken</option>
                            <option value="CUSTOM">Aangepast...</option>
                          </select>
                          {expiryType === 'CUSTOM' ? <Input type="date" value={formData.optionExpiry} onChange={(e: any) => setFormData({...formData, optionExpiry: e.target.value})} /> : <div className="px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-slate-400 text-sm flex items-center">{new Date(formData.optionExpiry).toLocaleDateString()}</div>}
                      </div>
                    </div>
                  )}
                  <div className="col-span-2 pt-4 border-t border-slate-800">
                    <label className="flex items-center space-x-3 cursor-pointer"><input type="checkbox" checked={formData.sendEmail} onChange={(e) => setFormData({...formData, sendEmail: e.target.checked})} className="w-5 h-5 rounded bg-slate-800 border-slate-600 checked:bg-amber-500" /><span className="text-sm text-white">Stuur bevestigingsmail</span></label>
                  </div>
                </div>
             </Card>
             
             {submitError && (
               <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-xl flex items-center text-red-400">
                  <AlertCircle size={20} className="mr-3 shrink-0" />
                  <span className="text-sm">{submitError}</span>
               </div>
             )}
          </div>
      );
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-slate-900 rounded-full text-amber-500 border border-slate-800 hidden md:block"><Zap size={20} /></div>
          <div><h1 className="text-3xl font-serif text-white">Nieuwe Reservering</h1><p className="text-slate-500 text-sm flex items-center">Admin Booking</p></div>
        </div>
        <div className="flex space-x-3"><Button variant="ghost" onClick={() => navigate('/admin/reservations')}>Annuleren</Button></div>
      </div>
      <div className="mb-8"><Stepper steps={STEPS} current={step} /></div>
      <div className="flex flex-col lg:flex-row gap-8 pb-32">
        <div className="flex-grow">{renderStepContent()}</div>
        <div className="hidden lg:block w-80 shrink-0"><div className="sticky top-6"><CompactSummary /></div></div>
      </div>
      <div className="fixed bottom-0 left-0 w-full bg-slate-950/90 backdrop-blur-md border-t border-slate-900 p-4 z-40 lg:pl-72">
         <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="lg:hidden flex flex-col cursor-pointer" onClick={() => setShowMobileSummary(!showMobileSummary)}>
               <div className="flex items-center text-xs font-bold text-slate-500 uppercase tracking-widest">Totaal {showMobileSummary ? <ChevronDown size={12}/> : <ChevronUp size={12}/>}</div>
               <div className="text-xl font-serif text-amber-500">€{(financials?.amountDue || 0).toFixed(2)}</div>
            </div>
            <div className="flex space-x-3 ml-auto">
               {step > 0 && <Button variant="secondary" onClick={() => setStep(s => s-1)}>Terug</Button>}
               {step < STEPS.length - 1 ? <Button onClick={() => setStep(s => s+1)} disabled={step === 0 && !formData.date}>Volgende <ArrowRight size={16} className="ml-2"/></Button> : <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 shadow-[0_0_20px_rgba(5,150,105,0.3)]"><Save size={16} className="mr-2"/> Boeking Aanmaken</Button>}
            </div>
         </div>
      </div>

      {/* PRICE OVERRIDE MODAL */}
      {isOverridingPrice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
           <Card className="w-full max-w-lg bg-slate-950 border-slate-800 shadow-2xl">
              <div className="p-6">
                 {/* Create a dummy object to pass to panel */}
                 <PriceOverridePanel 
                    reservation={{
                        ...formData,
                        id: 'temp',
                        createdAt: '',
                        customerId: '',
                        financials: financials ? { ...financials, total: financials.subtotal, finalTotal: financials.amountDue, paid: 0, isPaid: false } : {} as any
                    } as any}
                    onSave={handlePriceOverrideSave}
                    onCancel={() => setIsOverridingPrice(false)}
                 />
              </div>
           </Card>
        </div>
      )}
    </div>
  );
};
