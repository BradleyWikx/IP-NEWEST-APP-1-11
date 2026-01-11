
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Calendar, Users, Gift, ShoppingBag, User, CheckCircle2, 
  ArrowRight, ArrowLeft, Loader2, Coffee, Wine, MessageSquare,
  AlertTriangle, ChevronUp, ChevronDown, Info, CreditCard, PartyPopper, Star,
  Globe, Clock
} from 'lucide-react';
import { Stepper, Button, Card, Input } from './UI';
import { MerchandisePicker, MerchandiseSummaryList } from './MerchandisePicker';
import { VoucherBox } from './VoucherUI';
import { BookingSummary } from './BookingSummary';
import { useWizardPersistence } from '../hooks/useWizardPersistence';
import { bookingRepo, notificationsRepo, getEvents, getShowDefinitions, customerRepo } from '../utils/storage';
import { triggerEmail } from '../utils/emailEngine';
import { logAuditAction } from '../utils/auditLogger';
import { Reservation, BookingStatus, EventDate } from '../types';
import { calculateBookingTotals, getEffectivePricing } from '../utils/pricing';
import { ErrorBanner } from './UI/ErrorBanner';
import { MOCK_ADDONS } from '../mock/data';
import { useIsMobile } from '../hooks/useMediaQuery';

// 8-Step Process (Payment merged into Review)
const STEPS = [
  'Datum', 
  'Aantal',
  'Arrangement', 
  'Extra\'s', 
  'Shop', 
  'Gegevens', 
  'Wensen',
  'Overzicht'
];

const CAPACITY_TARGET = 230;
const ADDON_THRESHOLD = 25;

const COUNTRY_CODES = [
  { code: 'NL', label: 'Nederland (+31)', prefix: '+31' },
  { code: 'BE', label: 'België (+32)', prefix: '+32' },
  { code: 'DE', label: 'Duitsland (+49)', prefix: '+49' },
  { code: 'OTHER', label: 'Anders', prefix: '' }
];

export const BookingWizard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  
  // Initialize state with location state if available (from Calendar)
  const { wizardData, updateWizard, resetWizard } = useWizardPersistence({
    date: location.state?.date || '',
    showId: location.state?.showId || '',
    availability: location.state?.availability || 'OPEN',
    totalGuests: 2,
    packageType: 'standard',
    addons: [],
    merchandise: [],
    voucherCode: '',
    customer: { 
      salutation: 'Dhr.', // Default
      firstName: '', 
      lastName: '', 
      email: '', 
      phone: '', 
      phoneCode: '+31', 
      street: '',
      houseNumber: '',
      zip: '',
      city: '', 
      country: 'NL',
      companyName: '',
      billingAddress: { street: '', houseNumber: '', zip: '', city: '', country: 'NL' },
      billingInstructions: ''
    },
    useBillingAddress: false, // Local state for checkbox
    notes: { dietary: '', isCelebrating: false, celebrationText: '' },
    promo: '',
    idempotencyKey: `IDEM-${Date.now()}`
  });

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showMobileSummary, setShowMobileSummary] = useState(false);
  
  // Real-time Calculation
  const [pricing, setPricing] = useState<any>(null);
  const [financials, setFinancials] = useState<any>({ subtotal: 0, amountDue: 0 });
  const [eventData, setEventData] = useState<{ event: EventDate; show: any } | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  // Address Autocomplete Simulation
  // Removed strict auto-complete for better BE support, kept simple state
  
  // Scroll to top on step change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  // Recalculate totals whenever wizardData changes
  useEffect(() => {
    const events = getEvents(); // Returns EventDate[]
    const shows = getShowDefinitions();
    const event = events.find(e => e.date === wizardData.date);
    const show = shows.find(s => s.id === wizardData.showId);

    if (event && show) {
      setEventData({ event, show });
      const priceConfig = getEffectivePricing(event, show);
      setPricing(priceConfig);
      const totals = calculateBookingTotals(wizardData, priceConfig);
      setFinancials(totals);
    }
  }, [wizardData]);

  // Duplicate Check
  useEffect(() => {
    if (wizardData.customer.email && wizardData.date) {
      const isDupe = bookingRepo.findRecentDuplicates(wizardData.customer.email, wizardData.date);
      setDuplicateWarning(!!isDupe);
    }
  }, [wizardData.customer.email, wizardData.date]);

  // Navigation Logic
  const canProceed = () => {
    switch (step) {
      case 0: return !!wizardData.date && !!wizardData.showId;
      case 1: return wizardData.totalGuests > 0;
      case 2: return !!wizardData.packageType;
      case 5: // Details
        const c = wizardData.customer;
        // Basic validation: names, email, phone, street, house number, zip, city
        const basicValid = !!c.firstName && !!c.lastName && !!c.email && c.email.includes('@') && !!c.phone && !!c.street && !!c.houseNumber && !!c.zip && !!c.city;
        
        // If separate billing is checked, those fields must be filled
        if (wizardData.useBillingAddress) {
           return basicValid && !!c.billingAddress?.street && !!c.billingAddress?.houseNumber && !!c.billingAddress?.zip && !!c.billingAddress?.city;
        }
        return basicValid;
      case 7: // Review (was 8)
        return true; 
      default: return true;
    }
  };

  const nextStep = () => {
    if (!canProceed()) return;
    
    // Logic to skip Addons if threshold not met
    if (step === 2 && wizardData.totalGuests < ADDON_THRESHOLD) {
      setStep(4); // Skip to Merch
      return;
    }
    
    setStep(s => Math.min(STEPS.length - 1, s + 1));
  };

  const prevStep = () => {
    if (step === 4 && wizardData.totalGuests < ADDON_THRESHOLD) {
      setStep(2); // Go back to Package
      return;
    }
    setStep(s => Math.max(0, s - 1));
  };

  const autofillPreviousCustomer = () => {
    const customers = customerRepo.getAll();
    const last = customers[customers.length - 1];
    if (last) {
      updateWizard({
        customer: {
          salutation: last.salutation || 'Dhr.',
          firstName: last.firstName,
          lastName: last.lastName,
          email: last.email,
          phone: last.phone,
          phoneCode: '+31', // Default
          street: last.street || '',
          houseNumber: last.houseNumber || '',
          zip: last.zip || '',
          address: last.address || '',
          city: last.city || '',
          country: last.country || 'NL',
          companyName: last.companyName || ''
        }
      });
    }
  };

  const handleCapitalize = (e: React.ChangeEvent<HTMLInputElement>, field: string, nestedField?: string) => {
    const val = e.target.value;
    const capitalized = val.charAt(0).toUpperCase() + val.slice(1);
    
    if (nestedField) {
        updateWizard({ customer: { ...wizardData.customer, [field]: { ...wizardData.customer[field], [nestedField]: capitalized } } });
    } else {
        updateWizard({ customer: { ...wizardData.customer, [field]: capitalized } });
    }
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setIsSubmitting(true);
    
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
        const resId = `RES-${Date.now()}`;
        
        const finalFinancials = {
            total: financials.subtotal,
            subtotal: financials.subtotal,
            discount: financials.discountAmount,
            finalTotal: financials.amountDue,
            paid: 0,
            isPaid: false,
            voucherCode: wizardData.voucherCode,
            voucherUsed: financials.voucherApplied,
            paymentDueAt: new Date(new Date().setDate(new Date().getDate() + 14)).toISOString()
        };

        // Combine phone code + number
        const fullPhone = `${wizardData.customer.phoneCode} ${wizardData.customer.phone}`;
        // Combine address for legacy storage if needed, but we keep fields
        const fullAddress = `${wizardData.customer.street} ${wizardData.customer.houseNumber}, ${wizardData.customer.city}`;

        const newRes: Reservation = {
          id: resId,
          createdAt: new Date().toISOString(),
          customerId: `CUST-${Date.now()}`,
          customer: {
            id: `CUST-${Date.now()}`,
            ...wizardData.customer,
            phone: fullPhone,
            address: fullAddress, // Legacy support
            isBusiness: !!wizardData.customer.companyName
          },
          date: wizardData.date,
          showId: wizardData.showId,
          status: BookingStatus.REQUEST, // ALWAYS A REQUEST
          partySize: wizardData.totalGuests,
          packageType: wizardData.packageType,
          addons: wizardData.addons,
          merchandise: wizardData.merchandise,
          financials: finalFinancials, 
          notes: wizardData.notes,
          idempotencyKey: wizardData.idempotencyKey,
          startTime: eventData?.event?.startTime // Ensure start time is saved from event def
        };

        // Create Request (Idempotent)
        const finalReservation = bookingRepo.createRequest(newRes);
        
        // Triggers
        if (finalReservation.id === resId) {
            logAuditAction('CREATE_RESERVATION', 'RESERVATION', finalReservation.id, { description: 'Wizard submission' });
            triggerEmail('BOOKING_REQUEST_RECEIVED', { type: 'RESERVATION', id: finalReservation.id, data: finalReservation });
            notificationsRepo.createFromEvent('NEW_BOOKING', finalReservation);
        }

        // Clean up
        resetWizard();
        navigate('/book/confirmation', { state: { reservation: finalReservation } });

    } catch (e) {
        setSubmitError("Er is een onverwachte fout opgetreden. Probeer het opnieuw.");
        setIsSubmitting(false);
    }
  };

  // --- RENDER STEPS ---

  const renderStepContent = () => {
    switch (step) {
      // ... Cases 0-6 remain unchanged ...
      case 0: // DATE
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-serif text-white">Wanneer wilt u komen?</h2>
            {wizardData.date ? (
              <Card className="p-6 bg-slate-900 border-amber-500/50 border flex justify-between items-center">
                <div>
                  <p className="text-sm text-slate-400 uppercase font-bold tracking-widest mb-1">Geselecteerde Datum</p>
                  <p className="text-2xl font-serif text-white">{new Date(wizardData.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  {eventData && <p className="text-emerald-500 text-sm font-bold mt-1">{eventData.show.name}</p>}
                </div>
                <Button variant="secondary" onClick={() => navigate('/book')}>Wijzig</Button>
              </Card>
            ) : (
              <div className="text-center p-8 bg-slate-900 rounded-xl border border-slate-800">
                <p className="text-slate-400 mb-4">Er is geen datum geselecteerd.</p>
                <Button onClick={() => navigate('/book')}>Open Kalender</Button>
              </div>
            )}
          </div>
        );

      case 1: // PARTY
        return (
          <div className="space-y-8">
            <h2 className="text-3xl font-serif text-white">Met hoeveel personen?</h2>
            <Card className="p-8 bg-slate-900 border-slate-800 text-center">
               <div className="flex justify-center items-center space-x-4 mb-6">
                 <button 
                   onClick={() => updateWizard({ totalGuests: Math.max(1, wizardData.totalGuests - 1) })}
                   className="w-16 h-16 rounded-full bg-slate-800 hover:bg-amber-500 hover:text-black transition-colors flex items-center justify-center text-3xl font-bold"
                 >
                   -
                 </button>
                 <div className="w-32">
                   <input 
                     type="number" 
                     className="w-full bg-transparent text-6xl font-serif text-white text-center focus:outline-none"
                     value={wizardData.totalGuests}
                     onChange={(e) => updateWizard({ totalGuests: Math.max(1, parseInt(e.target.value) || 1) })}
                   />
                 </div>
                 <button 
                   onClick={() => updateWizard({ totalGuests: Math.min(250, wizardData.totalGuests + 1) })}
                   className="w-16 h-16 rounded-full bg-slate-800 hover:bg-amber-500 hover:text-black transition-colors flex items-center justify-center text-3xl font-bold"
                 >
                   +
                 </button>
               </div>
               <p className="text-slate-400 text-sm max-w-md mx-auto">
                 {wizardData.totalGuests > CAPACITY_TARGET ? (
                   <span className="text-amber-500 font-bold flex items-center justify-center">
                     <AlertTriangle size={16} className="mr-2" />
                     Let op: Deze aanvraag overschrijdt de standaard capaciteit. We zullen de mogelijkheden voor u bekijken.
                   </span>
                 ) : (
                   "Uw aanvraag is pas definitief na onze bevestiging."
                 )}
               </p>
            </Card>
          </div>
        );

      case 2: // PACKAGE
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-serif text-white">Kies uw arrangement</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div 
                onClick={() => updateWizard({ packageType: 'standard' })}
                className={`cursor-pointer p-6 rounded-2xl border-2 transition-all ${wizardData.packageType === 'standard' ? 'border-amber-500 bg-slate-900' : 'border-slate-800 bg-slate-950 hover:bg-slate-900'}`}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-white">Standard</h3>
                  {wizardData.packageType === 'standard' && <CheckCircle2 className="text-amber-500" />}
                </div>
                <p className="text-2xl font-serif text-amber-500 mb-4">€{pricing?.standard}</p>
                <ul className="text-sm text-slate-400 space-y-2">
                  <li className="flex items-center"><CheckCircle2 size={14} className="mr-2 text-slate-600"/> Toegang tot de show</li>
                  <li className="flex items-center"><CheckCircle2 size={14} className="mr-2 text-slate-600"/> Uitgebreid Buffet</li>
                  <li className="flex items-center"><CheckCircle2 size={14} className="mr-2 text-slate-600"/> Bier, Wijn, Fris</li>
                  <li className="flex items-center"><CheckCircle2 size={14} className="mr-2 text-slate-600"/> Port, Sherry, Martini</li>
                </ul>
              </div>

              <div 
                onClick={() => updateWizard({ packageType: 'premium' })}
                className={`cursor-pointer p-6 rounded-2xl border-2 transition-all relative overflow-hidden ${wizardData.packageType === 'premium' ? 'border-amber-500 bg-slate-900' : 'border-slate-800 bg-slate-950 hover:bg-slate-900'}`}
              >
                <div className="absolute top-0 right-0 bg-amber-500 text-black text-xs font-bold px-3 py-1 rounded-bl-xl">AANBEVOLEN</div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-white">Premium</h3>
                  {wizardData.packageType === 'premium' && <CheckCircle2 className="text-amber-500" />}
                </div>
                <p className="text-2xl font-serif text-amber-500 mb-4">€{pricing?.premium}</p>
                <ul className="text-sm text-slate-400 space-y-2">
                  <li className="flex items-center"><CheckCircle2 size={14} className="mr-2 text-emerald-500"/> Alles van Standard</li>
                  <li className="flex items-center"><CheckCircle2 size={14} className="mr-2 text-emerald-500"/> Mix Dranken (Gin Tonic, etc.)</li>
                  <li className="flex items-center"><CheckCircle2 size={14} className="mr-2 text-emerald-500"/> Speciaalbieren</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 3: // ADDONS
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-serif text-white">Extra's voor groepen</h2>
            <div className="space-y-4">
              {MOCK_ADDONS.map(addon => {
                const qty = wizardData.addons.find((a: any) => a.id === addon.id)?.quantity || 0;
                return (
                  <Card key={addon.id} className={`p-6 bg-slate-900 border transition-all flex justify-between items-center ${qty > 0 ? 'border-amber-500' : 'border-slate-800'}`}>
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-slate-800 rounded-full text-amber-500">
                        {addon.id.includes('drink') ? <Wine size={24} /> : <Coffee size={24} />}
                      </div>
                      <div>
                        <h4 className="font-bold text-white">{addon.name}</h4>
                        <p className="text-amber-500 font-bold">€{addon.price.toFixed(2)} p.p.</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button 
                        onClick={() => updateWizard({ addons: qty > 0 ? wizardData.addons.filter((a:any) => a.id !== addon.id) : [...wizardData.addons, { id: addon.id, quantity: wizardData.totalGuests }] })}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${qty > 0 ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                      >
                        {qty > 0 ? 'Toegevoegd' : 'Toevoegen'}
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 text-center italic">
              Deze opties worden automatisch toegepast voor uw hele groep ({wizardData.totalGuests} personen).
            </p>
          </div>
        );

      case 4: // MERCH
        return (
          <div>
             <MerchandisePicker 
                selections={wizardData.merchandise} 
                totalGuests={wizardData.totalGuests}
                onUpdate={(id, delta) => {
                  const current = wizardData.merchandise.find((m: any) => m.id === id)?.quantity || 0;
                  const newQty = Math.max(0, current + delta);
                  const newMerch = wizardData.merchandise.filter((m: any) => m.id !== id);
                  if (newQty > 0) newMerch.push({ id, quantity: newQty });
                  updateWizard({ merchandise: newMerch });
                }}
                onSet={(id, qty) => {
                  const newMerch = wizardData.merchandise.filter((m: any) => m.id !== id);
                  if (qty > 0) newMerch.push({ id, quantity: qty });
                  updateWizard({ merchandise: newMerch });
                }}
              />
          </div>
        );

      case 5: // DETAILS
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <h2 className="text-3xl font-serif text-white">Uw Gegevens</h2>
              <button onClick={autofillPreviousCustomer} className="text-xs text-amber-500 hover:underline">
                Gebruik vorige gegevens
              </button>
            </div>
            
            {duplicateWarning && (
              <div className="p-4 bg-orange-900/20 border border-orange-900/50 rounded-xl text-orange-200 text-sm flex items-start">
                <AlertTriangle size={18} className="mr-3 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-1">Mogelijke dubbele boeking</span>
                  We zien een recente reservering op dit emailadres voor deze datum. 
                  <button onClick={() => navigate('/portal')} className="underline ml-1">Check uw portal.</button>
                </div>
              </div>
            )}

            <Card className="p-6 md:p-8 bg-slate-900 border-slate-800 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                
                {/* Salutation */}
                <div className="md:col-span-1">
                  <label className="text-xs font-bold text-amber-500/80 uppercase tracking-widest font-serif mb-2 block">Aanhef</label>
                  <select 
                    className="w-full px-4 py-3 bg-black/40 border border-slate-800 rounded-xl text-amber-50 focus:border-amber-600 outline-none"
                    value={wizardData.customer.salutation || 'Dhr.'}
                    onChange={(e) => updateWizard({ customer: { ...wizardData.customer, salutation: e.target.value } })}
                  >
                    <option value="Dhr.">Dhr.</option>
                    <option value="Mevr.">Mevr.</option>
                    <option value="Fam.">Fam.</option>
                    <option value="-">-</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  {/* Spacer for alignment if needed, or merge first name here if layout prefers */}
                  <Input 
                    label="Voornaam *" 
                    value={wizardData.customer.firstName} 
                    onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, firstName: e.target.value } })} 
                    onBlur={(e: any) => handleCapitalize(e, 'firstName')}
                  />
                </div>

                <div className="md:col-span-2">
                  <Input 
                    label="Achternaam *" 
                    value={wizardData.customer.lastName} 
                    onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, lastName: e.target.value } })} 
                    onBlur={(e: any) => handleCapitalize(e, 'lastName')}
                  />
                </div>
                <div className="md:col-span-2">
                  <Input label="Email *" type="email" value={wizardData.customer.email} onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, email: e.target.value } })} />
                </div>
                
                {/* Phone with Country Code */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-amber-500/80 uppercase tracking-widest font-serif">Telefoon *</label>
                  <div className="flex space-x-3">
                    <select 
                      className="w-40 px-4 py-3 bg-black/40 border border-slate-800 rounded-xl text-amber-50 focus:border-amber-600 outline-none"
                      value={wizardData.customer.phoneCode || '+31'}
                      onChange={(e) => updateWizard({ customer: { ...wizardData.customer, phoneCode: e.target.value } })}
                    >
                      {COUNTRY_CODES.map(c => <option key={c.code} value={c.prefix || c.code}>{c.label}</option>)}
                    </select>
                    <input 
                      type="tel" 
                      className="flex-grow px-4 py-3 bg-black/40 border border-slate-800 rounded-xl text-amber-50 focus:border-amber-600 outline-none"
                      placeholder="0612345678"
                      value={wizardData.customer.phone}
                      onChange={(e) => updateWizard({ customer: { ...wizardData.customer, phone: e.target.value } })}
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Input label="Bedrijfsnaam (Optioneel)" value={wizardData.customer.companyName} onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, companyName: e.target.value } })} />
                </div>
              </div>
              
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Adresgegevens</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="md:col-span-3">
                    <Input 
                      label="Straat *" 
                      value={wizardData.customer.street} 
                      onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, street: e.target.value } })} 
                      onBlur={(e: any) => handleCapitalize(e, 'street')}
                    />
                  </div>
                  <div>
                    <Input 
                      label="Huisnummer *" 
                      value={wizardData.customer.houseNumber} 
                      onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, houseNumber: e.target.value } })} 
                    />
                  </div>
                  
                  <div className="md:col-span-1">
                    <Input 
                      label="Postcode *" 
                      value={wizardData.customer.zip} 
                      onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, zip: e.target.value } })} 
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Input label="Woonplaats *" value={wizardData.customer.city} onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, city: e.target.value } })} onBlur={(e: any) => handleCapitalize(e, 'city')} />
                  </div>

                  <div className="md:col-span-4 space-y-2">
                    <label className="text-xs font-bold text-amber-500/80 uppercase tracking-widest font-serif">Land</label>
                    <select 
                      className="w-full px-4 py-3 bg-black/40 border border-slate-800 rounded-xl text-amber-50 focus:border-amber-600 outline-none"
                      value={wizardData.customer.country}
                      onChange={(e) => updateWizard({ customer: { ...wizardData.customer, country: e.target.value } })}
                    >
                      <option value="NL">Nederland</option>
                      <option value="BE">België</option>
                      <option value="DE">Duitsland</option>
                      <option value="OTHER">Anders</option>
                    </select>
                  </div>
                </div>
              </div>

              {wizardData.customer.companyName && (
                <div className="space-y-4 pt-4 border-t border-slate-800 animate-in fade-in">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={wizardData.useBillingAddress} 
                      onChange={(e) => updateWizard({ useBillingAddress: e.target.checked })} 
                      className="w-5 h-5 rounded bg-slate-800 border-slate-600 checked:bg-amber-500"
                    />
                    <span className="text-sm text-white">Factuuradres is anders dan bezoekadres?</span>
                  </label>

                  {wizardData.useBillingAddress && (
                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-3">
                          <Input 
                            label="Straat (Factuur) *" 
                            value={wizardData.customer.billingAddress?.street || ''} 
                            onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, billingAddress: { ...wizardData.customer.billingAddress, street: e.target.value } } })} 
                            onBlur={(e: any) => handleCapitalize(e, 'billingAddress', 'street')}
                          />
                        </div>
                        <div>
                          <Input 
                            label="Nr *" 
                            value={wizardData.customer.billingAddress?.houseNumber || ''} 
                            onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, billingAddress: { ...wizardData.customer.billingAddress, houseNumber: e.target.value } } })} 
                          />
                        </div>
                        <div className="md:col-span-1">
                          <Input 
                            label="Postcode *" 
                            value={wizardData.customer.billingAddress?.zip || ''} 
                            onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, billingAddress: { ...wizardData.customer.billingAddress, zip: e.target.value } } })} 
                          />
                        </div>
                        <div className="md:col-span-3">
                          <Input 
                            label="Stad (Factuur) *" 
                            value={wizardData.customer.billingAddress?.city || ''} 
                            onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, billingAddress: { ...wizardData.customer.billingAddress, city: e.target.value } } })} 
                            onBlur={(e: any) => handleCapitalize(e, 'billingAddress', 'city')}
                          />
                        </div>
                        <div className="md:col-span-4 space-y-2">
                          <label className="text-xs font-bold text-amber-500/80 uppercase tracking-widest font-serif">Land (Factuur)</label>
                          <select 
                            className="w-full px-4 py-3 bg-black/40 border border-slate-800 rounded-xl text-amber-50 focus:border-amber-600 outline-none"
                            value={wizardData.customer.billingAddress?.country || 'NL'}
                            onChange={(e) => updateWizard({ customer: { ...wizardData.customer, billingAddress: { ...wizardData.customer.billingAddress, country: e.target.value } } })}
                          >
                            <option value="NL">Nederland</option>
                            <option value="BE">België</option>
                            <option value="DE">Duitsland</option>
                            <option value="OTHER">Anders</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="pt-2">
                        <Input 
                          label="Factuur Instructies (T.a.v., PO nummer, etc.)"
                          placeholder="Bijv. T.a.v. Afdeling Finance, Inkoopnummer 12345"
                          value={wizardData.customer.billingInstructions || ''}
                          onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, billingInstructions: e.target.value } })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        );

      case 6: // NOTES
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-serif text-white">Wensen & Opmerkingen</h2>
            <Card className="p-6 bg-slate-900 border-slate-800 space-y-6">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Dieetwensen</label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {['Vegetarisch', 'Vegan', 'Glutenvrij', 'Notenallergie'].map(tag => (
                    <button 
                      key={tag}
                      onClick={() => updateWizard({ notes: { ...wizardData.notes, dietary: wizardData.notes.dietary ? `${wizardData.notes.dietary}, ${tag}` : tag } })}
                      className="px-3 py-1.5 rounded-full border border-slate-700 text-xs text-slate-400 hover:border-amber-500 hover:text-white transition-colors"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
                <textarea 
                  className="w-full bg-black/40 border border-slate-700 rounded-xl p-4 text-sm text-white focus:border-amber-500 outline-none h-32 resize-none"
                  placeholder="Beschrijf hier uw dieetwensen of allergieën..."
                  value={wizardData.notes.dietary}
                  onChange={(e) => updateWizard({ notes: { ...wizardData.notes, dietary: e.target.value } })}
                />
              </div>

              <div className="pt-6">
                <div 
                  className={`
                    p-6 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden group
                    ${wizardData.notes.isCelebrating 
                      ? 'bg-gradient-to-r from-purple-900/40 to-pink-900/40 border-purple-500' 
                      : 'bg-slate-950 border-slate-800 hover:border-slate-600 cursor-pointer'}
                  `}
                  // Only toggle if clicking the container, preventing close when typing
                  onClick={() => !wizardData.notes.isCelebrating && updateWizard({ notes: { ...wizardData.notes, isCelebrating: true } })}
                >
                  {wizardData.notes.isCelebrating && (
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-pulse pointer-events-none" />
                  )}
                  
                  <div className="flex items-center space-x-4 relative z-10">
                    <div className={`p-3 rounded-full transition-colors ${wizardData.notes.isCelebrating ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/50' : 'bg-slate-900 text-slate-500'}`}>
                      <PartyPopper size={24} />
                    </div>
                    <div className="flex-grow">
                      <h4 className={`text-lg font-bold ${wizardData.notes.isCelebrating ? 'text-white' : 'text-slate-400'}`}>
                        Wij vieren iets!
                      </h4>
                      <p className={`text-xs ${wizardData.notes.isCelebrating ? 'text-purple-200' : 'text-slate-500'}`}>
                        Verjaardag, jubileum of speciaal moment? Laat het ons weten!
                      </p>
                    </div>
                    {/* Toggle Button */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation(); // Stop bubbling
                        updateWizard({ notes: { ...wizardData.notes, isCelebrating: !wizardData.notes.isCelebrating } });
                      }}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors z-20 ${wizardData.notes.isCelebrating ? 'bg-purple-500 border-purple-500 text-white' : 'border-slate-600 text-transparent'}`}
                    >
                      <CheckCircle2 size={16} />
                    </button>
                  </div>

                  {wizardData.notes.isCelebrating && (
                    <div className="mt-4 pt-4 border-t border-purple-500/30 animate-in slide-in-from-top-2 relative z-20">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Input 
                          placeholder="Wat viert u? (Bijv. 50e Verjaardag Jan)" 
                          value={wizardData.notes.celebrationText} 
                          onChange={(e: any) => updateWizard({ notes: { ...wizardData.notes, celebrationText: e.target.value } })} 
                          className="bg-purple-900/30 border-purple-500/50 focus:border-purple-400 text-white placeholder:text-purple-300/50"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        );

      case 7: // REVIEW (Updated Text & Policies)
        return (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-3xl font-serif text-white">Controleer uw aanvraag</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-6 bg-slate-900 border-slate-800 space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                     <div>
                       <p className="text-xs text-slate-500 uppercase font-bold">Datum & Tijd</p>
                       <p className="text-white font-bold text-lg">{new Date(wizardData.date).toLocaleDateString()}</p>
                       <p className="text-slate-400">
                         {(eventData?.event as any)?.times?.start || eventData?.event?.startTime || '19:30'} Aanvang
                       </p>
                     </div>
                     <div>
                       <p className="text-xs text-slate-500 uppercase font-bold">Arrangement</p>
                       <p className="text-white font-bold text-lg capitalize">{wizardData.packageType}</p>
                       <p className="text-slate-400">{wizardData.totalGuests} Personen</p>
                     </div>
                     <div>
                       <p className="text-xs text-slate-500 uppercase font-bold">Gegevens</p>
                       <p className="text-white">{wizardData.customer.salutation} {wizardData.customer.firstName} {wizardData.customer.lastName}</p>
                       <p className="text-slate-400">{wizardData.customer.email}</p>
                       <p className="text-slate-400">{wizardData.customer.phoneCode} {wizardData.customer.phone}</p>
                       {wizardData.customer.companyName && <p className="text-amber-500 text-xs mt-1">{wizardData.customer.companyName}</p>}
                     </div>
                     <div>
                       <p className="text-xs text-slate-500 uppercase font-bold">Totaal (Indicatie)</p>
                       <p className="text-emerald-500 font-bold text-lg">€{financials.amountDue.toFixed(2)}</p>
                       {financials.voucherApplied > 0 && <p className="text-xs text-amber-500">Incl. voucher verrekening</p>}
                     </div>
                   </div>

                   <MerchandiseSummaryList selections={wizardData.merchandise} />

                   {wizardData.notes.dietary && (
                     <div className="p-3 bg-amber-900/10 border border-amber-900/30 rounded-lg text-amber-200 text-sm">
                       <span className="font-bold block text-xs uppercase mb-1 text-amber-500">Dieetwensen</span>
                       {wizardData.notes.dietary}
                     </div>
                   )}
                </Card>
              </div>

              <div className="space-y-6">
                <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                  <h4 className="font-bold text-white flex items-center">
                    <Info size={18} className="mr-2 text-blue-500" />
                    Belangrijke Informatie
                  </h4>
                  
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3 text-sm text-slate-400">
                      <Clock size={16} className="mt-0.5 shrink-0 text-amber-500" />
                      <div>
                        <p className="text-white font-bold mb-0.5">Betaling & Factuur</p>
                        <p className="text-xs leading-relaxed">
                          U ontvangt de factuur <strong className="text-slate-300">2 weken</strong> voor de show. 
                          Betaling dient uiterlijk <strong className="text-slate-300">1 week</strong> voor aanvang voldaan te zijn.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3 text-sm text-slate-400">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                      <div>
                        <p className="text-white font-bold mb-0.5">Kosteloos Wijzigen</p>
                        <p className="text-xs leading-relaxed">
                          U kunt uw reservering tot <strong className="text-slate-300">2 weken</strong> voor de voorstelling kosteloos wijzigen.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3 text-sm text-slate-400">
                       <AlertTriangle size={16} className="mt-0.5 shrink-0 text-blue-500" />
                       <div>
                         <p className="text-white font-bold mb-0.5">Aanvraag Status</p>
                         <p className="text-xs leading-relaxed">
                           Dit is een <strong>aanvraag</strong>. U ontvangt een e-mail zodra we de beschikbaarheid definitief hebben bevestigd.
                         </p>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
        
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-200 pb-32 md:pb-20 relative">
      <Stepper steps={STEPS} current={step} />

      <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8 pb-24 md:pb-0">
          {submitError && <ErrorBanner message={submitError} onDismiss={() => setSubmitError(null)} />}
          
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {renderStepContent()}
          </div>
        </div>

        {/* Desktop Sidebar Summary */}
        <div className="hidden lg:block h-full">
          <div className="sticky top-24">
            <BookingSummary data={wizardData} onUpdate={updateWizard} />
          </div>
        </div>
      </div>

      {/* Sticky Action Bar (Mobile & Desktop) */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-950/80 backdrop-blur-md border-t border-slate-800 p-4 z-40">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          
          {/* Mobile Summary Toggle */}
          <div className="lg:hidden flex flex-col cursor-pointer" onClick={() => setShowMobileSummary(!showMobileSummary)}>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest flex items-center">
              Totaal {showMobileSummary ? <ChevronDown size={12} className="ml-1"/> : <ChevronUp size={12} className="ml-1"/>}
            </span>
            <span className="text-xl font-serif text-white">€{financials.amountDue.toFixed(2)}</span>
          </div>

          {/* Navigation Buttons */}
          <div className="flex space-x-3 ml-auto">
            {step > 0 && (
              <Button variant="ghost" onClick={prevStep} disabled={isSubmitting} className="px-4">
                Terug
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button onClick={nextStep} disabled={!canProceed()} className="px-6 bg-amber-500 text-black hover:bg-amber-400">
                Volgende <ArrowRight size={16} className="ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isSubmitting} className="px-8 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/20">
                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Verstuur Aanvraag'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Summary Sheet */}
      {showMobileSummary && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileSummary(false)} />
          <div className="absolute bottom-[80px] left-0 w-full bg-slate-900 border-t border-slate-800 rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto animate-in slide-in-from-bottom-10">
            <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-6" />
            <BookingSummary data={wizardData} onUpdate={updateWizard} />
          </div>
        </div>
      )}
    </div>
  );
};
