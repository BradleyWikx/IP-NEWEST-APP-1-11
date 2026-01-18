
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWizardPersistence } from './useWizardPersistence';
import { bookingRepo, notificationsRepo, getEvents, getShowDefinitions, customerRepo, requestRepo, waitlistRepo, calendarRepo } from '../utils/storage';
import { triggerEmail } from '../utils/emailEngine';
import { logAuditAction } from '../utils/auditLogger';
import { Reservation, BookingStatus, ShowEvent, ShowDefinition, WaitlistEntry } from '../types';
import { calculateBookingTotals, getEffectivePricing } from '../utils/pricing';
import { calculateEventStatus } from '../utils/status';
import { ReservationSchema } from '../utils/validation';

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

export const useBookingWizardLogic = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
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
  
  // Real-time Calculation State
  const [pricing, setPricing] = useState<any>(null);
  const [financials, setFinancials] = useState<any>({ subtotal: 0, amountDue: 0, items: [] });
  const [eventData, setEventData] = useState<{ event: ShowEvent; show: ShowDefinition } | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  
  // Waitlist Logic
  const [isWaitlistMode, setIsWaitlistMode] = useState(false);
  const [isWaitlistFull, setIsWaitlistFull] = useState(false); 

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
      
      // FIX: Use local date comparison to avoid timezone issues.
      // Only block STRICTLY past dates. Allow today.
      const now = new Date();
      const localTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      if (wizardData.date < localTodayStr) {
         setSubmitError("Deze datum ligt in het verleden.");
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

      // 3. Determine Status using DYNAMIC CAPACITY from event
      const dynamicCapacity = Number(event.capacity) || CAPACITY_TARGET;
      const calculatedStatus = calculateEventStatus(
          currentBooked, 
          dynamicCapacity, 
          wlCount,
          event.status // Passed manual status ('WAITLIST', 'CLOSED' or 'OPEN')
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
  }, [wizardData]);

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
      if (!c.firstName) errors.firstName = "Voornaam is verplicht.";
      if (!c.lastName) errors.lastName = "Achternaam is verplicht.";
      if (!c.street) errors.street = "Straatnaam is verplicht.";
      if (!c.city) errors.city = "Woonplaats is verplicht.";
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!c.email) {
        errors.email = "E-mailadres is verplicht.";
      } else if (!emailRegex.test(c.email)) {
        errors.email = "Ongeldig e-mailadres formaat.";
      }

      const phoneDigits = c.phone.replace(/\D/g, '');
      if (!c.phone) {
        errors.phone = "Telefoonnummer is verplicht.";
      } else if (phoneDigits.length < 8) {
        errors.phone = "Telefoonnummer moet minimaal 8 cijfers bevatten.";
      }

      if (!c.zip) errors.zip = "Postcode is verplicht.";
      if (!c.houseNumber) errors.houseNumber = "Huisnummer is verplicht.";
    }

    return errors;
  }, [wizardData.customer, wizardData.useBillingAddress, step]);

  const getFieldError = (field: string): string | undefined => {
    return showValidationErrors ? validationErrors[field] : undefined;
  };

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

    // REGULAR FLOW: Skip Addons if threshold not met
    if (step === 2 && wizardData.totalGuests < ADDON_THRESHOLD) {
      setStep(4); // Skip to Merch
      return;
    }
    
    setStep(s => Math.min(STEPS.length - 1, s + 1));
  };

  const prevStep = () => {
    // WAITLIST FLOW: Back from Details (5) -> Party (1)
    if (isWaitlistMode && step === 5) {
      setStep(1);
      return;
    }

    // REGULAR FLOW
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
          phoneCode: '+31',
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

  const submitBooking = async () => {
    if (isWaitlistFull) {
        setSubmitError("Online reserveren is gesloten.");
        return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    
    await new Promise(resolve => setTimeout(resolve, 1500));

    // --- ATOMIC CAPACITY CHECK ---
    if (!isWaitlistMode) {
      try {
        const freshEvents = await calendarRepo.getAllAsync(); // Use Async
        // Find specific SHOW event safely
        const rawEvent = freshEvents.find(e => e.date === wizardData.date && e.type === 'SHOW');
        // Explicitly cast to ShowEvent to ensure TS knows about 'capacity'
        const targetEvent = rawEvent as ShowEvent | undefined;
        
        if (!targetEvent || targetEvent.bookingEnabled === false) {
           throw new Error("De status van dit event is gewijzigd. Probeer het opnieuw.");
        }

        const freshReservations = await bookingRepo.getAllAsync(); // Use Async
        const currentBookedCount = freshReservations
             .filter(r => 
               r.date === wizardData.date && 
               r.status !== 'CANCELLED' && 
               r.status !== 'ARCHIVED' && 
               r.status !== 'NOSHOW' && 
               r.status !== 'WAITLIST'
             )
             .reduce((sum, r) => sum + (Number(r.partySize) || 0), 0);
           
        // Use the event's specific capacity, fallback to default if missing/zero
        const maxCapacity = Number(targetEvent.capacity) || CAPACITY_TARGET;
        const newGuests = Number(wizardData.totalGuests) || 0;
           
        if (currentBookedCount + newGuests > maxCapacity) {
              setSubmitError(`Helaas, capaciteit overschreden: ${currentBookedCount + newGuests}/${maxCapacity} bezet. Probeer een andere datum.`);
              setIsSubmitting(false);
              return; // STOP
        }
      } catch (err: any) {
         setSubmitError(err.message || "Er is een fout opgetreden bij de capaciteitscontrole.");
         setIsSubmitting(false);
         return;
      }
    }
    // --- END ATOMIC CHECK ---

    try {
        const fullPhone = `${wizardData.customer.phoneCode} ${wizardData.customer.phone}`;
        const fullAddress = `${wizardData.customer.street} ${wizardData.customer.houseNumber}, ${wizardData.customer.city}`;
        const customerId = `CUST-${Date.now()}`;

        // --- BRANCH 1: WAITLIST SUBMISSION ---
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

        // --- BRANCH 2: REGULAR RESERVATION ---
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
          startTime: eventData?.event?.times?.start || '19:30'
        };

        // --- ZOD VALIDATION ---
        const validationResult = ReservationSchema.safeParse(newRes);
        if (!validationResult.success) {
            console.error("Zod Validation Error:", validationResult.error.format());
            // Map the first Zod error to a user-friendly string
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

  return {
    data: {
      wizardData,
      step,
      steps: STEPS,
      pricing,
      financials,
      eventData,
      duplicateWarning,
      isWaitlistMode, 
      isWaitlistFull, 
      capacityTarget: CAPACITY_TARGET,
      addonThreshold: ADDON_THRESHOLD
    },
    actions: {
      updateWizard,
      setStep,
      nextStep,
      prevStep,
      autofillPreviousCustomer,
      handleCapitalize,
      submitBooking,
      dismissError: () => setSubmitError(null)
    },
    status: {
      isSubmitting,
      submitError,
      canProceed: canProceed()
    },
    validation: {
      getFieldError
    }
  };
};
