
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWizardPersistence } from './useWizardPersistence';
import { bookingRepo, notificationsRepo, getEvents, getShowDefinitions, customerRepo, requestRepo, waitlistRepo } from '../utils/storage';
import { triggerEmail } from '../utils/emailEngine';
import { logAuditAction } from '../utils/auditLogger';
import { Reservation, BookingStatus, EventDate, ShowDefinition, WaitlistEntry } from '../types';
import { calculateBookingTotals, getEffectivePricing } from '../utils/pricing';
import { calculateEventStatus } from '../utils/status';

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
    availability: location.state?.availability || 'OPEN',
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
  const [financials, setFinancials] = useState<any>({ subtotal: 0, amountDue: 0 });
  const [eventData, setEventData] = useState<{ event: EventDate; show: ShowDefinition } | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  
  // Waitlist Logic
  const [isWaitlistMode, setIsWaitlistMode] = useState(false);
  const [isWaitlistFull, setIsWaitlistFull] = useState(false); // New state to block if waitlist closed

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
    const event = events.find(e => e.date === wizardData.date);
    const show = shows.find(s => s.id === wizardData.showId);

    if (event && show) {
      setEventData({ event, show });
      
      // Pricing
      const priceConfig = getEffectivePricing(event, show);
      setPricing(priceConfig);
      const totals = calculateBookingTotals(wizardData, priceConfig);
      setFinancials(totals);

      // Check Status via Smart Logic
      const wlCount = waitlist.filter(w => w.date === wizardData.date && w.status === 'PENDING').length;
      
      // Use the helper to be consistent with calendar view
      const calculatedStatus = calculateEventStatus(
          event.bookedCount || 0,
          event.capacity || CAPACITY_TARGET,
          wlCount,
          event.availability
      );

      // If Status is WAITLIST, enable waitlist mode.
      // If Status is CLOSED, block (isWaitlistFull)
      
      if (calculatedStatus === 'WAITLIST') {
          setIsWaitlistMode(true);
          setIsWaitlistFull(false);
      } else if (calculatedStatus === 'CLOSED') {
          setIsWaitlistMode(true); // Technically in waitlist logic area but full
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

      if (wizardData.useBillingAddress) {
        if (!c.billingAddress?.street) errors['billingAddress.street'] = "Straat (factuur) is verplicht.";
        if (!c.billingAddress?.houseNumber) errors['billingAddress.houseNumber'] = "Huisnummer (factuur) is verplicht.";
        if (!c.billingAddress?.zip) errors['billingAddress.zip'] = "Postcode (factuur) is verplicht.";
        if (!c.billingAddress?.city) errors['billingAddress.city'] = "Stad (factuur) is verplicht.";
      }
    }

    return errors;
  }, [wizardData.customer, wizardData.useBillingAddress, step]);

  const getFieldError = (field: string): string | undefined => {
    return showValidationErrors ? validationErrors[field] : undefined;
  };

  // --- Logic Helpers ---

  const canProceed = () => {
    // Block if waitlist full (shouldn't happen if UI behaves, but safety check)
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
    
    // WAITLIST FLOW: Skip Package (2), Addons (3), Merch (4) -> Go to Details (5)
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
        setSubmitError("De wachtlijst voor deze datum is helaas vol.");
        return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    
    await new Promise(resolve => setTimeout(resolve, 1500));

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
          
          logAuditAction('CREATE_WAITLIST', 'WAITLIST', waitlistId, { description: 'Via Booking Wizard (Overflow)' });
          triggerEmail('WAITLIST_JOINED', { type: 'WAITLIST', id: waitlistId, data: newEntry });
          notificationsRepo.createFromEvent('NEW_WAITLIST', newEntry);

          resetWizard();
          // Pass a flag to confirmation screen to show waitlist message
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
          startTime: eventData?.event?.startTime
        };

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
      isWaitlistFull, // New prop to block UI if needed
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
