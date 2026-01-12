
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, ShoppingBag, CheckCircle2, 
  ArrowRight, Loader2, Coffee, Wine,
  AlertTriangle, ChevronUp, ChevronDown, Info, PartyPopper, Star, Clock, Minus, Plus, Lock
} from 'lucide-react';
import { Stepper, Button, Card, Input } from './UI';
import { MerchandisePicker, MerchandiseSummaryList } from './MerchandisePicker';
import { BookingSummary } from './BookingSummary';
import { ErrorBanner } from './UI/ErrorBanner';
import { MOCK_ADDONS } from '../mock/data';
import { useBookingWizardLogic } from '../hooks/useBookingWizardLogic';

const COUNTRY_CODES = [
  { code: 'NL', label: 'Nederland (+31)', prefix: '+31' },
  { code: 'BE', label: 'België (+32)', prefix: '+32' },
  { code: 'DE', label: 'Duitsland (+49)', prefix: '+49' },
  { code: 'OTHER', label: 'Anders', prefix: '' }
];

const DIETARY_OPTIONS = [
  'Glutenvrij', 
  'Lactosevrij', 
  'Notenallergie', 
  'Vegetarisch', 
  'Veganistisch'
];

export const BookingWizard = () => {
  const navigate = useNavigate();
  const [showMobileSummary, setShowMobileSummary] = useState(false);
  
  // Use the new hook for all logic
  const { data, actions, status, validation } = useBookingWizardLogic();
  
  const { 
    wizardData, step, steps, pricing, financials, 
    eventData, duplicateWarning, isWaitlistMode, isWaitlistFull, // New prop to block UI if needed
    capacityTarget, addonThreshold 
  } = data;
  
  const { 
    updateWizard, nextStep, prevStep, setStep, 
    autofillPreviousCustomer, handleCapitalize, submitBooking, dismissError 
  } = actions;

  const { isSubmitting, submitError, canProceed } = status;
  const { getFieldError } = validation;

  // Safety Redirect: If user lands here on a CLOSED date (bypassed calendar), block them.
  useEffect(() => {
    if (isWaitlistFull && step === 0) {
       // Ideally we'd show a "Closed" screen, but rendering the "Waitlist Full" alert in renderStepContent handles this
    }
  }, [isWaitlistFull, step]);

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

  // --- RENDER STEPS ---

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
        if (isWaitlistMode) return null; // Should be skipped by logic, but safe render
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
        if (isWaitlistMode) return null;
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
        if (isWaitlistMode) return null;
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
                {/* Inputs ... (Same as before) */}
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
                  <Input 
                    label="Voornaam *" 
                    value={wizardData.customer.firstName} 
                    onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, firstName: e.target.value } })} 
                    onBlur={(e: any) => handleCapitalize(e, 'firstName')}
                    error={getFieldError('firstName')}
                  />
                </div>

                <div className="md:col-span-2">
                  <Input 
                    label="Achternaam *" 
                    value={wizardData.customer.lastName} 
                    onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, lastName: e.target.value } })} 
                    onBlur={(e: any) => handleCapitalize(e, 'lastName')}
                    error={getFieldError('lastName')}
                  />
                </div>
                <div className="md:col-span-2">
                  <Input 
                    label="Email *" 
                    type="email" 
                    value={wizardData.customer.email} 
                    onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, email: e.target.value } })} 
                    error={getFieldError('email')}
                  />
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
                      className={`flex-grow px-4 py-3 bg-black/40 border rounded-xl text-amber-50 focus:border-amber-600 outline-none ${getFieldError('phone') ? 'border-red-500' : 'border-slate-800'}`}
                      placeholder="0612345678"
                      value={wizardData.customer.phone}
                      onChange={(e) => updateWizard({ customer: { ...wizardData.customer, phone: e.target.value } })}
                    />
                  </div>
                  {getFieldError('phone') && <p className="text-xs text-red-400">{getFieldError('phone')}</p>}
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
                      error={getFieldError('street')}
                    />
                  </div>
                  <div>
                    <Input 
                      label="Huisnummer *" 
                      value={wizardData.customer.houseNumber} 
                      onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, houseNumber: e.target.value } })} 
                      error={getFieldError('houseNumber')}
                    />
                  </div>
                  
                  <div className="md:col-span-1">
                    <Input 
                      label="Postcode *" 
                      value={wizardData.customer.zip} 
                      onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, zip: e.target.value } })} 
                      error={getFieldError('zip')}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Input 
                      label="Woonplaats *" 
                      value={wizardData.customer.city} 
                      onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, city: e.target.value } })} 
                      onBlur={(e: any) => handleCapitalize(e, 'city')} 
                      error={getFieldError('city')}
                    />
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
                      {/* Billing fields ... same as before ... */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-3">
                          <Input 
                            label="Straat (Factuur) *" 
                            value={wizardData.customer.billingAddress?.street || ''} 
                            onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, billingAddress: { ...wizardData.customer.billingAddress, street: e.target.value } } })} 
                            error={getFieldError('billingAddress.street')}
                          />
                        </div>
                        <div>
                          <Input 
                            label="Nr *" 
                            value={wizardData.customer.billingAddress?.houseNumber || ''} 
                            onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, billingAddress: { ...wizardData.customer.billingAddress, houseNumber: e.target.value } } })} 
                            error={getFieldError('billingAddress.houseNumber')}
                          />
                        </div>
                        <div className="md:col-span-1">
                          <Input 
                            label="Postcode *" 
                            value={wizardData.customer.billingAddress?.zip || ''} 
                            onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, billingAddress: { ...wizardData.customer.billingAddress, zip: e.target.value } } })} 
                            error={getFieldError('billingAddress.zip')}
                          />
                        </div>
                        <div className="md:col-span-3">
                          <Input 
                            label="Stad (Factuur) *" 
                            value={wizardData.customer.billingAddress?.city || ''} 
                            onChange={(e: any) => updateWizard({ customer: { ...wizardData.customer, billingAddress: { ...wizardData.customer.billingAddress, city: e.target.value } } })} 
                            error={getFieldError('billingAddress.city')}
                          />
                        </div>
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
              {/* Same as before... */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 block">Dieetwensen & Allergieën</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {DIETARY_OPTIONS.map(opt => {
                    const currentCount = wizardData.notes.structuredDietary?.[opt] || 0;
                    return (
                      <div key={opt} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${currentCount > 0 ? 'bg-amber-900/10 border-amber-500/50' : 'bg-slate-950 border-slate-800'}`}>
                        <span className={`text-sm font-bold ${currentCount > 0 ? 'text-amber-500' : 'text-slate-400'}`}>{opt}</span>
                        <div className="flex items-center space-x-3 bg-black/40 rounded-lg p-1">
                          <button 
                            onClick={() => handleDietaryChange(opt, -1)}
                            disabled={currentCount === 0}
                            className="w-8 h-8 flex items-center justify-center rounded bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center font-bold text-white text-sm">{currentCount}</span>
                          <button 
                            onClick={() => handleDietaryChange(opt, 1)}
                            className="w-8 h-8 flex items-center justify-center rounded bg-slate-900 text-slate-400 hover:text-amber-500 hover:bg-slate-800 transition-colors"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
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
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-3xl font-serif text-white">Controleer uw aanvraag</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-6 bg-slate-900 border-slate-800 space-y-6">
                   {isWaitlistMode && (
                     <div className="p-4 bg-orange-900/20 border border-orange-500/50 rounded-xl flex items-center mb-4">
                       <Info size={20} className="text-orange-500 mr-3" />
                       <div className="text-orange-200 text-sm">
                         <strong>Wachtlijst Inschrijving</strong><br/>
                         U schrijft zich in voor de wachtlijst. Als er plek vrijkomt, nemen we contact met u op.
                       </div>
                     </div>
                   )}

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                     <div>
                       <p className="text-xs text-slate-500 uppercase font-bold">Datum & Tijd</p>
                       <p className="text-white font-bold text-lg">{new Date(wizardData.date).toLocaleDateString()}</p>
                       <p className="text-slate-400">
                         {(eventData?.event as any)?.times?.start || eventData?.event?.startTime || '19:30'} Aanvang
                       </p>
                     </div>
                     <div>
                       <p className="text-xs text-slate-500 uppercase font-bold">Details</p>
                       {!isWaitlistMode && <p className="text-white font-bold text-lg capitalize">{wizardData.packageType}</p>}
                       <p className="text-slate-400">{wizardData.totalGuests} Personen</p>
                     </div>
                     <div>
                       <p className="text-xs text-slate-500 uppercase font-bold">Gegevens</p>
                       <p className="text-white">{wizardData.customer.salutation} {wizardData.customer.firstName} {wizardData.customer.lastName}</p>
                       <p className="text-slate-400">{wizardData.customer.email}</p>
                       <p className="text-slate-400">{wizardData.customer.phoneCode} {wizardData.customer.phone}</p>
                     </div>
                     
                     {/* Hide price for waitlist */}
                     {!isWaitlistMode && (
                       <div>
                         <p className="text-xs text-slate-500 uppercase font-bold">Totaal (Indicatie)</p>
                         <p className="text-emerald-500 font-bold text-lg">€{financials.amountDue.toFixed(2)}</p>
                       </div>
                     )}
                   </div>

                   {!isWaitlistMode && <MerchandiseSummaryList selections={wizardData.merchandise} />}
                </Card>
              </div>

              <div className="space-y-6">
                <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                  <h4 className="font-bold text-white flex items-center">
                    <Info size={18} className="mr-2 text-blue-500" />
                    Belangrijke Informatie
                  </h4>
                  
                  <div className="space-y-3">
                    {isWaitlistMode ? (
                      <div className="flex items-start space-x-3 text-sm text-slate-400">
                        <Clock size={16} className="mt-0.5 shrink-0 text-orange-500" />
                        <div>
                          <p className="text-white font-bold mb-0.5">Wachttijd</p>
                          <p className="text-xs leading-relaxed">
                            Zodra er een plek vrijkomt, ontvangt u een e-mail. U heeft dan 24 uur om te bevestigen.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start space-x-3 text-sm text-slate-400">
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                        <div>
                          <p className="text-white font-bold mb-0.5">Kosteloos Wijzigen</p>
                          <p className="text-xs leading-relaxed">
                            U kunt uw reservering tot <strong className="text-slate-300">2 weken</strong> voor de voorstelling kosteloos wijzigen.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
        
      default: return null;
    }
  };

  if (isWaitlistFull && step === 0) {
      // Early return to prevent flash of content
      return renderStepContent();
  }

  return (
    <div className="min-h-screen bg-black text-slate-200 pb-32 md:pb-20 relative">
      <Stepper steps={steps} current={step} />

      <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8 pb-24 md:pb-0">
          {submitError && <ErrorBanner message={submitError} onDismiss={dismissError} />}
          
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
              <Button onClick={nextStep} disabled={false} className="px-6 bg-amber-500 text-black hover:bg-amber-400">
                Volgende <ArrowRight size={16} className="ml-2" />
              </Button>
            ) : (
              !isWaitlistFull && (
                <Button onClick={submitBooking} disabled={isSubmitting} className={`px-8 shadow-lg ${isWaitlistMode ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-900/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20'}`}>
                    {isSubmitting ? <Loader2 className="animate-spin" /> : isWaitlistMode ? 'Plaats op Wachtlijst' : 'Verstuur Aanvraag'}
                </Button>
              )
            )}
            {isWaitlistFull && (
                <Button onClick={() => navigate('/book')} variant="secondary">Terug naar Agenda</Button>
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
