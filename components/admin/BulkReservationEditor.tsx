
import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, ShoppingBag, Utensils, 
  PartyPopper, Search, Edit3, 
  Copy, X, Check, Building2, MapPin, Phone, Mail, User, AlertCircle
} from 'lucide-react';
import { Button, Input, Card } from '../UI';
import { Reservation, ShowDefinition, EventDate, BookingStatus, Customer } from '../../types';
import { bookingRepo, customerRepo } from '../../utils/storage';
import { calculateBookingTotals, getEffectivePricing } from '../../utils/pricing';
import { MerchandisePicker, MerchandiseSummaryList } from '../MerchandisePicker';
import { logAuditAction } from '../../utils/auditLogger';

interface BulkEditorProps {
  event: EventDate;
  show: ShowDefinition;
  onClose: () => void;
  onSuccess: () => void;
}

interface DraftReservation {
  tempId: string;
  // Customer Data Flattened
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  street: string;
  houseNumber: string;
  zip: string;
  city: string;
  // Booking Data
  partySize: number;
  packageType: 'standard' | 'premium';
  dietary: string;
  isCelebrating: boolean;
  celebrationText: string;
  merchandise: { id: string; quantity: number }[];
  customerId?: string; 
}

export const BulkReservationEditor: React.FC<BulkEditorProps> = ({ event, show, onClose, onSuccess }) => {
  const [drafts, setDrafts] = useState<DraftReservation[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Modals State
  const [activeModal, setActiveModal] = useState<{ type: 'EXTRAS' | 'ADDRESS', draftId: string } | null>(null);

  // Search State
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState<{ [key: string]: string }>({}); 
  const [suggestions, setSuggestions] = useState<{ rowId: string, matches: Customer[] } | null>(null);

  const pricing = getEffectivePricing(event, show);

  useEffect(() => {
    setAllCustomers(customerRepo.getAll());
    addEmptyRow();
  }, []);

  const addEmptyRow = () => {
    const newId = `draft-${Date.now()}-${Math.random()}`;
    setDrafts(prev => [
      ...prev, 
      {
        tempId: newId,
        firstName: '', lastName: '', email: '', phone: '', companyName: '',
        street: '', houseNumber: '', zip: '', city: '',
        partySize: 2,
        packageType: 'standard',
        dietary: '',
        isCelebrating: false,
        celebrationText: '',
        merchandise: [],
      }
    ]);
  };

  const updateDraft = (id: string, field: keyof DraftReservation, value: any) => {
    setDrafts(prev => prev.map(d => d.tempId === id ? { ...d, [field]: value } : d));
  };

  const duplicateDraft = (draft: DraftReservation) => {
    setDrafts(prev => [
      ...prev,
      { 
        ...draft, 
        tempId: `draft-${Date.now()}`,
        customerId: undefined, 
      }
    ]);
  };

  const removeDraft = (id: string) => {
    setDrafts(prev => prev.filter(d => d.tempId !== id));
  };

  // --- SEARCH LOGIC ---

  const handleSearchChange = (rowId: string, query: string) => {
    setSearchQuery({ ...searchQuery, [rowId]: query });
    
    if (query.length > 1) {
      const lowerQ = query.toLowerCase();
      const matches = allCustomers.filter(c => 
        c.lastName.toLowerCase().includes(lowerQ) || 
        c.firstName.toLowerCase().includes(lowerQ) ||
        (c.companyName && c.companyName.toLowerCase().includes(lowerQ)) ||
        c.email.toLowerCase().includes(lowerQ)
      ).slice(0, 5); 
      
      // FIX: Always show suggestions dropdown if query > 1, allowing creation of new users even if no match
      setSuggestions({ rowId, matches });
    } else {
      setSuggestions(null);
    }
  };

  const selectCustomer = (draftId: string, customer: Customer) => {
    setDrafts(prev => prev.map(d => d.tempId === draftId ? {
      ...d,
      customerId: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      companyName: customer.companyName || '',
      street: customer.street || '',
      houseNumber: customer.houseNumber || '',
      zip: customer.zip || '',
      city: customer.city || ''
    } : d));
    
    setSearchQuery({ ...searchQuery, [draftId]: '' });
    setSuggestions(null);
  };

  const clearCustomer = (draftId: string) => {
    setDrafts(prev => prev.map(d => d.tempId === draftId ? {
      ...d,
      customerId: undefined,
      firstName: '', lastName: '', email: '', phone: '', companyName: '',
      street: '', houseNumber: '', zip: '', city: ''
    } : d));
  };

  // --- CALCULATION ---

  const calculateRowTotal = (draft: DraftReservation) => {
    const totals = calculateBookingTotals({
        totalGuests: draft.partySize,
        packageType: draft.packageType,
        addons: [],
        merchandise: draft.merchandise
    }, pricing);
    return totals.amountDue;
  };

  // --- SAVE ---

  const handleSaveAll = async () => {
    setIsProcessing(true);
    const validDrafts = drafts.filter(d => d.lastName.trim().length > 0 || d.companyName.trim().length > 0);
    
    if (validDrafts.length === 0) {
      alert("Voer ten minste één geldige reservering in.");
      setIsProcessing(false);
      return;
    }

    const newReservations: Reservation[] = [];
    const updatedCustomers: Customer[] = []; 

    validDrafts.forEach((draft, idx) => {
      let custId = draft.customerId;
      if (!custId) custId = `CUST-BULK-${Date.now()}-${idx}`;

      const customerObj: Customer = {
        id: custId,
        firstName: draft.firstName || (draft.companyName ? 'Contact' : 'Gast'),
        lastName: draft.lastName || (draft.companyName ? 'Bedrijf' : ''),
        email: draft.email || `placeholder-${Date.now()}-${idx}@grandstage.nl`,
        phone: draft.phone || '',
        companyName: draft.companyName,
        isBusiness: !!draft.companyName,
        street: draft.street,
        houseNumber: draft.houseNumber,
        zip: draft.zip,
        city: draft.city,
        country: 'NL'
      };
      
      updatedCustomers.push(customerObj);

      const totals = calculateBookingTotals({
        totalGuests: draft.partySize,
        packageType: draft.packageType,
        addons: [],
        merchandise: draft.merchandise,
        date: event.date,
        showId: show.id
      }, pricing);

      const res: Reservation = {
        id: `RES-BULK-${Date.now()}-${idx}`,
        createdAt: new Date().toISOString(),
        customerId: custId,
        customer: customerObj,
        date: event.date,
        showId: show.id,
        status: BookingStatus.CONFIRMED,
        partySize: draft.partySize,
        packageType: draft.packageType,
        addons: [],
        merchandise: draft.merchandise,
        financials: {
          total: totals.subtotal,
          subtotal: totals.subtotal,
          discount: totals.discountAmount,
          finalTotal: totals.amountDue,
          paid: 0,
          isPaid: false,
          paymentMethod: 'FACTUUR',
          paymentDueAt: new Date(new Date().setDate(new Date().getDate() + 14)).toISOString()
        },
        notes: {
          dietary: draft.dietary,
          isCelebrating: draft.isCelebrating,
          celebrationText: draft.celebrationText,
          internal: 'Bulk Entry'
        },
        startTime: event.startTime
      };

      newReservations.push(res);
    });

    const currentDB = customerRepo.getAll();
    const mergedCustomers = [...currentDB];
    
    updatedCustomers.forEach(uc => {
        const idx = mergedCustomers.findIndex(c => c.id === uc.id);
        if (idx >= 0) mergedCustomers[idx] = uc; 
        else mergedCustomers.push(uc); 
    });

    customerRepo.saveAll(mergedCustomers);
    bookingRepo.saveAll([...bookingRepo.getAll(), ...newReservations]);

    logAuditAction('BULK_CREATE', 'RESERVATION', 'MULTIPLE', { description: `Bulk added ${newReservations.length} reservations` });

    setIsProcessing(false);
    onSuccess();
  };

  const activeDraft = activeModal ? drafts.find(d => d.tempId === activeModal.draftId) : null;

  return (
    <div className="fixed inset-0 bg-slate-950 z-[60] flex flex-col animate-in fade-in slide-in-from-bottom-4">
      
      {/* 1. Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-lg font-serif text-white flex items-center">
            <span className="text-amber-500 mr-2">{new Date(event.date).toLocaleDateString()}</span> 
            Bulk Invoer
          </h2>
          <p className="text-slate-500 text-xs">{show.name} • {event.startTime}</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="ghost" onClick={onClose} className="h-8 text-xs">Annuleren</Button>
          <Button onClick={handleSaveAll} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs min-w-[140px]">
            {isProcessing ? 'Verwerken...' : `Opslaan (${drafts.filter(d => d.lastName || d.companyName).length})`}
          </Button>
        </div>
      </div>

      {/* 2. Main Grid */}
      <div className="flex-grow overflow-y-auto bg-black/50 custom-scrollbar p-4 md:p-6 pb-40">
        <div className="max-w-7xl mx-auto">
          
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-12 gap-3 px-2 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <div className="col-span-4">Klant (Zoek of Typ)</div>
            <div className="col-span-1 text-center">Pers.</div>
            <div className="col-span-2">Arrangement</div>
            <div className="col-span-3">Details</div>
            <div className="col-span-2 text-right">Totaal</div>
          </div>

          {/* Rows */}
          <div className="space-y-2">
            {drafts.map((draft, idx) => {
              const hasExtras = draft.merchandise.length > 0 || draft.dietary || draft.isCelebrating;
              const isSuggesting = suggestions && suggestions.rowId === draft.tempId;
              
              return (
                <div 
                  key={draft.tempId} 
                  className="bg-slate-900 border border-slate-800 rounded-lg p-2 hover:border-slate-600 transition-colors relative group shadow-sm"
                  style={{ zIndex: isSuggesting ? 50 : 1 }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    
                    {/* Col 1: Customer Search */}
                    <div className="md:col-span-4 relative">
                      {!draft.lastName && !draft.companyName && !draft.customerId ? (
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                          <input 
                            placeholder="Zoek bedrijf, naam of email..." 
                            value={searchQuery[draft.tempId] || ''} 
                            onChange={(e) => handleSearchChange(draft.tempId, e.target.value)}
                            className="w-full h-9 bg-black border border-slate-700 rounded pl-9 pr-4 text-xs text-white placeholder:text-slate-600 focus:border-amber-500 outline-none"
                            autoFocus={idx === drafts.length - 1}
                          />
                          {isSuggesting && (
                            <div className="absolute top-full left-0 w-full bg-slate-800 border border-slate-700 rounded-b-lg shadow-xl z-20 max-h-60 overflow-y-auto">
                              {suggestions.matches.length > 0 ? (
                                suggestions.matches.map(match => (
                                  <div 
                                    key={match.id} 
                                    onClick={() => selectCustomer(draft.tempId, match)}
                                    className="p-2 hover:bg-amber-500 hover:text-black cursor-pointer border-b border-slate-700/50 last:border-0"
                                  >
                                    <div className="font-bold text-xs">{match.firstName} {match.lastName}</div>
                                    {match.companyName && <div className="text-[10px]">{match.companyName}</div>}
                                  </div>
                                ))
                              ) : (
                                <div className="p-2 text-[10px] text-slate-500 italic">Geen bestaande klant gevonden</div>
                              )}
                              
                              <div 
                                 onClick={() => {
                                   const val = searchQuery[draft.tempId];
                                   updateDraft(draft.tempId, 'lastName', val); 
                                   setSuggestions(null);
                                   setActiveModal({ type: 'ADDRESS', draftId: draft.tempId }); 
                                 }}
                                 className="p-2 bg-slate-900/50 hover:bg-emerald-600 text-emerald-400 hover:text-white cursor-pointer text-xs font-bold flex items-center border-t border-slate-700"
                              >
                                 <Plus size={12} className="mr-2"/> Nieuw: "{searchQuery[draft.tempId]}"
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-black border border-slate-700 rounded p-1.5 h-9">
                           <div className="flex items-center overflow-hidden">
                              <div className={`w-6 h-6 rounded flex items-center justify-center mr-2 shrink-0 ${draft.companyName ? 'bg-blue-900/20 text-blue-500' : 'bg-slate-800 text-slate-400'}`}>
                                 {draft.companyName ? <Building2 size={12}/> : <User size={12}/>}
                              </div>
                              <div className="min-w-0">
                                 <div className="text-xs font-bold text-white truncate">
                                   {draft.companyName || `${draft.firstName} ${draft.lastName}`}
                                 </div>
                              </div>
                           </div>
                           <div className="flex items-center space-x-1 shrink-0">
                              <button onClick={() => setActiveModal({ type: 'ADDRESS', draftId: draft.tempId })} className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-white" title="Bewerk Adres">
                                <Edit3 size={12}/>
                              </button>
                              <button onClick={() => clearCustomer(draft.tempId)} className="p-1 hover:bg-red-900/20 rounded text-slate-500 hover:text-red-500" title="Wissen">
                                <X size={12}/>
                              </button>
                           </div>
                        </div>
                      )}
                    </div>

                    {/* Col 2: Party Size */}
                    <div className="md:col-span-1">
                      <input 
                        type="number" min="1" 
                        value={draft.partySize} 
                        onChange={(e: any) => updateDraft(draft.tempId, 'partySize', parseInt(e.target.value))}
                        className="w-full h-9 text-center font-bold bg-black border border-slate-700 rounded text-sm text-white focus:border-amber-500 outline-none"
                      />
                    </div>

                    {/* Col 3: Package */}
                    <div className="md:col-span-2">
                       <select 
                          className="w-full h-9 bg-black border border-slate-700 rounded px-2 text-xs text-white focus:border-amber-500 outline-none"
                          value={draft.packageType}
                          onChange={(e) => updateDraft(draft.tempId, 'packageType', e.target.value)}
                       >
                          <option value="standard">Standard (€{pricing.standard})</option>
                          <option value="premium">Premium (€{pricing.premium})</option>
                       </select>
                    </div>

                    {/* Col 4: Extras Button */}
                    <div className="md:col-span-3">
                       <button 
                         onClick={() => setActiveModal({ type: 'EXTRAS', draftId: draft.tempId })}
                         className={`w-full h-9 rounded border text-xs font-bold flex items-center justify-between px-3 transition-colors ${
                           hasExtras
                             ? 'bg-blue-900/20 border-blue-500/50 text-blue-300 hover:bg-blue-900/30' 
                             : 'bg-black border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500'
                         }`}
                       >
                         <div className="flex items-center space-x-2">
                           {draft.merchandise.length > 0 && <span className="flex items-center"><ShoppingBag size={12} className="mr-1"/> {draft.merchandise.reduce((s,i)=>s+i.quantity,0)}</span>}
                           {draft.dietary && <span className="flex items-center"><Utensils size={12} className="mr-1"/> Dieet</span>}
                           {!hasExtras && <span>Extra's & Dieet</span>}
                         </div>
                         <Edit3 size={12} className="opacity-50" />
                       </button>
                    </div>

                    {/* Col 5: Total & Actions */}
                    <div className="md:col-span-2 flex justify-end items-center space-x-3 pl-2">
                       <span className="font-mono font-bold text-white text-sm">€{calculateRowTotal(draft).toFixed(0)}</span>
                       <div className="flex space-x-1">
                         <button onClick={() => duplicateDraft(draft)} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title="Dupliceer"><Copy size={14}/></button>
                         <button onClick={() => removeDraft(draft.tempId)} className="p-1.5 hover:bg-red-900/20 rounded text-slate-400 hover:text-red-500" title="Verwijder"><Trash2 size={14}/></button>
                       </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>

          <button 
            onClick={addEmptyRow}
            className="w-full py-3 mt-4 border border-dashed border-slate-800 rounded-lg text-slate-500 hover:text-white hover:border-slate-600 hover:bg-slate-900 transition-all flex items-center justify-center font-bold text-xs uppercase tracking-widest"
          >
            <Plus size={16} className="mr-2" /> Nieuwe Regel
          </button>
        </div>
      </div>

      {/* 3. MODALS (Same as before but activeDraft check safety) */}
      
      {activeModal?.type === 'EXTRAS' && activeDraft && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex items-center justify-center p-4">
           <Card className="w-full max-w-5xl bg-slate-900 border-slate-800 shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950 rounded-t-xl">
                 <div>
                   <h3 className="text-xl font-bold text-white">Details & Merchandise</h3>
                   <p className="text-slate-500 text-sm">Voor: {activeDraft.companyName || `${activeDraft.firstName} ${activeDraft.lastName}`}</p>
                 </div>
                 <button onClick={() => setActiveModal(null)} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                   <X size={20} />
                 </button>
              </div>
              
              <div className="flex-grow overflow-hidden grid grid-cols-1 lg:grid-cols-2">
                 {/* Left: Notes & Dietary */}
                 <div className="p-6 space-y-6 border-r border-slate-800 overflow-y-auto custom-scrollbar">
                    <div>
                      <label className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2 flex items-center"><Utensils size={14} className="mr-2"/> Dieetwensen</label>
                      <textarea 
                        className="w-full h-32 bg-black/40 border border-slate-700 rounded-xl p-4 text-white text-sm focus:border-amber-500 outline-none resize-none placeholder:text-slate-600"
                        placeholder="Bijv. 1x Notenallergie, 2x Vegetarisch..."
                        value={activeDraft.dietary}
                        onChange={(e) => updateDraft(activeDraft.tempId, 'dietary', e.target.value)}
                      />
                    </div>

                    <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
                       <label className="flex items-center space-x-3 cursor-pointer">
                         <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${activeDraft.isCelebrating ? 'bg-purple-500 border-purple-500' : 'border-slate-600 bg-slate-900'}`}>
                            {activeDraft.isCelebrating && <Check size={14} className="text-white"/>}
                         </div>
                         <input 
                           type="checkbox" 
                           className="hidden"
                           checked={activeDraft.isCelebrating}
                           onChange={(e) => updateDraft(activeDraft.tempId, 'isCelebrating', e.target.checked)}
                         />
                         <span className="font-bold text-white text-sm flex items-center"><PartyPopper size={16} className="mr-2 text-purple-500"/> Iets te vieren?</span>
                       </label>
                       {activeDraft.isCelebrating && (
                         <Input 
                           placeholder="Reden (bijv. 50 jaar getrouwd)" 
                           value={activeDraft.celebrationText} 
                           onChange={(e: any) => updateDraft(activeDraft.tempId, 'celebrationText', e.target.value)}
                           className="h-10 text-sm bg-black/40 border-slate-700"
                         />
                       )}
                    </div>
                 </div>

                 {/* Right: Merchandise Picker */}
                 <div className="p-6 bg-slate-950/50 flex flex-col h-full overflow-hidden">
                    <div className="mb-4 flex items-center justify-between">
                       <label className="text-xs font-bold text-blue-500 uppercase tracking-widest flex items-center"><ShoppingBag size={14} className="mr-2"/> Merchandise</label>
                       <span className="text-xs text-slate-500">{activeDraft.merchandise.reduce((s,i)=>s+i.quantity,0)} items</span>
                    </div>
                    
                    <div className="flex-grow overflow-y-auto custom-scrollbar pr-2">
                       <MerchandisePicker 
                         selections={activeDraft.merchandise}
                         totalGuests={activeDraft.partySize}
                         onUpdate={(id, delta) => {
                            const current = activeDraft.merchandise.find(m => m.id === id)?.quantity || 0;
                            const newQty = Math.max(0, current + delta);
                            const newMerch = activeDraft.merchandise.filter(m => m.id !== id);
                            if (newQty > 0) newMerch.push({ id, quantity: newQty });
                            updateDraft(activeDraft.tempId, 'merchandise', newMerch);
                         }}
                         onSet={(id, qty) => {
                            const newMerch = activeDraft.merchandise.filter(m => m.id !== id);
                            if (qty > 0) newMerch.push({ id, quantity: qty });
                            updateDraft(activeDraft.tempId, 'merchandise', newMerch);
                         }}
                       />
                    </div>
                 </div>
              </div>

              <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end rounded-b-xl">
                 <Button onClick={() => setActiveModal(null)} className="bg-emerald-600 hover:bg-emerald-700 h-10 px-8">
                   Gereed
                 </Button>
              </div>
           </Card>
        </div>
      )}

      {activeModal?.type === 'ADDRESS' && activeDraft && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex items-center justify-center p-4">
           <Card className="w-full max-w-lg bg-slate-900 border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950 rounded-t-xl">
                 <h3 className="text-lg font-bold text-white">Klantgegevens Bewerken</h3>
                 <button onClick={() => setActiveModal(null)} className="text-slate-500 hover:text-white"><X size={20}/></button>
              </div>
              
              <div className="p-6 space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <Input label="Voornaam" value={activeDraft.firstName} onChange={(e: any) => updateDraft(activeDraft.tempId, 'firstName', e.target.value)} />
                    <Input label="Achternaam" value={activeDraft.lastName} onChange={(e: any) => updateDraft(activeDraft.tempId, 'lastName', e.target.value)} />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <Input label="Email" value={activeDraft.email} onChange={(e: any) => updateDraft(activeDraft.tempId, 'email', e.target.value)} />
                    <Input label="Telefoon" value={activeDraft.phone} onChange={(e: any) => updateDraft(activeDraft.tempId, 'phone', e.target.value)} />
                 </div>
                 
                 <div className="pt-2 border-t border-slate-800">
                    <Input label="Bedrijfsnaam" value={activeDraft.companyName} onChange={(e: any) => updateDraft(activeDraft.tempId, 'companyName', e.target.value)} placeholder="Optioneel" />
                 </div>

                 <div className="pt-2 border-t border-slate-800 grid grid-cols-4 gap-4">
                    <div className="col-span-3">
                       <Input label="Straat" value={activeDraft.street} onChange={(e: any) => updateDraft(activeDraft.tempId, 'street', e.target.value)} />
                    </div>
                    <div className="col-span-1">
                       <Input label="Nr" value={activeDraft.houseNumber} onChange={(e: any) => updateDraft(activeDraft.tempId, 'houseNumber', e.target.value)} />
                    </div>
                    <div className="col-span-1">
                       <Input label="Postcode" value={activeDraft.zip} onChange={(e: any) => updateDraft(activeDraft.tempId, 'zip', e.target.value)} />
                    </div>
                    <div className="col-span-3">
                       <Input label="Plaats" value={activeDraft.city} onChange={(e: any) => updateDraft(activeDraft.tempId, 'city', e.target.value)} />
                    </div>
                 </div>
              </div>

              <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end rounded-b-xl">
                 <Button onClick={() => setActiveModal(null)} className="bg-emerald-600 hover:bg-emerald-700">Opslaan</Button>
              </div>
           </Card>
        </div>
      )}

    </div>
  );
};
