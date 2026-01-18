
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, ShoppingBag, CheckCircle2, 
  ArrowRight, Loader2, Coffee, Wine,
  AlertTriangle, ChevronUp, ChevronDown, Info, PartyPopper, Star, Clock, Minus, Plus, Lock, Receipt, Tag,
  Utensils, Gift, Wheat, Milk, Nut, Fish, Leaf, Baby, Carrot, User, Phone, Mail, MapPin, Building2, Calendar
} from 'lucide-react';
import { Stepper, Button, Card, Input } from './UI';
import { MerchandisePicker } from './MerchandisePicker';
import { BookingSummary } from './BookingSummary';
import { ErrorBanner } from './UI/ErrorBanner';
import { MOCK_ADDONS } from '../mock/data';
import { useBookingWizardLogic } from '../hooks/useBookingWizardLogic';

// --- DIETARY CONFIG ---
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

export const BookingWizard = () => {
  const navigate = useNavigate();
  const [showMobileSummary, setShowMobileSummary] = useState(false);
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  const { data, actions, status, validation } = useBookingWizardLogic();
  
  const { 
    wizardData, step, steps, pricing, financials, 
    eventData, duplicateWarning, isWaitlistMode, isWaitlistFull,
    capacityTarget 
  } = data;
  
  const { 
    updateWizard, nextStep, prevStep, submitBooking, dismissError,
    autofillPreviousCustomer 
  } = actions;

  const { isSubmitting, submitError } = status;
  const { getFieldError } = validation;

  // Intercept Step Change for Upsell logic
  const handleNext = () => {
    if (step === 6) { // Leaving "Wensen" step
        if (wizardData.notes.isCelebrating && !wizardData.merchandise.find((m: any) => m.id === 'celebration-pack') && !showUpsellModal) {
            setShowUpsellModal(true);
            return;
        }
    }
    nextStep();
  };

  const handleAcceptUpsell = () => {
    // Add specific merch item (mock ID)
    const merch = [...wizardData.merchandise, { id: 'celebration-pack', quantity: 1 }];
    updateWizard({ merchandise: merch });
    setShowUpsellModal(false);
    nextStep(); 
  };

  const handleDeclineUpsell = () => {
    setShowUpsellModal(false);
    nextStep();
  };

  // Helper to handle dietary count changes
  const handleDietaryChange = (type: string, delta: number) => {
    const currentCounts = wizardData.notes.structuredDietary || {};
    const currentQty = currentCounts[type] || 0;
    const newQty = Math.max(0, currentQty + delta);
    
    const newCounts = { ...currentCounts, [type]: newQty };
    if (newQty === 0) delete newCounts[type];

    const dietaryParts = Object.entries(newCounts).map(([k, v]) => `${k} (${v})`);
    const commentPart = wizardData.notes.comments ? ` | Overig: ${wizardData.notes.comments}` : '';
    const newDietaryString = dietaryParts.join(', ') + commentPart;

    updateWizard({
      notes: {
        ...wizardData.notes,
        structuredDietary: newCounts,
        dietary: newDietaryString
      }
    });
  };

  const handleCommentsChange = (val: string) => {
    const counts = wizardData.notes.structuredDietary || {};
    const dietaryParts = Object.entries(counts).map(([k, v]) => `${k} (${v})`);
    const commentPart = val ? ` | Overig: ${val}` : '';
    const newDietaryString = dietaryParts.join(', ') + commentPart;

    updateWizard({
      notes: {
        ...wizardData.notes,
        comments: val,
        dietary: newDietaryString
      }
    });
  };

  const renderStepContent = () => {
    // BLOCKING STATE: Waitlist Full / Closed
    if (isWaitlistFull) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in">
                <div className="p-6 bg-red-900/20 rounded-full text-red-500 mb-6 border border-red-900/50">
                    <Lock size={48} />
                </div>
                <h2 className="text-3xl font-serif text-white mb-2">Helaas, Volgeboekt</h2>
                <p className="text-slate-400 max-w-md mx-auto mb-8">
                    Zowel de zaal als de wachtlijst voor deze datum zitten vol. 
                    We kunnen helaas geen nieuwe aanvragen meer aannemen voor deze dag.
                </p>
                <Button onClick={() => navigate('/book')}>Kies een andere datum</Button>
            </div>
        );
    }

    switch (step) {
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
            
            {/* Waitlist Banner */}
            {isWaitlistMode && (
              <div className="p-6 bg-orange-900/20 border border-orange-500/50 rounded-2xl flex flex-col md:flex-row items-center text-center md:text-left space-y-4 md:space-y-0 md:space-x-6 animate-in slide-in-from-top-4 shadow-lg shadow-orange-900/10">
                 <div className="p-4 bg-orange-500/10 rounded-full text-orange-500 shrink-0">
                   <Info size={32} />
                 </div>
                 <div className="flex-grow">
                   <h3 className="text-xl font-bold text-white mb-1">Deze datum is volgeboekt</h3>
                   <p className="text-orange-200 text-sm leading-relaxed">
                     U schrijft zich nu in voor de <strong>wachtlijst</strong>. Dit is nog geen definitieve boeking. 
                     Als er plek vrijkomt, ontvangt u direct bericht.
                   </p>
                 </div>
                 <div className="px-4 py-2 bg-orange-500 text-black text-xs font-bold uppercase tracking-widest rounded-full shadow-md">Wachtlijst Modus</div>
              </div>
            )}

            <Card className="p-8 bg-slate-900 border-slate-800 text-center">
               <div className="flex justify-center items-center space-x-4 mb-6">
                 <button 
                   onClick={() => updateWizard({ totalGuests: Math.max(1, wizardData.totalGuests - 1) })}
                   className="w-16 h-16 rounded-full bg-slate-800 hover:bg-amber-500 hover:text-black transition-colors flex items-center justify-center text-3xl font-bold text-white"
                 >
                   <Minus size={32}/>
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
                   className="w-16 h-16 rounded-full bg-slate-800 hover:bg-amber-500 hover:text-black transition-colors flex items-center justify-center text-3xl font-bold text-white"
                 >
                   <Plus size={32}/>
                 </button>
               </div>
               <p className="text-slate-400 text-sm max-w-md mx-auto">
                 {isWaitlistMode ? (
                   "U schrijft zich in voor de wachtlijst voor dit aantal personen."
                 ) : wizardData.totalGuests > capacityTarget ? (
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
            <h2 className="text-3xl font-serif text-white">Kies uw Arrangement</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* STANDARD */}
              <div 
                onClick={() => updateWizard({ packageType: 'standard' })}
                className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 flex flex-col ${wizardData.packageType === 'standard' ? 'bg-slate-900 border-white ring-1 ring-white/50' : 'bg-slate-900/40 border-slate-800 hover:border-slate-600'}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-white">Standard</h3>
                  {wizardData.packageType === 'standard' && <CheckCircle2 className="text-white" size={24} />}
                </div>
                <p className="text-3xl font-serif text-amber-500 mb-6">€{pricing?.standard?.toFixed(2)} <span className="text-sm text-slate-500 font-sans">p.p.</span></p>
                <ul className="space-y-3 text-sm text-slate-300 flex-grow">
                  <li className="flex items-center"><CheckCircle2 size={16} className="mr-3 text-slate-500"/> Entree Ticket</li>
                  <li className="flex items-center"><CheckCircle2 size={16} className="mr-3 text-slate-500"/> 3-gangen Diner</li>
                  <li className="flex items-center"><CheckCircle2 size={16} className="mr-3 text-slate-500"/> Basis drankjes inbegrepen</li>
                </ul>
              </div>

              {/* PREMIUM */}
              <div 
                onClick={() => updateWizard({ packageType: 'premium' })}
                className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 overflow-hidden flex flex-col ${wizardData.packageType === 'premium' ? 'bg-gradient-to-br from-amber-900/20 to-black border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.2)]' : 'bg-slate-900/40 border-slate-800 hover:border-amber-500/50'}`}
              >
                {wizardData.packageType === 'premium' && <div className="absolute top-0 right-0 bg-amber-500 text-black text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-widest">Geselecteerd</div>}
                
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-white flex items-center"><Star size={20} className="mr-2 text-amber-500" fill="currentColor"/> Premium</h3>
                </div>
                <p className="text-3xl font-serif text-amber-500 mb-6">€{pricing?.premium?.toFixed(2)} <span className="text-sm text-slate-500 font-sans">p.p.</span></p>
                <ul className="space-y-3 text-sm text-slate-300 flex-grow">
                  <li className="flex items-center"><CheckCircle2 size={16} className="mr-3 text-amber-500"/> Beste plaatsen in de zaal</li>
                  <li className="flex items-center"><CheckCircle2 size={16} className="mr-3 text-amber-500"/> 4-gangen Deluxe Diner</li>
                  <li className="flex items-center"><CheckCircle2 size={16} className="mr-3 text-amber-500"/> Glas bubbels bij ontvangst</li>
                  <li className="flex items-center"><CheckCircle2 size={16} className="mr-3 text-amber-500"/> Onbeperkt Premium dranken</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 3: // ADDONS
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-serif text-white">Maak de avond compleet</h2>
            <div className="space-y-4">
              {MOCK_ADDONS.map(addon => {
                const isSelected = wizardData.addons.some((a: any) => a.id === addon.id);
                const price = pricing && pricing[addon.id === 'pre-drinks' ? 'addonPreDrink' : 'addonAfterDrink'] 
                              ? pricing[addon.id === 'pre-drinks' ? 'addonPreDrink' : 'addonAfterDrink'] 
                              : addon.price;

                return (
                  <Card 
                    key={addon.id} 
                    onClick={() => {
                        const newAddons = wizardData.addons.filter((a: any) => a.id !== addon.id);
                        if (!isSelected) {
                            newAddons.push({ id: addon.id, quantity: wizardData.totalGuests });
                        }
                        updateWizard({ addons: newAddons });
                    }}
                    className={`p-6 flex flex-col md:flex-row items-center justify-between cursor-pointer transition-all border-2 ${isSelected ? 'bg-slate-900 border-emerald-500' : 'bg-slate-900/50 border-slate-800 hover:border-slate-600'}`}
                  >
                    <div className="flex items-start space-x-4 mb-4 md:mb-0">
                       <div className={`p-4 rounded-full ${isSelected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-400'}`}>
                          {addon.id === 'pre-drinks' ? <Coffee size={24}/> : <Wine size={24}/>}
                       </div>
                       <div>
                          <h4 className="text-lg font-bold text-white">{addon.name}</h4>
                          <p className="text-sm text-slate-400 max-w-md mt-1">{addon.description}</p>
                       </div>
                    </div>
                    <div className="text-center md:text-right">
                       <p className="text-xl font-serif text-amber-500 mb-2">€{price.toFixed(2)} p.p.</p>
                       {isSelected ? (
                         <span className="inline-flex items-center text-emerald-500 text-sm font-bold"><CheckCircle2 size={16} className="mr-1"/> Toegevoegd ({wizardData.totalGuests}x)</span>
                       ) : (
                         <Button variant="secondary" className="text-xs px-4">Toevoegen</Button>
                       )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );

      case 4: // MERCH
        return (
          <div className="space-y-6">
             <h2 className="text-3xl font-serif text-white">Souvenirs & Shop</h2>
             <MerchandisePicker 
               selections={wizardData.merchandise} 
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
               totalGuests={wizardData.totalGuests}
             />
          </div>
        );

      case 5: // DETAILS
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-serif text-white">Uw Gegevens</h2>
            
            {duplicateWarning && (
              <div className="p-4 bg-amber-900/20 border border-amber-500/50 rounded-xl flex items-start text-amber-200 animate-in slide-in-from-top-2">
                <AlertTriangle size={20} className="mr-3 shrink-0 mt-0.5" />
                <p className="text-sm">
                  Let op: Er bestaat al een recente reservering met dit e-mailadres voor deze datum. 
                  Controleer of u geen dubbele boeking maakt.
                </p>
              </div>
            )}

            <Card className="p-6 bg-slate-900 border-slate-800 space-y-4">
               {/* Use previous customer data if available (Admin/Debug helper) */}
               {process.env.NODE_ENV === 'development' && (
                 <button onClick={autofillPreviousCustomer} className="text-xs text-slate-500 underline mb-4 hover:text-white">
                   [DEBUG] Vul laatst gebruikte in
                 </button>
               )}

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input 
                    label="Voornaam *" 
                    value={wizardData.customer.firstName} 
                    onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, firstName: e.target.value } })}
                    error={getFieldError('firstName')}
                    icon={<User size={16} />}
                  />
                  <Input 
                    label="Achternaam *" 
                    value={wizardData.customer.lastName} 
                    onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, lastName: e.target.value } })}
                    error={getFieldError('lastName')}
                    icon={<User size={16} />}
                  />
                  <Input 
                    label="E-mailadres *" 
                    type="email"
                    value={wizardData.customer.email} 
                    onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, email: e.target.value } })}
                    error={getFieldError('email')}
                    icon={<Mail size={16} />}
                  />
                  
                  {/* Phone Row: Code + Number */}
                  <div className="flex gap-2">
                    <div className="w-1/3">
                        <label className="text-xs font-bold text-amber-500/80 uppercase tracking-widest block mb-2">Code</label>
                        <select 
                            className="w-full px-2 py-3 bg-black/40 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500 appearance-none"
                            value={wizardData.customer.phoneCode || '+31'}
                            onChange={(e) => updateWizard({ customer: { ...wizardData.customer, phoneCode: e.target.value } })}
                        >
                            {PHONE_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                        </select>
                    </div>
                    <div className="flex-grow">
                        <Input 
                            label="Telefoonnummer *" 
                            type="tel"
                            value={wizardData.customer.phone} 
                            onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, phone: e.target.value } })}
                            error={getFieldError('phone')}
                            icon={<Phone size={16} />}
                        />
                    </div>
                  </div>
               </div>

               {/* Business Toggle */}
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
                     <span className="font-bold text-white text-sm flex items-center"><Building2 size={16} className="mr-2 text-blue-500"/> Zakelijke boeking?</span>
                  </label>

                  {wizardData.customer.companyName && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-in slide-in-from-top-2">
                          <Input 
                             label="Bedrijfsnaam" 
                             value={wizardData.customer.companyName === 'Bedrijf' ? '' : wizardData.customer.companyName} 
                             onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, companyName: e.target.value } })}
                             placeholder="Bedrijfsnaam BV"
                          />
                          <Input 
                             label="Opmerkingen Factuur" 
                             value={wizardData.customer.billingInstructions || ''} 
                             onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, billingInstructions: e.target.value } })}
                             placeholder="Kostenplaats, PO-nummer, etc."
                          />
                      </div>
                  )}
               </div>

               <div className="pt-4 border-t border-slate-800">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center">
                    <MapPin size={14} className="mr-2"/> Adresgegevens
                  </h4>
                  <div className="grid grid-cols-4 gap-4">
                     <div className="col-span-4 md:col-span-2">
                        <label className="text-xs font-bold text-amber-500/80 uppercase tracking-widest block mb-2">Land</label>
                        <select 
                            className="w-full px-4 py-3 bg-black/40 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500 appearance-none"
                            value={wizardData.customer.country || 'NL'}
                            onChange={(e) => updateWizard({ customer: { ...wizardData.customer, country: e.target.value } })}
                        >
                            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                        </select>
                     </div>
                     <div className="col-span-3">
                       <Input label="Straat *" value={wizardData.customer.street} onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, street: e.target.value } })} error={getFieldError('street')} />
                     </div>
                     <div className="col-span-1">
                       <Input label="Huisnr *" value={wizardData.customer.houseNumber} onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, houseNumber: e.target.value } })} error={getFieldError('houseNumber')} />
                     </div>
                     <div className="col-span-1">
                       <Input label="Postcode *" value={wizardData.customer.zip} onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, zip: e.target.value } })} error={getFieldError('zip')} />
                     </div>
                     <div className="col-span-3">
                       <Input label="Woonplaats *" value={wizardData.customer.city} onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, city: e.target.value } })} error={getFieldError('city')} />
                     </div>
                  </div>
               </div>
            </Card>
          </div>
        );

      case 6: // NOTES (UPDATED WITH VISUAL TILES)
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-serif text-white">Wensen & Opmerkingen</h2>
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
                   <span className="font-bold text-white text-sm flex items-center"><PartyPopper size={16} className="mr-2 text-purple-500"/> Iets te vieren?</span>
                 </label>
                 {wizardData.notes.isCelebrating && (
                   <Input 
                     placeholder="Wat vieren we? (bijv. Verjaardag Sarah)" 
                     value={wizardData.notes.celebrationText || ''} 
                     onChange={(e: any) => updateWizard({ notes: { ...wizardData.notes, celebrationText: e.target.value } })}
                     className="h-10 text-sm bg-black/40 border-slate-700"
                   />
                 )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 block">Dieetwensen & Allergieën</label>
                
                {/* VISUAL TILES GRID */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {DIETARY_OPTIONS.map(opt => {
                    const currentCount = wizardData.notes.structuredDietary?.[opt.id] || 0;
                    const Icon = opt.icon;
                    const isSelected = currentCount > 0;

                    return (
                      <div 
                        key={opt.id} 
                        onClick={() => !isSelected && handleDietaryChange(opt.id, 1)}
                        className={`
                            relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all cursor-pointer group
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
                                >
                                    <Minus size={14} />
                                </button>
                                <span className="w-4 text-center font-bold text-white text-sm">{currentCount}</span>
                                <button 
                                    onClick={() => handleDietaryChange(opt.id, 1)}
                                    className="w-8 h-8 flex items-center justify-center rounded bg-slate-800 text-amber-500 hover:bg-slate-700 transition-colors"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Overige opmerkingen</label>
                <textarea 
                  className="w-full bg-black/40 border border-slate-700 rounded-xl p-4 text-sm text-white focus:border-amber-500 outline-none h-32 resize-none"
                  placeholder="Bijv. Rolstoel toegankelijkheid, specifieke plaatsingswensen..."
                  value={wizardData.notes.comments || ''}
                  onChange={(e) => handleCommentsChange(e.target.value)}
                />
              </div>
            </Card>
          </div>
        );

      case 7: // REVIEW
        return (
          <div className="space-y-6">
             <h2 className="text-3xl font-serif text-white">Controleer uw gegevens</h2>
             <Card className="bg-slate-900 border-slate-800 p-6 space-y-6 relative overflow-hidden">
                {/* Visual Ticket Effect */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                <div className="flex justify-between items-start border-b border-slate-800 pb-4 relative z-10">
                   <div>
                      <h3 className="font-bold text-white text-lg">Reservering details</h3>
                      <p className="text-slate-400 text-sm mt-1">
                        {new Date(wizardData.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        <br/>
                        {wizardData.totalGuests} Personen • {wizardData.packageType} Arrangement
                      </p>
                   </div>
                   <Button variant="ghost" onClick={() => navigate('/book/wizard?step=1')} className="text-xs">Wijzig</Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                   <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Persoonlijke Gegevens</h4>
                      <p className="text-white font-bold">{wizardData.customer.firstName} {wizardData.customer.lastName}</p>
                      {wizardData.customer.companyName && <p className="text-amber-500 text-xs font-bold uppercase">{wizardData.customer.companyName}</p>}
                      <p className="text-slate-400 text-sm">{wizardData.customer.email}</p>
                      <p className="text-slate-400 text-sm">{wizardData.customer.phoneCode} {wizardData.customer.phone}</p>
                      <p className="text-slate-400 text-sm mt-1">{wizardData.customer.street} {wizardData.customer.houseNumber}, {wizardData.customer.city} ({wizardData.customer.country})</p>
                   </div>
                   <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Opmerkingen</h4>
                      {wizardData.notes.dietary ? (
                          <div className="flex items-start space-x-2">
                              <Utensils size={14} className="text-amber-500 mt-0.5" />
                              <p className="text-white text-sm">{wizardData.notes.dietary}</p>
                          </div>
                      ) : <p className="text-slate-500 text-sm italic">Geen dieetwensen</p>}
                      
                      {wizardData.notes.isCelebrating && (
                          <div className="flex items-start space-x-2 mt-2">
                              <PartyPopper size={14} className="text-purple-500 mt-0.5" />
                              <p className="text-white text-sm">Viering: {wizardData.notes.celebrationText}</p>
                          </div>
                      )}
                      
                      {wizardData.customer.billingInstructions && (
                          <div className="mt-2 pt-2 border-t border-slate-800">
                              <p className="text-[10px] font-bold text-blue-500 uppercase">Factuur Opmerking</p>
                              <p className="text-xs text-slate-400">{wizardData.customer.billingInstructions}</p>
                          </div>
                      )}
                   </div>
                </div>

                <div className="bg-black/30 p-4 rounded-xl border border-slate-800 mt-4">
                   <label className="flex items-start space-x-3 cursor-pointer">
                      <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${agreedToTerms ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 bg-slate-900'}`}>
                         {agreedToTerms && <CheckCircle2 size={14} className="text-black"/>}
                      </div>
                      <input type="checkbox" className="hidden" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} />
                      <span className="text-sm text-slate-300">
                         Ik ga akkoord met de <a href="#" className="text-amber-500 hover:underline">algemene voorwaarden</a> en het privacybeleid van Inspiration Point.
                      </span>
                   </label>
                </div>
             </Card>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-200 pb-32 md:pb-20 relative">
      <Stepper steps={steps} current={step} />

      <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8 pb-24 md:pb-0">
          {submitError && <ErrorBanner message={submitError} onDismiss={dismissError} />}
          
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Logic to render correct step content */}
            {step === 0 && !wizardData.date && <Button onClick={() => navigate('/book')}>Selecteer Datum</Button>} 
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

      {/* Sticky Action Bar */}
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
            {step > 0 && !isWaitlistFull && (
              <Button variant="ghost" onClick={prevStep} disabled={isSubmitting} className="px-4">
                Terug
              </Button>
            )}
            {step < steps.length - 1 && !isWaitlistFull ? (
              <Button onClick={handleNext} disabled={false} className="px-6 bg-amber-500 text-black hover:bg-amber-400">
                Volgende <ArrowRight size={16} className="ml-2" />
              </Button>
            ) : (
              !isWaitlistFull && (
                <Button 
                  onClick={submitBooking} 
                  disabled={isSubmitting || (step === 7 && !agreedToTerms)} 
                  className={`px-8 shadow-lg ${isWaitlistMode ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-900/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20'}`}
                >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : isWaitlistMode ? 'Plaats op Wachtlijst' : 'Verstuur Aanvraag'}
                </Button>
              )
            )}
          </div>
        </div>
      </div>

      {/* MOBILE SUMMARY SHEET */}
      {showMobileSummary && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileSummary(false)} />
          <div className="absolute bottom-[80px] left-0 w-full bg-slate-900 rounded-t-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-10 max-h-[70vh] overflow-y-auto">
             <div className="flex justify-center mb-4"><div className="w-12 h-1.5 bg-slate-800 rounded-full" /></div>
             <BookingSummary data={wizardData} onUpdate={updateWizard} />
          </div>
        </div>
      )}

      {/* UPSELL MODAL */}
      {showUpsellModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
           <Card className="w-full max-w-md bg-slate-950 border-amber-500/50 border-2 shadow-[0_0_50px_rgba(245,158,11,0.2)] text-center p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
              <div className="mb-6 flex justify-center">
                 <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-500 animate-bounce">
                    <Gift size={40} />
                 </div>
              </div>
              <h3 className="text-2xl font-serif text-white mb-2">Maak de viering compleet!</h3>
              <p className="text-slate-400 mb-8 leading-relaxed">
                 Gefeliciteerd met jullie viering! Voeg ons speciale <strong>Celebration Pack</strong> toe voor slechts €15,00. 
                 Inclusief tafelversiering, een persoonlijke kaart en een glas bubbels bij aankomst.
              </p>
              <div className="flex gap-3">
                 <Button variant="ghost" onClick={handleDeclineUpsell} className="flex-1">Nee, bedankt</Button>
                 <Button onClick={handleAcceptUpsell} className="flex-1 bg-amber-500 text-black hover:bg-amber-400 border-none shadow-lg shadow-amber-900/20">Ja, graag!</Button>
              </div>
           </Card>
        </div>
      )}

    </div>
  );
};
