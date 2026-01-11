
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, Users, CheckCircle2, AlertCircle, ShoppingBag, 
  CreditCard, FileText, User, Tag, ArrowRight, Save, X, RotateCcw
} from 'lucide-react';
import { Button, Card, Input, Stepper } from '../UI';
import { AvailabilityFinder } from './AvailabilityFinder';
import { MerchandisePicker, MerchandiseSummaryList } from '../MerchandisePicker';
import { 
  bookingRepo, getEvents, getShowDefinitions, 
  tasksRepo, promoRepo, voucherRepo 
} from '../../utils/storage';
import { calculateBookingTotals, getEffectivePricing } from '../../utils/pricing';
import { triggerEmail } from '../../utils/emailEngine';
import { logAuditAction } from '../../utils/auditLogger';
import { Reservation, BookingStatus, EventDate, ShowDefinition } from '../../types';
import { MOCK_ADDONS } from '../../mock/data';

const STEPS = ['Datum & Show', 'Details & Extra\'s', 'Klantgegevens', 'Status & Betaling'];

export const AdminBookingWizard = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  
  // --- STATE ---
  const [formData, setFormData] = useState({
    date: '',
    showId: '',
    totalGuests: 2,
    packageType: 'standard' as 'standard' | 'premium',
    addons: [] as { id: string; quantity: number }[],
    merchandise: [] as { id: string; quantity: number }[],
    customer: {
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

  // Derived Data
  const [selectedEvent, setSelectedEvent] = useState<EventDate | null>(null);
  const [selectedShow, setSelectedShow] = useState<ShowDefinition | null>(null);
  const [financials, setFinancials] = useState<any>(null);

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
          // Reverse calculate "discount" for display consistency? 
          // Or just treat override as authoritative.
          // Let's mark it in the object
          (totals as any).isOverridden = true;
        }

        setFinancials(totals);
      }
    }
  }, [formData]);

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
         triggerEmail('BOOKING_OPTION_EXPIRING', { type: 'RESERVATION', id: resId, data: newReservation }); // Reuse option template
       }
    }

    navigate('/admin/reservations');
  };

  // --- RENDER STEPS ---

  const renderStep = () => {
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
            <div className="space-y-6">
               <Card className="p-6 bg-slate-900 border-slate-800">
                 <h3 className="text-lg font-bold text-white mb-4 flex items-center"><Users className="mr-2 text-amber-500"/> Basis</h3>
                 <div className="grid grid-cols-2 gap-4">
                    <Input 
                      label="Aantal Personen" 
                      type="number" 
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
                     // Logic: disabled if below threshold AND not ignored
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
            </div>

            <div className="space-y-6">
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
          </div>
        );

      case 2: // CUSTOMER & NOTES
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
             <Card className="p-6 bg-slate-900 border-slate-800 space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center"><User className="mr-2 text-amber-500"/> Klantgegevens</h3>
                <div className="grid grid-cols-2 gap-4">
                   <Input label="Voornaam" value={formData.customer.firstName} onChange={(e: any) => setFormData({...formData, customer: {...formData.customer, firstName: e.target.value}})} />
                   <Input label="Achternaam" value={formData.customer.lastName} onChange={(e: any) => setFormData({...formData, customer: {...formData.customer, lastName: e.target.value}})} />
                   <Input label="Email" value={formData.customer.email} onChange={(e: any) => setFormData({...formData, customer: {...formData.customer, email: e.target.value}})} />
                   <Input label="Telefoon" value={formData.customer.phone} onChange={(e: any) => setFormData({...formData, customer: {...formData.customer, phone: e.target.value}})} />
                   <div className="col-span-2">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
             <div className="space-y-6">
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

                    {formData.status === 'OPTION' && (
                      <div className="space-y-1.5 animate-in fade-in">
                        <label className="text-xs font-bold text-amber-500 uppercase tracking-widest">Optie Verloopt Op</label>
                        <Input 
                          type="date" 
                          value={formData.optionExpiry}
                          onChange={(e: any) => setFormData({...formData, optionExpiry: e.target.value})}
                        />
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

             {/* Right: Summary & Adjustments */}
             <Card className="p-6 bg-slate-950 border-slate-800 flex flex-col h-full">
                <h3 className="text-lg font-bold text-white mb-6">Financieel Overzicht</h3>
                
                <div className="space-y-3 text-sm text-slate-300 flex-grow">
                   <div className="flex justify-between">
                     <span>Arrangement ({formData.totalGuests}p)</span>
                     <span>€{(financials?.subtotal || 0).toFixed(2)}</span>
                   </div>
                   
                   {/* Breakdown of items */}
                   <MerchandiseSummaryList selections={formData.merchandise} />
                   
                   {/* Adjustments */}
                   <div className="pt-4 border-t border-slate-800 space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Promo Code</label>
                        <Input 
                          placeholder="Bijv. FAMILY10" 
                          value={formData.discountCode}
                          onChange={(e: any) => setFormData({...formData, discountCode: e.target.value.toUpperCase()})}
                          className="h-10 text-xs"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Manuele Korting (€)</label>
                          <Input 
                            type="number"
                            value={formData.manualDiscount}
                            onChange={(e: any) => setFormData({...formData, manualDiscount: parseFloat(e.target.value) || 0})}
                            className="h-10 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Override Totaal (€)</label>
                          <Input 
                            type="number"
                            placeholder="Auto"
                            value={formData.overrideTotal ?? ''}
                            onChange={(e: any) => setFormData({...formData, overrideTotal: e.target.value ? parseFloat(e.target.value) : null})}
                            className="h-10 text-xs border-amber-900/50 focus:border-amber-500"
                          />
                        </div>
                      </div>
                   </div>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-800">
                   <div className="flex justify-between items-end">
                     <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Totaal</span>
                     <span className="text-3xl font-serif text-white">€{(financials?.amountDue || 0).toFixed(2)}</span>
                   </div>
                   {(financials as any)?.isOverridden && (
                     <p className="text-xs text-amber-500 text-right mt-1 font-bold">Handmatig aangepast</p>
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
        <div>
          <h1 className="text-3xl font-serif text-white">Nieuwe Reservering</h1>
          <p className="text-slate-500 text-sm">Admin Manual Booking</p>
        </div>
        <div className="flex space-x-3">
           <Button variant="ghost" onClick={() => navigate('/admin/reservations')}>Annuleren</Button>
        </div>
      </div>

      {/* Stepper */}
      <div className="mb-8">
        <Stepper steps={STEPS} current={step} />
      </div>

      {/* Content */}
      <div className="flex-grow pb-24">
        {renderStep()}
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-950 border-t border-slate-900 p-4 z-40 lg:pl-72">
         <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="text-sm text-slate-400">
               {step > 0 && selectedShow && (
                 <span>
                   Boeking voor <strong>{selectedShow.name}</strong> op <strong>{new Date(formData.date).toLocaleDateString()}</strong>
                 </span>
               )}
            </div>
            <div className="flex space-x-3">
               {step > 0 && <Button variant="secondary" onClick={() => setStep(s => s-1)}>Terug</Button>}
               {step < STEPS.length - 1 ? (
                 <Button onClick={() => setStep(s => s+1)} disabled={step === 0 && !formData.date}>
                   Volgende <ArrowRight size={16} className="ml-2"/>
                 </Button>
               ) : (
                 <Button onClick={handleSubmit} className="bg-emerald-600 hover:bg-emerald-700">
                   <Save size={16} className="mr-2"/> Boeking Aanmaken
                 </Button>
               )}
            </div>
         </div>
      </div>
    </div>
  );
};
