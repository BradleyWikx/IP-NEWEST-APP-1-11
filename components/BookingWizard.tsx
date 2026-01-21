
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWizardPersistence } from '../hooks/useWizardPersistence';
import { bookingRepo, notificationsRepo, getEvents, getShowDefinitions, customerRepo, requestRepo, waitlistRepo, calendarRepo, getNextTableNumber } from '../utils/storage';
import { triggerEmail } from '../utils/emailEngine';
import { logAuditAction } from '../utils/auditLogger';
import { Reservation, BookingStatus, ShowEvent, ShowDefinition, WaitlistEntry } from '../types';
import { calculateBookingTotals, getEffectivePricing } from '../utils/pricing';
import { calculateEventStatus } from '../utils/status';
import { ReservationSchema } from '../utils/validation';
import { Stepper, Button, Card, Input } from './UI';
import { BookingSummary } from './BookingSummary';
import { MerchandisePicker } from './MerchandisePicker';
import { useTranslation } from '../utils/i18n'; 
import { 
  ChevronRight, ChevronLeft, Calendar as CalendarIcon, Users, Utensils, 
  ShoppingBag, User, MessageSquare, CheckCircle2, AlertTriangle, 
  AlertCircle, Wine, Star, Loader2, Minus, Plus, Building2, MapPin, Mail, Phone, PartyPopper, Wheat, Milk, Nut, Fish, Leaf, Baby, Carrot, Globe
} from 'lucide-react';
import { MOCK_ADDONS } from '../mock/data';

// DIETARY CONFIG
const DIETARY_OPTIONS = [
  { id: 'Glutenvrij', label: 'Glutenvrij', icon: Wheat },
  { id: 'Lactosevrij', label: 'Lactosevrij', icon: Milk },
  { id: 'Notenallergie', label: 'Noten', icon: Nut },
  { id: 'Vegetarisch', label: 'Vega', icon: Carrot },
  { id: 'Veganistisch', label: 'Vegan', icon: Leaf },
  { id: 'Geen Vis', label: 'Geen Vis', icon: Fish },
  { id: 'Zwanger', label: 'Zwanger', icon: Baby },
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

const CAPACITY_TARGET = 230;
const ADDON_THRESHOLD = 25;

export const BookingWizard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language, setLanguage } = useTranslation();

  // Initialize state with location state if available (from Calendar)
  const { wizardData, updateWizard, resetWizard } = useWizardPersistence({
    date: location.state?.date || '',
    showId: location.state?.showId || '',
    status: location.state?.availability || 'OPEN',
    totalGuests: 2,
    packageType: 'standard',
    addons: [],
    merchandise: [],
    voucherCode: '',
    customer: { 
      salutation: 'Dhr.',
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
    useBillingAddress: false,
    notes: { 
      dietary: '', 
      structuredDietary: {}, 
      comments: '',
      isCelebrating: false, 
      celebrationText: '' 
    },
    promo: '',
    idempotencyKey: `IDEM-${Date.now()}`
  });

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false); 
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Real-time Calculation State
  const [pricing, setPricing] = useState<any>(null);
  const [financials, setFinancials] = useState<any>({ subtotal: 0, amountDue: 0, items: [] });
  const [eventData, setEventData] = useState<{ event: ShowEvent; show: ShowDefinition } | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  
  // Waitlist Logic
  const [isWaitlistMode, setIsWaitlistMode] = useState(false);
  const [isWaitlistFull, setIsWaitlistFull] = useState(false); 

  // --- Dynamic Step Configuration ---
  const stepConfig = useMemo(() => {
    if (isWaitlistMode) {
      return {
        labels: [t('step_date'), t('step_party'), t('step_details'), t('step_review')],
        indices: [0, 1, 5, 7] // Map logical step indices to visual order
      };
    }
    return {
      labels: [
        t('step_date'), t('step_party'), t('step_package'), t('step_extras'), 
        t('step_shop'), t('step_details'), t('step_wishes'), t('step_review')
      ],
      indices: [0, 1, 2, 3, 4, 5, 6, 7]
    };
  }, [isWaitlistMode, t]);

  // Determine current visual step for the Stepper component
  const currentVisualStep = stepConfig.indices.indexOf(step);

  // --- Effects ---

  // Scroll to top on step change
  useEffect(() => {
    window.scrollTo(0, 0);
    setShowValidationErrors(false); 
  }, [step]);

  // Recalculate totals & Determine Waitlist Mode
  useEffect(() => {
    const events = getEvents();
    const shows = getShowDefinitions();
    const waitlist = waitlistRepo.getAll();
    const allReservations = bookingRepo.getAll(); 

    const event = events.find(e => e.date === wizardData.date);
    const show = shows.find(s => s.id === wizardData.showId);

    if (event && show) {
      setEventData({ event, show });
      
      const now = new Date();
      const localTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      if (wizardData.date < localTodayStr) {
         setSubmitError(t('err_date_past'));
         setIsWaitlistFull(true); 
         return; 
      } else {
         setSubmitError(null);
         setIsWaitlistFull(false);
      }

      // Pricing
      const priceConfig = getEffectivePricing(event, show);
      setPricing(priceConfig);
      
      // Calculate Financials
      const totals = calculateBookingTotals(wizardData, priceConfig);
      setFinancials(totals);

      // --- LIVE STATUS CHECK ---
      const wlCount = waitlist.filter(w => w.date === wizardData.date && w.status === 'PENDING').length;
      
      const activeRes = allReservations.filter(r => 
        r.date === wizardData.date && 
        r.status !== 'CANCELLED' && 
        r.status !== 'ARCHIVED' && 
        r.status !== 'NOSHOW' &&
        r.status !== 'WAITLIST'
      );
      const currentBooked = activeRes.reduce((sum, r) => sum + (Number(r.partySize) || 0), 0);

      const dynamicCapacity = Number(event.capacity) || CAPACITY_TARGET;
      const calculatedStatus = calculateEventStatus(
          currentBooked, 
          dynamicCapacity, 
          wlCount,
          event.status
      );

      if (calculatedStatus === 'WAITLIST') {
          setIsWaitlistMode(true);
          setIsWaitlistFull(false);
      } else if (calculatedStatus === 'CLOSED') {
          setIsWaitlistMode(true);
          setIsWaitlistFull(true);
      } else {
          setIsWaitlistMode(false);
          setIsWaitlistFull(false);
      }
    }
  }, [wizardData, t]);

  // Duplicate Check
  useEffect(() => {
    if (wizardData.customer.email && wizardData.date) {
      const isDupe = bookingRepo.findRecentDuplicates(wizardData.customer.email, wizardData.date);
      setDuplicateWarning(!!isDupe);
    }
  }, [wizardData.customer.email, wizardData.date]);

  // --- Validation Logic ---

  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    const c = wizardData.customer;

    if (step === 5) { // Details Step
      if (!c.firstName) errors.firstName = t('err_firstname');
      if (!c.lastName) errors.lastName = t('err_lastname');
      if (!c.street) errors.street = t('err_street');
      if (!c.city) errors.city = t('err_city');
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!c.email) {
        errors.email = t('err_email_req');
      } else if (!emailRegex.test(c.email)) {
        errors.email = t('err_email_inv');
      }

      const phoneDigits = c.phone.replace(/\D/g, '');
      if (!c.phone) {
        errors.phone = t('err_phone_req');
      } else if (phoneDigits.length < 8) {
        errors.phone = t('err_phone_inv');
      }

      if (!c.zip) errors.zip = t('err_zip');
      if (!c.houseNumber) errors.houseNumber = t('err_house_nr');
    }

    return errors;
  }, [wizardData.customer, wizardData.useBillingAddress, step, t]);

  const getFieldError = (field: string): string | undefined => {
    return showValidationErrors ? validationErrors[field] : undefined;
  };

  const dismissError = () => setSubmitError(null);

  // --- Logic Helpers ---

  const canProceed = () => {
    if (isWaitlistFull) return false;

    switch (step) {
      case 0: return !!wizardData.date && !!wizardData.showId;
      case 1: return wizardData.totalGuests > 0;
      case 2: return !!wizardData.packageType;
      case 5: return Object.keys(validationErrors).length === 0;
      case 7: return true; 
      default: return true;
    }
  };

  const nextStep = () => {
    if (!canProceed()) {
      setShowValidationErrors(true);
      return;
    }
    
    // WAITLIST FLOW: Skip Package (2), Addons (3), Merch (4) -> Go directly to Details (5)
    if (isWaitlistMode && step === 1) {
      setStep(5);
      return;
    }

    // WAITLIST FLOW: Skip Wishes (6) -> Go directly to Review (7)
    if (isWaitlistMode && step === 5) {
      setStep(7);
      return;
    }

    // REGULAR FLOW: Skip Addons if threshold not met
    if (step === 2 && wizardData.totalGuests < ADDON_THRESHOLD) {
      setStep(4); // Skip to Merch
      return;
    }
    
    setStep(s => Math.min(stepConfig.indices[stepConfig.indices.length - 1], s + 1));
  };

  const prevStep = () => {
    // WAITLIST FLOW: Back from Review (7) -> Details (5)
    if (isWaitlistMode && step === 7) {
      setStep(5);
      return;
    }

    // WAITLIST FLOW: Back from Details (5) -> Party (1)
    if (isWaitlistMode && step === 5) {
      setStep(1);
      return;
    }

    // REGULAR FLOW: Back from Merch (4) -> Package (2) (Skip Addons)
    if (step === 4 && wizardData.totalGuests < ADDON_THRESHOLD) {
      setStep(2); 
      return;
    }
    setStep(s => Math.max(0, s - 1));
  };

  const autofillPreviousCustomer = () => {
    const customers = customerRepo.getAll();
    const last = customers[customers.length - 1];
    
    if (last) {
      let cleanPhone = last.phone || '';
      let cleanCode = last.phoneCode || '+31';

      if (!last.phoneCode && cleanPhone.startsWith('+')) {
         const match = cleanPhone.match(/^(\+\d{2,3})(.*)$/);
         if (match) {
             cleanCode = match[1];
             cleanPhone = match[2];
         }
      }

      updateWizard({
        customer: {
          salutation: last.salutation || 'Dhr.',
          firstName: last.firstName,
          lastName: last.lastName,
          email: last.email,
          phone: cleanPhone,
          phoneCode: cleanCode,
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

  const handleGuestChange = (newCount: number) => {
    const validCount = Math.max(1, Math.min(250, newCount));
    
    const updatedAddons = wizardData.addons.map((addon: any) => ({
      ...addon,
      quantity: validCount
    }));

    updateWizard({ 
        totalGuests: validCount,
        addons: updatedAddons
    });
  };

  const handleDietaryChange = (type: string, delta: number) => {
    const currentCounts = wizardData.notes.structuredDietary || {};
    const currentQty = currentCounts[type] || 0;
    const newQty = Math.max(0, currentQty + delta);
    
    const newCounts = { ...currentCounts, [type]: newQty };
    if (newQty === 0) delete newCounts[type];

    const dietaryParts = Object.entries(newCounts).map(([k, v]) => `${k} (${v})`);
    const newDietaryString = dietaryParts.join(', ');

    updateWizard({
      notes: {
        ...wizardData.notes,
        structuredDietary: newCounts,
        dietary: newDietaryString
      }
    });
  };

  const submitBooking = async () => {
    if (isWaitlistFull) {
        setSubmitError(t('err_capacity'));
        return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
        if (!isWaitlistMode) {
            try {
                const freshEvents = await calendarRepo.getAllAsync(); 
                const rawEvent = freshEvents.find(e => e.date === wizardData.date && e.type === 'SHOW');
                const targetEvent = rawEvent as ShowEvent | undefined;
                
                if (!targetEvent || targetEvent.bookingEnabled === false) {
                   throw new Error("De status van dit event is gewijzigd. Probeer het opnieuw.");
                }

                const freshReservations = await bookingRepo.getAllAsync(); 
                const currentBookedCount = freshReservations
                    .filter(r => 
                    r.date === wizardData.date && 
                    r.status !== 'CANCELLED' && 
                    r.status !== 'ARCHIVED' && 
                    r.status !== 'NOSHOW' && 
                    r.status !== 'WAITLIST'
                    )
                    .reduce((sum, r) => sum + (Number(r.partySize) || 0), 0);
                
                const maxCapacity = Number(targetEvent.capacity) || CAPACITY_TARGET;
                const newGuests = Number(wizardData.totalGuests) || 0;
                
                if (currentBookedCount + newGuests > maxCapacity) {
                    setSubmitError(`Helaas, capaciteit overschreden: ${currentBookedCount + newGuests}/${maxCapacity} bezet. Probeer een andere datum.`);
                    setIsSubmitting(false);
                    return; 
                }
            } catch (err: any) {
                setSubmitError(err.message || "Er is een fout opgetreden bij de capaciteitscontrole.");
                setIsSubmitting(false);
                return;
            }
        }

        const fullPhone = `${wizardData.customer.phoneCode} ${wizardData.customer.phone}`;
        const fullAddress = `${wizardData.customer.street} ${wizardData.customer.houseNumber}, ${wizardData.customer.city}`;
        const customerId = `CUST-${Date.now()}`;

        if (isWaitlistMode) {
          const waitlistId = `WL-${Date.now()}`;
          const newEntry: WaitlistEntry = {
            id: waitlistId,
            date: wizardData.date,
            customerId: customerId,
            contactName: `${wizardData.customer.firstName} ${wizardData.customer.lastName}`,
            contactEmail: wizardData.customer.email,
            contactPhone: fullPhone,
            partySize: wizardData.totalGuests,
            requestDate: new Date().toISOString(),
            status: 'PENDING',
            notes: wizardData.notes.comments || wizardData.notes.dietary
          };

          waitlistRepo.add(newEntry);
          
          logAuditAction('CREATE_WAITLIST', 'WAITLIST', waitlistId, { description: 'Via Booking Wizard (Overflow/Waitlist Mode)' });
          triggerEmail('WAITLIST_JOINED', { type: 'WAITLIST', id: waitlistId, data: newEntry });
          notificationsRepo.createFromEvent('NEW_WAITLIST', newEntry);

          resetWizard();
          navigate('/book/confirmation', { state: { reservation: null, isWaitlist: true, waitlistEntry: newEntry } });
          return;
        }

        const resId = `RES-${Date.now()}`;
        const nextTableNumber = getNextTableNumber(wizardData.date);
        const tableId = `TAB-${nextTableNumber}`;

        const finalFinancials = {
            total: financials.subtotal,
            subtotal: financials.subtotal,
            discount: financials.discountAmount,
            finalTotal: financials.amountDue,
            paid: 0,
            isPaid: false,
            voucherCode: wizardData.voucherCode,
            voucherUsed: financials.voucherApplied,
            paymentDueAt: new Date(new Date().setDate(new Date().getDate() + 14)).toISOString(),
            priceBreakdown: financials.items 
        };

        const newRes: Reservation = {
          id: resId,
          createdAt: new Date().toISOString(),
          customerId: customerId,
          customer: {
            id: customerId,
            ...wizardData.customer,
            phone: fullPhone,
            address: fullAddress,
            isBusiness: !!wizardData.customer.companyName
          },
          date: wizardData.date,
          showId: wizardData.showId,
          status: BookingStatus.REQUEST,
          partySize: wizardData.totalGuests,
          packageType: wizardData.packageType,
          addons: wizardData.addons,
          merchandise: wizardData.merchandise,
          financials: finalFinancials, 
          notes: wizardData.notes,
          idempotencyKey: wizardData.idempotencyKey,
          startTime: eventData?.event?.times?.start || '19:30',
          tableId: tableId
        };

        const validationResult = ReservationSchema.safeParse(newRes);
        if (!validationResult.success) {
            console.error("Zod Validation Error:", validationResult.error.format());
            const firstError = validationResult.error.errors[0];
            const friendlyMessage = `${firstError.path.join('.')}: ${firstError.message}`;
            setSubmitError(`Validatie fout: ${friendlyMessage}`);
            setIsSubmitting(false);
            return;
        }

        const finalReservation = bookingRepo.createRequest(newRes);
        
        if (finalReservation.id === resId) {
            logAuditAction('CREATE_RESERVATION', 'RESERVATION', finalReservation.id, { description: 'Wizard submission' });
            triggerEmail('BOOKING_REQUEST_RECEIVED', { type: 'RESERVATION', id: finalReservation.id, data: finalReservation });
            notificationsRepo.createFromEvent('NEW_BOOKING', finalReservation);
        }

        resetWizard();
        navigate('/book/confirmation', { state: { reservation: finalReservation } });

    } catch (e) {
        setSubmitError("Er is een onverwachte fout opgetreden. Probeer het opnieuw.");
        setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    if (isWaitlistFull) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in">
                <div className="p-6 bg-red-900/20 rounded-full text-red-500 mb-6 border border-red-900/50">
                    <div className="w-12 h-12 flex items-center justify-center"><AlertTriangle size={32} /></div>
                </div>
                <h2 className="text-3xl font-serif text-white mb-2">{t('err_capacity')}</h2>
                <p className="text-slate-400 max-w-md mx-auto mb-8">
                    {t('alert_capacity')}
                </p>
                <Button onClick={() => navigate('/book')}>{t('btn_change')}</Button>
            </div>
        );
    }

    switch (step) {
      case 0: // DATE
        return (
          <div className="space-y-6">
            {wizardData.date ? (
              <Card className="p-6 bg-slate-900 border-amber-500/50 border flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-slate-800 rounded-xl text-amber-500">
                    <CalendarIcon size={32} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 uppercase font-bold tracking-widest mb-1">{t('selected_date')}</p>
                    <p className="text-2xl font-serif text-white">{new Date(wizardData.date).toLocaleDateString(language === 'nl' ? 'nl-NL' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    {eventData && <p className="text-emerald-500 text-sm font-bold mt-1">{eventData.show.name}</p>}
                  </div>
                </div>
                <Button variant="secondary" onClick={() => navigate('/book')}>{t('btn_change')}</Button>
              </Card>
            ) : (
              <div className="text-center p-8 bg-slate-900 rounded-xl border border-slate-800">
                <p className="text-slate-400 mb-4">{t('no_date')}</p>
                <Button onClick={() => navigate('/book')}>{t('btn_open_calendar')}</Button>
              </div>
            )}
          </div>
        );

      case 1: // AANTAL
        return (
          <div className="space-y-8">
            <h2 className="text-3xl font-serif text-white">{t('header_how_many')}</h2>
            
            {/* Waitlist Banner */}
            {isWaitlistMode && (
              <div role="alert" className="p-6 bg-orange-900/20 border border-orange-500/50 rounded-2xl flex flex-col md:flex-row items-center text-center md:text-left space-y-4 md:space-y-0 md:space-x-6 animate-in slide-in-from-top-4 shadow-lg shadow-orange-900/10">
                 <div className="p-4 bg-orange-500/10 rounded-full text-orange-500 shrink-0">
                   <AlertCircle size={32} />
                 </div>
                 <div className="flex-grow">
                   <h3 className="text-xl font-bold text-white mb-1">{t('alert_waitlist')}</h3>
                   <p className="text-orange-200 text-sm leading-relaxed">
                     {t('alert_capacity')}
                   </p>
                 </div>
              </div>
            )}

            <Card className="p-8 bg-slate-900 border-slate-800 text-center">
               <div className="flex justify-center items-center space-x-4 mb-6">
                 <button 
                   onClick={() => handleGuestChange(wizardData.totalGuests - 1)}
                   className="w-16 h-16 rounded-full bg-slate-800 hover:bg-amber-500 hover:text-black transition-colors flex items-center justify-center text-3xl font-bold text-white"
                   aria-label="Decrease guests"
                 >
                   <Minus size={32}/>
                 </button>
                 <div className="w-32">
                   <input 
                     type="number" 
                     className="w-full bg-transparent text-6xl font-serif text-white text-center focus:outline-none"
                     value={wizardData.totalGuests}
                     onChange={(e) => handleGuestChange(parseInt(e.target.value) || 1)}
                     aria-label="Guest count"
                   />
                 </div>
                 <button 
                   onClick={() => handleGuestChange(wizardData.totalGuests + 1)}
                   className="w-16 h-16 rounded-full bg-slate-800 hover:bg-amber-500 hover:text-black transition-colors flex items-center justify-center text-3xl font-bold text-white"
                   aria-label="Increase guests"
                 >
                   <Plus size={32}/>
                 </button>
               </div>
               <p className="text-slate-400 text-sm max-w-md mx-auto">
                 {wizardData.totalGuests > CAPACITY_TARGET ? (
                   <span className="text-amber-500 font-bold flex items-center justify-center">
                     <AlertTriangle size={16} className="mr-2" />
                     {t('alert_capacity')}
                   </span>
                 ) : (
                   "Uw aanvraag is pas definitief na onze bevestiging."
                 )}
               </p>
            </Card>
          </div>
        );

      case 2: // ARRANGEMENT
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-serif text-white">{t('header_package')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" role="radiogroup" aria-label={t('header_package')}>
              {/* STANDARD */}
              <div 
                role="radio"
                aria-checked={wizardData.packageType === 'standard'}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') updateWizard({ packageType: 'standard' }); }}
                onClick={() => updateWizard({ packageType: 'standard' })}
                className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 flex flex-col focus:ring-2 focus:ring-amber-500 focus:outline-none ${wizardData.packageType === 'standard' ? 'bg-slate-900 border-white ring-1 ring-white/50' : 'bg-slate-900/40 border-slate-800 hover:border-slate-600'}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-white">{t('pkg_standard')}</h3>
                  {wizardData.packageType === 'standard' && <CheckCircle2 className="text-white" size={24} />}
                </div>
                <p className="text-3xl font-serif text-amber-500 mb-6">€{pricing?.standard?.toFixed(2)} <span className="text-sm text-slate-500 font-sans">{t('pp')}</span></p>
                <ul className="space-y-3 text-sm text-slate-300 flex-grow">
                  <li className="flex items-center"><CheckCircle2 size={16} className="mr-3 text-slate-500"/> {t('pkg_feat_ticket')}</li>
                  <li className="flex items-center"><CheckCircle2 size={16} className="mr-3 text-slate-500"/> {t('pkg_feat_dinner3')}</li>
                  <li className="flex items-center"><CheckCircle2 size={16} className="mr-3 text-slate-500"/> {t('pkg_feat_drinks_basic')}</li>
                </ul>
              </div>

              {/* PREMIUM */}
              <div 
                role="radio"
                aria-checked={wizardData.packageType === 'premium'}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') updateWizard({ packageType: 'premium' }); }}
                onClick={() => updateWizard({ packageType: 'premium' })}
                className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 overflow-hidden flex flex-col focus:ring-2 focus:ring-amber-500 focus:outline-none ${wizardData.packageType === 'premium' ? 'bg-gradient-to-br from-amber-900/20 to-black border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.2)]' : 'bg-slate-900/40 border-slate-800 hover:border-amber-500/50'}`}
              >
                {wizardData.packageType === 'premium' && <div className="absolute top-0 right-0 bg-amber-500 text-black text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-widest">{t('selected')}</div>}
                
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-white flex items-center"><Star size={20} className="mr-2 text-amber-500" fill="currentColor"/> {t('pkg_premium')}</h3>
                </div>
                <p className="text-3xl font-serif text-amber-500 mb-6">€{pricing?.premium?.toFixed(2)} <span className="text-sm text-slate-500 font-sans">{t('pp')}</span></p>
                <ul className="space-y-3 text-sm text-slate-300 flex-grow">
                  <li className="flex items-center"><CheckCircle2 size={16} className="mr-3 text-amber-500"/> {t('pkg_feat_seats')}</li>
                  <li className="flex items-center"><CheckCircle2 size={16} className="mr-3 text-amber-500"/> {t('pkg_feat_dinner4')}</li>
                  <li className="flex items-center"><CheckCircle2 size={16} className="mr-3 text-amber-500"/> {t('pkg_feat_bubbly')}</li>
                  <li className="flex items-center"><CheckCircle2 size={16} className="mr-3 text-amber-500"/> {t('pkg_feat_drinks_prem')}</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 3: // EXTRAS
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-serif text-white">{t('header_extras')}</h2>
            <div className="space-y-3">
               {MOCK_ADDONS.map(addon => {
                 const isSelected = wizardData.addons.some((a: any) => a.id === addon.id);
                 const price = pricing && pricing[addon.id === 'pre-drinks' ? 'addonPreDrink' : 'addonAfterDrink'] 
                              ? pricing[addon.id === 'pre-drinks' ? 'addonPreDrink' : 'addonAfterDrink'] 
                              : addon.price;

                 return (
                   <div key={addon.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isSelected ? 'bg-slate-800 border-emerald-500' : 'bg-slate-900 border-slate-800'}`}>
                      <div className="flex items-start space-x-4">
                         <div className={`p-3 rounded-lg ${isSelected ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-800 text-slate-500'}`}>
                            <Wine size={24} />
                         </div>
                         <div>
                            <h4 className="font-bold text-white">{addon.name}</h4>
                            <p className="text-xs text-slate-400 max-w-sm">{addon.description}</p>
                            <p className="text-sm font-bold text-amber-500 mt-1">€{price.toFixed(2)} {t('pp')}</p>
                         </div>
                      </div>
                      <button 
                        onClick={() => {
                           const newAddons = isSelected 
                             ? wizardData.addons.filter((a: any) => a.id !== addon.id)
                             : [...wizardData.addons, { id: addon.id, quantity: wizardData.totalGuests }];
                           updateWizard({ addons: newAddons });
                        }}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border ${isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-600 text-slate-400 hover:text-white'}`}
                      >
                        {isSelected ? t('added') : t('add')}
                      </button>
                   </div>
                 );
               })}
            </div>
          </div>
        );

      case 4: // SHOP
        return (
          <div className="space-y-6">
             <h2 className="text-2xl font-serif text-white">Merchandise</h2>
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

      case 5: // GEGEVENS
        return (
          <div className="space-y-6">
             <h2 className="text-2xl font-serif text-white">{t('header_details')}</h2>
             
             {duplicateWarning && (
              <div className="p-4 bg-amber-900/20 border border-amber-500/50 rounded-xl flex items-start text-amber-200 animate-in slide-in-from-top-2" role="alert">
                <AlertTriangle size={20} className="mr-3 shrink-0 mt-0.5" />
                <p className="text-sm">
                  {t('alert_dupe')}
                </p>
              </div>
            )}
            
             <Card className="p-6 bg-slate-900 border-slate-800 space-y-4">
                {process.env.NODE_ENV === 'development' && (
                 <button onClick={autofillPreviousCustomer} className="text-xs text-slate-500 underline mb-4 hover:text-white">
                   [DEBUG] Vul laatst gebruikte in
                 </button>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <Input 
                        label={t('lbl_firstname')} 
                        value={wizardData.customer.firstName}
                        onChange={(e: any) => handleCapitalize(e, 'firstName')}
                        error={getFieldError('firstName')}
                        icon={<User size={16} />}
                      />
                   </div>
                   <div className="space-y-2">
                      <Input 
                        label={t('lbl_lastname')} 
                        value={wizardData.customer.lastName}
                        onChange={(e: any) => handleCapitalize(e, 'lastName')}
                        error={getFieldError('lastName')}
                        icon={<User size={16} />}
                      />
                   </div>
                   <div className="space-y-2 md:col-span-2">
                      <Input 
                        label={t('lbl_email')} 
                        type="email"
                        value={wizardData.customer.email}
                        onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, email: e.target.value } })}
                        error={getFieldError('email')}
                        icon={<Mail size={16} />}
                      />
                   </div>
                   <div className="space-y-2 md:col-span-2">
                      <div className="flex gap-2">
                         <div className="w-1/3">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">{t('lbl_code')}</label>
                            <select 
                               className="w-full px-2 py-3 bg-black/40 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500"
                               value={wizardData.customer.phoneCode}
                               onChange={(e) => updateWizard({ customer: { ...wizardData.customer, phoneCode: e.target.value } })}
                            >
                               {PHONE_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                            </select>
                         </div>
                         <div className="flex-grow">
                            <Input 
                              label={t('lbl_phone')}
                              type="tel"
                              value={wizardData.customer.phone}
                              onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, phone: e.target.value } })}
                              error={getFieldError('phone')}
                              icon={<Phone size={16} />}
                            />
                         </div>
                      </div>
                   </div>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <label className="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-slate-950/50 transition-colors w-fit">
                     <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${wizardData.customer.companyName ? 'bg-blue-500 border-blue-500' : 'border-slate-600 bg-slate-900'}`}>
                        {wizardData.customer.companyName && <CheckCircle2 size={14} className="text-white"/>}
                     </div>
                     <input 
                       type="checkbox" 
                       className="hidden"
                       checked={!!wizardData.customer.companyName}
                       onChange={(e) => updateWizard({ customer: { ...wizardData.customer, companyName: e.target.checked ? 'Bedrijf' : '' } })}
                     />
                     <span className="font-bold text-white text-sm flex items-center"><Building2 size={16} className="mr-2 text-blue-500"/> {t('is_business')}</span>
                  </label>

                  {wizardData.customer.companyName && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-in slide-in-from-top-2">
                          <Input 
                             label={t('lbl_company')} 
                             value={wizardData.customer.companyName === 'Bedrijf' ? '' : wizardData.customer.companyName} 
                             onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, companyName: e.target.value } })}
                             placeholder="Bedrijfsnaam BV"
                          />
                          <Input 
                             label={t('lbl_billing_note')}
                             value={wizardData.customer.billingInstructions || ''} 
                             onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, billingInstructions: e.target.value } })}
                             placeholder="Kostenplaats, PO-nummer, etc."
                          />
                      </div>
                  )}
               </div>

                <div className="pt-4 border-t border-slate-800">
                   <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center">
                    <MapPin size={14} className="mr-2"/> Adres
                   </h4>
                   <div className="grid grid-cols-4 gap-4">
                      <div className="col-span-4 md:col-span-2">
                        <label className="text-xs font-bold text-amber-500/80 uppercase tracking-widest block mb-2">{t('lbl_country')}</label>
                        <select 
                            className="w-full px-4 py-3 bg-black/40 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500 appearance-none"
                            value={wizardData.customer.country || 'NL'}
                            onChange={(e) => updateWizard({ customer: { ...wizardData.customer, country: e.target.value } })}
                        >
                            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                        </select>
                      </div>
                      <div className="col-span-3">
                         <Input label={t('lbl_street')} value={wizardData.customer.street} onChange={(e: any) => handleCapitalize(e, 'street')} error={getFieldError('street')} />
                      </div>
                      <div className="col-span-1">
                         <Input label={t('lbl_house_nr')} value={wizardData.customer.houseNumber} onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, houseNumber: e.target.value } })} error={getFieldError('houseNumber')} />
                      </div>
                      <div className="col-span-1">
                         <Input label={t('lbl_zip')} value={wizardData.customer.zip} onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, zip: e.target.value.toUpperCase() } })} error={getFieldError('zip')} />
                      </div>
                      <div className="col-span-3">
                         <Input label={t('lbl_city')} value={wizardData.customer.city} onChange={(e: any) => handleCapitalize(e, 'city')} error={getFieldError('city')} />
                      </div>
                   </div>
                </div>
             </Card>
          </div>
        );

      case 6: // WENSEN
        return (
          <div className="space-y-6">
             <h2 className="text-2xl font-serif text-white">{t('header_wishes')}</h2>
             <Card className="p-6 bg-slate-900 border-slate-800 space-y-8">
                
                {/* Celebration Toggle */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                   <label className="flex items-center space-x-3 cursor-pointer">
                     <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${wizardData.notes.isCelebrating ? 'bg-purple-500 border-purple-500' : 'border-slate-600 bg-slate-900'}`}>
                        {wizardData.notes.isCelebrating && <CheckCircle2 size={14} className="text-white"/>}
                     </div>
                     <input 
                       type="checkbox" 
                       className="hidden"
                       checked={wizardData.notes.isCelebrating}
                       onChange={(e) => updateWizard({ notes: { ...wizardData.notes, isCelebrating: e.target.checked } })}
                     />
                     <span className="font-bold text-white text-sm flex items-center"><PartyPopper size={16} className="mr-2 text-purple-500"/> {t('celebration_check')}</span>
                   </label>
                   {wizardData.notes.isCelebrating && (
                     <Input 
                       placeholder={t('celebration_placeholder')} 
                       value={wizardData.notes.celebrationText || ''} 
                       onChange={(e: any) => updateWizard({ notes: { ...wizardData.notes, celebrationText: e.target.value } })}
                       className="h-10 text-sm bg-black/40 border-slate-700"
                     />
                   )}
                </div>

                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 block">{t('lbl_dietary')}</label>
                   
                   {/* VISUAL TILES GRID */}
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      {DIETARY_OPTIONS.map(opt => {
                        const currentCount = wizardData.notes.structuredDietary?.[opt.id] || 0;
                        const Icon = opt.icon;
                        const isSelected = currentCount > 0;

                        return (
                          <div 
                            key={opt.id} 
                            role="button"
                            tabIndex={0}
                            aria-pressed={isSelected}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); !isSelected && handleDietaryChange(opt.id, 1); }}}
                            onClick={() => !isSelected && handleDietaryChange(opt.id, 1)}
                            className={`
                                relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all cursor-pointer group focus:outline-none focus:ring-2 focus:ring-amber-500
                                ${isSelected 
                                    ? 'bg-amber-900/20 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]' 
                                    : 'bg-slate-950 border-slate-800 hover:border-slate-600 hover:bg-slate-900'}
                            `}
                          >
                            <Icon 
                                size={32} 
                                className={`mb-3 transition-colors ${isSelected ? 'text-amber-500' : 'text-slate-500 group-hover:text-slate-300'}`} 
                            />
                            <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-400'}`}>{opt.label}</span>
                            
                            {isSelected && (
                                <div className="flex items-center space-x-3 mt-3 bg-black/50 rounded-lg p-1" onClick={(e) => e.stopPropagation()}>
                                    <button 
                                        onClick={() => handleDietaryChange(opt.id, -1)}
                                        className="w-8 h-8 flex items-center justify-center rounded bg-slate-800 text-slate-400 hover:text-white transition-colors"
                                        aria-label={`Decrease ${opt.label}`}
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <span className="w-4 text-center font-bold text-white text-sm">{currentCount}</span>
                                    <button 
                                        onClick={() => handleDietaryChange(opt.id, 1)}
                                        className="w-8 h-8 flex items-center justify-center rounded bg-slate-800 text-amber-500 hover:bg-slate-700 transition-colors"
                                        aria-label={`Increase ${opt.label}`}
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            )}
                          </div>
                        );
                      })}
                   </div>

                   {/* Manual Dietary Text */}
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">{t('dietary_comments_lbl')}</label>
                   <textarea 
                      className="w-full h-24 bg-black/40 border border-slate-800 rounded-xl p-3 text-white text-sm focus:border-amber-500 outline-none resize-none mb-6"
                      placeholder={t('dietary_placeholder')}
                      value={wizardData.notes.dietary ? wizardData.notes.dietary.split('| Overig:')[0].replace(/.*\(.*?\),?\s*/g, '') : ''} 
                      onChange={(e) => {
                          const val = e.target.value;
                          const counts = wizardData.notes.structuredDietary || {};
                          const parts = Object.entries(counts).map(([k, v]) => `${k} (${v})`);
                          if(val) parts.push(val);
                          updateWizard({ notes: { ...wizardData.notes, dietary: parts.join(', ') } });
                      }}
                   />
                </div>
                
                {/* General Comments */}
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center">
                      <MessageSquare size={14} className="mr-2"/> {t('lbl_comments')}
                   </label>
                   <textarea 
                      className="w-full h-24 bg-black/40 border border-slate-800 rounded-xl p-3 text-white text-sm focus:border-amber-500 outline-none resize-none"
                      placeholder={t('comments_placeholder')}
                      value={wizardData.notes.comments}
                      onChange={(e) => updateWizard({ notes: { ...wizardData.notes, comments: e.target.value } })}
                   />
                </div>
             </Card>
          </div>
        );

      case 7: // OVERZICHT
        return (
          <div className="space-y-6">
             <h2 className="text-2xl font-serif text-white">{t('header_review')}</h2>
             
             {submitError && (
               <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-xl flex items-center text-red-400" role="alert">
                  <AlertCircle size={20} className="mr-3 shrink-0" />
                  <span className="text-sm">{submitError}</span>
                  <button onClick={dismissError} className="ml-auto hover:text-white" aria-label="Dismiss error"><AlertCircle size={16}/></button>
               </div>
             )}

             <BookingSummary 
               data={wizardData} 
               onUpdate={(updates) => updateWizard(updates)}
             />
             
             <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 mt-4">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${agreedToTerms ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 bg-slate-900'}`}>
                      {agreedToTerms && <CheckCircle2 size={14} className="text-black"/>}
                  </div>
                  <input type="checkbox" className="hidden" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} />
                  <span className="text-sm text-slate-300">
                      {t('terms_agree')} <a href="#" className="text-amber-500 hover:underline">{t('terms_link')}</a> {t('terms_suffix')}
                  </span>
                </label>
             </div>
             
             {isWaitlistMode && (
                <div className="p-4 bg-amber-900/20 border border-amber-900/50 rounded-xl text-center text-amber-200 text-sm">
                   {t('alert_waitlist')}
                </div>
             )}
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-200 pb-20">
       <div className="max-w-4xl mx-auto p-4 md:p-8">
          
          {/* HEADER AREA with Language Toggle */}
          <div className="flex justify-end mb-4">
             <button
                 onClick={() => setLanguage(language === 'nl' ? 'en' : 'nl')}
                 className="flex items-center text-xs text-slate-500 hover:text-white uppercase font-bold transition-colors bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                 aria-label={language === 'nl' ? 'Switch to English' : 'Wissel naar Nederlands'}
             >
                 <Globe size={14} className="mr-2"/> {language === 'nl' ? 'EN' : 'NL'}
             </button>
          </div>

          <Stepper steps={stepConfig.labels} current={currentVisualStep} />
          
          <div className="mt-8 mb-12">
             {renderStepContent()}
          </div>

          <div className="fixed bottom-0 left-0 w-full bg-slate-950/90 backdrop-blur-md border-t border-slate-900 p-4 z-40">
             <div className="max-w-4xl mx-auto flex justify-between items-center">
                <Button variant="ghost" onClick={prevStep} disabled={step === 0} aria-label={t('btn_prev')}>
                   <ChevronLeft size={16} className="mr-2" /> {t('btn_prev')}
                </Button>
                
                {step === 7 ? (
                   <Button 
                     onClick={submitBooking} 
                     disabled={isSubmitting || (step === 7 && !agreedToTerms)} 
                     className="bg-emerald-600 hover:bg-emerald-700 min-w-[160px]"
                     aria-label="Submit booking"
                   >
                     {isSubmitting ? <Loader2 className="animate-spin" /> : (isWaitlistMode ? t('btn_waitlist') : t('btn_confirm'))}
                   </Button>
                ) : (
                   <Button onClick={nextStep} disabled={!canProceed} aria-label={t('btn_next')}>
                      {t('btn_next')} <ChevronRight size={16} className="ml-2" />
                   </Button>
                )}
             </div>
          </div>
       </div>
    </div>
  );
};
