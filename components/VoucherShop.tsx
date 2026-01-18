
import React, { useState, useEffect } from 'react';
import { 
  Gift, ShoppingBag, ArrowRight, CheckCircle2, Star, 
  Sparkles, Heart, Mail, Printer, CreditCard, ChevronRight, User, FileText,
  MapPin, Phone, Truck, Box, Loader2, Lock, FileCheck, Ticket, DollarSign
} from 'lucide-react';
import { Button, Card, Input } from './UI';
import { settingsRepo, voucherOrderRepo, notificationsRepo, invoiceRepo } from '../utils/storage';
import { VoucherSaleConfig, VoucherOrder, VoucherOrderItem } from '../types';
import { triggerEmail } from '../utils/emailEngine';
import { VoucherCardPreview } from './VoucherCardPreview';
import { calculateVoucherTotal, VOUCHER_SHIPPING_FEE } from '../utils/pricing';
import { createInvoiceFromVoucherOrder } from '../utils/invoiceLogic';
import { logAuditAction } from '../utils/auditLogger';

// --- Compact Product Detail Card ---
const ProductDetailCard = ({ title, price, description }: any) => (
  <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-5 flex items-start space-x-4 animate-in fade-in slide-in-from-top-2">
    <div className="p-3 bg-amber-500/10 rounded-lg text-amber-500 shrink-0">
      <Star size={24} fill="currentColor" className="text-amber-500" />
    </div>
    <div className="flex-grow">
      <div className="flex justify-between items-start">
        <h4 className="font-bold text-white text-lg">{title}</h4>
        <p className="font-serif text-amber-500 text-xl font-bold whitespace-nowrap">€{price.toFixed(2)}</p>
      </div>
      <p className="text-sm text-slate-400 mt-1 leading-relaxed">{description}</p>
    </div>
  </div>
);

export const VoucherShop = () => {
  const [config, setConfig] = useState<VoucherSaleConfig | null>(null);
  const [step, setStep] = useState<'SHOP' | 'SUCCESS'>('SHOP');
  
  // Tab State: 'AMOUNT' (Vrij Bedrag) or 'PRODUCT' (Arrangement)
  const [shopMode, setShopMode] = useState<'AMOUNT' | 'PRODUCT'>('AMOUNT');

  // Selection State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [customAmount, setCustomAmount] = useState<number | ''>(50);
  
  // Form State
  const [formData, setFormData] = useState({
    recipientName: '',
    message: '',
    deliveryMethod: 'DIGITAL' as 'DIGITAL' | 'PICKUP' | 'POST',
    // Detailed Billing Info
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    street: '',
    houseNumber: '',
    zip: '',
    city: ''
  });

  const [isProcessing, setIsProcessing] = useState(false);

  // --- 1. LOAD & SYNC DATA ---
  useEffect(() => {
    const loadConfig = () => {
        const loaded = settingsRepo.getVoucherSaleConfig();
        setConfig(loaded);
        
        // Intelligent Default Mode (only on first load if not set)
        // logic moved to manual switches to persist user choice during re-renders if needed
    };

    loadConfig();
    
    // LISTEN FOR UPDATES (Fixes Pricing Sync Bug)
    window.addEventListener('storage-update', loadConfig);
    return () => window.removeEventListener('storage-update', loadConfig);
  }, []); 

  // --- 2. CALCULATE TOTALS ---
  let baseAmount = 0;
  let selectedLabel = '';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let selectedDescription = '';

  if (shopMode === 'AMOUNT') {
      baseAmount = typeof customAmount === 'number' ? customAmount : 0;
      selectedLabel = 'Vrij Bedrag';
      selectedDescription = 'Een bedrag naar keuze, vrij te besteden.';
  } else if (config && selectedProductId) {
      const prod = config.products.find(p => p.id === selectedProductId);
      if (prod) {
          baseAmount = prod.price;
          selectedLabel = prod.label;
          selectedDescription = prod.description;
      }
  }

  const { subtotal, shipping, total } = calculateVoucherTotal(baseAmount, formData.deliveryMethod);

  // --- ACTIONS ---

  const processOrder = async () => {
    if (shopMode === 'AMOUNT') {
        if (baseAmount < (config?.freeAmount.min || 50)) {
            alert(`Het minimale bedrag is €${config?.freeAmount.min || 50}.`);
            return;
        }
        if (baseAmount > (config?.freeAmount.max || 1000)) {
            alert(`Het maximale bedrag is €${config?.freeAmount.max}.`);
            return;
        }
    } else {
        if (!selectedProductId) {
            alert("Selecteer een arrangement.");
            return;
        }
    }

    // Validate Required Fields
    const { firstName, lastName, email, phone, street, houseNumber, zip, city, recipientName } = formData;
    
    if (!firstName || !lastName || !email || !phone || !recipientName) {
      alert("Vul alstublieft alle verplichte velden in.");
      return;
    }

    if (!street || !houseNumber || !zip || !city) {
      alert("Adresgegevens zijn verplicht voor de factuur.");
      return;
    }

    setIsProcessing(true);
    
    // Simulate API Processing
    await new Promise(r => setTimeout(r, 1500));

    const orderId = `ORD-${Date.now()}`;
    const items: VoucherOrderItem[] = [{
      id: shopMode === 'AMOUNT' ? 'CUSTOM' : selectedProductId,
      label: selectedLabel,
      price: baseAmount,
      quantity: 1
    }];

    const newOrder: VoucherOrder = {
      id: orderId,
      createdAt: new Date().toISOString(),
      status: 'INVOICED', 
      buyer: { firstName: formData.firstName, lastName: formData.lastName },
      items,
      amount: baseAmount,
      totals: { subtotal: baseAmount, shipping, fee: 0, grandTotal: total },
      deliveryMethod: formData.deliveryMethod,
      recipient: { 
        name: formData.recipientName,
        address: { street: `${formData.street} ${formData.houseNumber}`, city: formData.city, zip: formData.zip } 
      },
      issuanceMode: 'INDIVIDUAL',
      customerEmail: formData.email,
      generatedCodes: [] 
    };

    voucherOrderRepo.add(newOrder);
    
    const invoice = createInvoiceFromVoucherOrder(newOrder);
    invoiceRepo.add(invoice);
    logAuditAction('CREATE_INVOICE', 'SYSTEM', invoice.id, { description: `Auto-generated for Voucher Order ${orderId}` });

    triggerEmail('VOUCHER_ORDER_REQUEST_RECEIVED', { type: 'VOUCHER_ORDER', id: orderId, data: newOrder });
    notificationsRepo.createFromEvent('NEW_VOUCHER_ORDER', newOrder);

    setStep('SUCCESS');
    setIsProcessing(false);
  };

  if (!config || !config.isEnabled) return null; 

  if (step === 'SUCCESS') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 pointer-events-none" />
        
        <Card className="text-center max-w-lg w-full p-10 bg-slate-900/80 backdrop-blur-xl border-amber-500/30 shadow-2xl relative z-10 animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-700">
            <Mail size={40} className="text-amber-500" />
          </div>
          <h2 className="text-3xl font-serif text-white mb-4">Bestelling Geplaatst</h2>
          
          <div className="bg-blue-900/10 border border-blue-900/30 p-6 rounded-xl mb-8 text-left">
             <h4 className="text-blue-400 font-bold mb-2 flex items-center">
                <FileCheck size={18} className="mr-2" /> Factuur Verzonden
             </h4>
             <p className="text-slate-300 text-sm leading-relaxed">
                We hebben de factuur naar <strong>{formData.email}</strong> gestuurd. 
                Gelieve deze per bankoverschrijving te voldoen.
             </p>
             <p className="text-slate-400 text-xs mt-3 italic">
                Zodra wij de betaling hebben verwerkt, ontvangt u de voucher(s) direct per e-mail.
             </p>
          </div>
          
          <div className="space-y-3">
            <Button onClick={() => window.location.reload()} variant="secondary" className="w-full">
                Terug naar Shop
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-200 selection:bg-amber-900 selection:text-white">
      
      {/* 1. Hero Section */}
      <div className="relative py-24 md:py-32 overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-black to-black" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
            <img 
              src="https://irp.cdn-website.com/e8046ea7/dms3rep/multi/logo-ip.png" 
              alt="Inspiration Point Logo" 
              className="h-24 md:h-32 mx-auto drop-shadow-[0_0_25px_rgba(245,158,11,0.3)] opacity-90"
            />
          </div>
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold uppercase tracking-widest mb-6 backdrop-blur-md shadow-lg">
            <Sparkles size={14} /> <span>The Gift of Wonder</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-serif text-white leading-tight mb-6">
            Geef een avond <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600">vol verwondering</span> cadeau.
          </h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24">
          
          {/* LEFT COLUMN: Configuration */}
          <div className="lg:col-span-7 space-y-12">
            
            {/* Step 1: Choose Product */}
            <section className="space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold font-serif border border-slate-700">1</div>
                <h3 className="text-xl font-serif text-white">Kies uw ervaring</h3>
              </div>
              
              {/* Type Switcher Tabs */}
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 mb-6">
                 {config.freeAmount.enabled && (
                     <button 
                        onClick={() => setShopMode('AMOUNT')}
                        className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center ${shopMode === 'AMOUNT' ? 'bg-amber-500 text-black shadow-lg' : 'text-slate-400 hover:text-white'}`}
                     >
                        <CreditCard size={16} className="mr-2"/> Vrij Bedrag
                     </button>
                 )}
                 {config.products.length > 0 && (
                     <button 
                        onClick={() => setShopMode('PRODUCT')}
                        className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center ${shopMode === 'PRODUCT' ? 'bg-amber-500 text-black shadow-lg' : 'text-slate-400 hover:text-white'}`}
                     >
                        <Ticket size={16} className="mr-2"/> Arrangement
                     </button>
                 )}
              </div>

              {/* DYNAMIC CONTENT AREA */}
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {shopMode === 'AMOUNT' && (
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                        <div>
                           <h3 className="text-lg font-bold text-white mb-1">Bepaal de waarde</h3>
                           <p className="text-slate-400 text-sm">Kies een vast bedrag of vul zelf een waarde in.</p>
                        </div>

                        {/* Presets */}
                        <div className="grid grid-cols-3 gap-3">
                           {[50, 75, 100, 150, 200, 250].map(val => (
                              <button
                                key={val}
                                onClick={() => setCustomAmount(val)}
                                className={`py-3 rounded-xl border font-bold text-sm transition-all ${customAmount === val ? 'bg-amber-500 text-black border-amber-500' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'}`}
                              >
                                €{val}
                              </button>
                           ))}
                        </div>

                        {/* Custom Input */}
                        <div className="relative group">
                           <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-amber-500 transition-colors">
                             <DollarSign size={20} />
                           </div>
                           <input 
                             type="number"
                             className="w-full bg-black/50 border border-slate-700 rounded-xl py-4 pl-12 pr-4 text-white text-xl font-bold focus:border-amber-500 outline-none transition-all placeholder:text-slate-700"
                             placeholder="Ander bedrag..."
                             value={customAmount || ''}
                             onChange={(e) => {
                                 const val = e.target.value;
                                 setCustomAmount(val === '' ? '' : parseFloat(val));
                             }}
                             min={config.freeAmount.min}
                             max={config.freeAmount.max}
                           />
                           <div className="text-right mt-2 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                              Min: €{config.freeAmount.min} - Max: €{config.freeAmount.max}
                           </div>
                        </div>
                      </div>
                  )}

                  {shopMode === 'PRODUCT' && (
                      <div className="space-y-6">
                          {/* 1. The Dropdown Selector */}
                          <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block pl-1">Beschikbare Arrangementen</label>
                              <div className="relative">
                                  <select 
                                    value={selectedProductId}
                                    onChange={(e) => setSelectedProductId(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 text-white appearance-none outline-none focus:border-amber-500 transition-colors text-lg cursor-pointer hover:border-slate-500"
                                  >
                                      <option value="" disabled>Selecteer een arrangement...</option>
                                      {config.products.filter(p => p.active).map(p => (
                                          <option key={p.id} value={p.id}>
                                              {p.label} - €{p.price.toFixed(2)}
                                          </option>
                                      ))}
                                  </select>
                                  <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none rotate-90" />
                              </div>
                          </div>

                          {/* 2. The Detail Card (Only shows if selected) */}
                          {selectedProductId && config.products.find(p => p.id === selectedProductId) && (
                              <ProductDetailCard 
                                key={selectedProductId}
                                title={config.products.find(p => p.id === selectedProductId)!.label}
                                description={config.products.find(p => p.id === selectedProductId)!.description}
                                price={config.products.find(p => p.id === selectedProductId)!.price}
                              />
                          )}
                      </div>
                  )}
              </div>
            </section>

            {/* Step 2: Recipient */}
            <section className="space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold font-serif border border-slate-700">2</div>
                <h3 className="text-xl font-serif text-white">Voor wie is het?</h3>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <Input 
                  label="Naam Ontvanger" 
                  placeholder="Wie ga je verrassen?" 
                  value={formData.recipientName}
                  onChange={(e: any) => setFormData({...formData, recipientName: e.target.value})}
                  icon={<User size={16}/>}
                />
                <div>
                  <label className="text-xs font-bold text-amber-500/80 uppercase tracking-widest cursor-pointer font-serif mb-2 block">Persoonlijke Boodschap</label>
                  <textarea 
                    className="w-full bg-black/40 border border-slate-800 rounded-xl p-4 text-white placeholder:text-slate-600 focus:border-amber-500 outline-none min-h-[100px] resize-none transition-colors"
                    placeholder="Schrijf hier uw wens..."
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                    maxLength={150}
                  />
                  <div className="text-right text-[10px] text-slate-500 mt-1">{formData.message.length}/150</div>
                </div>
              </div>
            </section>

            {/* Step 3: Billing & Buyer Details */}
            <section className="space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold font-serif border border-slate-700">3</div>
                <h3 className="text-xl font-serif text-white">Uw Gegevens</h3>
              </div>

              <div className="p-6 bg-slate-900/50 rounded-xl border border-slate-800/50 space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <Input 
                      label="Voornaam *" 
                      value={formData.firstName}
                      onChange={(e: any) => setFormData({...formData, firstName: e.target.value})}
                    />
                    <Input 
                      label="Achternaam *" 
                      value={formData.lastName}
                      onChange={(e: any) => setFormData({...formData, lastName: e.target.value})}
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <Input 
                      label="E-mailadres *" 
                      type="email"
                      value={formData.email}
                      onChange={(e: any) => setFormData({...formData, email: e.target.value})}
                    />
                    <Input 
                      label="Telefoonnummer *" 
                      type="tel"
                      value={formData.phone}
                      onChange={(e: any) => setFormData({...formData, phone: e.target.value})}
                    />
                 </div>
                 
                 <div className="pt-4 border-t border-slate-800">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Adres (voor factuur)</label>
                    <div className="grid grid-cols-4 gap-4">
                        <div className="col-span-3">
                           <Input label="Straat" value={formData.street} onChange={(e: any) => setFormData({...formData, street: e.target.value})} />
                        </div>
                        <div className="col-span-1">
                           <Input label="Nr" value={formData.houseNumber} onChange={(e: any) => setFormData({...formData, houseNumber: e.target.value})} />
                        </div>
                        <div className="col-span-1">
                           <Input label="Postcode" value={formData.zip} onChange={(e: any) => setFormData({...formData, zip: e.target.value})} />
                        </div>
                        <div className="col-span-3">
                           <Input label="Plaats" value={formData.city} onChange={(e: any) => setFormData({...formData, city: e.target.value})} />
                        </div>
                    </div>
                 </div>
              </div>
            </section>

            {/* Step 4: Delivery Method */}
            <section className="space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold font-serif border border-slate-700">4</div>
                <h3 className="text-xl font-serif text-white">Verzending</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <button 
                   onClick={() => setFormData({...formData, deliveryMethod: 'DIGITAL'})}
                   className={`p-4 rounded-xl border text-left transition-all ${formData.deliveryMethod === 'DIGITAL' ? 'bg-amber-900/20 border-amber-500 ring-1 ring-amber-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
                 >
                   <div className="flex items-center space-x-2 mb-2">
                     <Mail size={18} className={formData.deliveryMethod === 'DIGITAL' ? 'text-amber-500' : 'text-slate-400'} />
                     <span className="font-bold text-white text-sm">Digitaal</span>
                   </div>
                   <p className="text-xs text-slate-400 mb-2">Per e-mail na betaling.</p>
                   <span className="text-[10px] font-bold text-emerald-500 bg-emerald-900/20 px-2 py-1 rounded">Gratis</span>
                 </button>

                 {config.delivery.pickup.enabled && (
                     <button 
                       onClick={() => setFormData({...formData, deliveryMethod: 'PICKUP'})}
                       className={`p-4 rounded-xl border text-left transition-all ${formData.deliveryMethod === 'PICKUP' ? 'bg-amber-900/20 border-amber-500 ring-1 ring-amber-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
                     >
                       <div className="flex items-center space-x-2 mb-2">
                         <ShoppingBag size={18} className={formData.deliveryMethod === 'PICKUP' ? 'text-amber-500' : 'text-slate-400'} />
                         <span className="font-bold text-white text-sm">Ophalen</span>
                       </div>
                       <p className="text-xs text-slate-400 mb-2">Bij de kassa (tijdens shows).</p>
                       <span className="text-[10px] font-bold text-emerald-500 bg-emerald-900/20 px-2 py-1 rounded">Gratis</span>
                     </button>
                 )}

                 {config.delivery.shipping.enabled && (
                     <button 
                       onClick={() => setFormData({...formData, deliveryMethod: 'POST'})}
                       className={`p-4 rounded-xl border text-left transition-all ${formData.deliveryMethod === 'POST' ? 'bg-amber-900/20 border-amber-500 ring-1 ring-amber-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
                     >
                       <div className="flex items-center space-x-2 mb-2">
                         <Truck size={18} className={formData.deliveryMethod === 'POST' ? 'text-amber-500' : 'text-slate-400'} />
                         <span className="font-bold text-white text-sm">Per Post</span>
                       </div>
                       <p className="text-xs text-slate-400 mb-2">Luxe verpakking, verzonden.</p>
                       <span className="text-[10px] font-bold text-amber-500 bg-amber-900/20 px-2 py-1 rounded">+ €{config.delivery.shipping.fee.toFixed(2)}</span>
                     </button>
                 )}
              </div>
              
              {formData.deliveryMethod === 'POST' && (
                  <div className="p-4 bg-blue-900/10 border border-blue-900/30 rounded-xl text-xs text-blue-300 flex items-start">
                      <Box size={16} className="mr-2 mt-0.5 shrink-0" />
                      We verzenden de voucher na betaling naar het opgegeven adres ({formData.street} {formData.houseNumber}, {formData.city}).
                  </div>
              )}
            </section>

          </div>

          {/* RIGHT COLUMN: Live Preview & Action (Sticky) */}
          <div className="lg:col-span-5">
            <div className="sticky top-8 space-y-8">
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Live Voorbeeld</h4>
                  <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-1 rounded border border-amber-500/20 font-bold uppercase">Gold Edition</span>
                </div>
                
                {/* THE CARD */}
                <VoucherCardPreview 
                  amount={baseAmount}
                  recipientName={formData.recipientName}
                  senderName={`${formData.firstName} ${formData.lastName}`}
                  message={formData.message}
                />
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
                 <div className="space-y-2 mb-6 pb-6 border-b border-slate-800">
                    <div className="flex justify-between text-sm text-slate-300">
                       <span>Voucher Waarde</span>
                       <span>€{baseAmount.toFixed(2)}</span>
                    </div>
                    {shipping > 0 && (
                        <div className="flex justify-between text-sm text-slate-300">
                           <span>Verzendkosten</span>
                           <span>€{shipping.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-end pt-2">
                        <p className="text-sm text-slate-400">Totaal (Incl. BTW)</p>
                        <div className="text-4xl font-serif text-white">€{total.toFixed(2)}</div>
                    </div>
                 </div>

                 <Button 
                   onClick={processOrder}
                   disabled={isProcessing}
                   className="w-full h-14 text-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black border-none shadow-[0_0_20px_rgba(245,158,11,0.3)] font-bold tracking-wide"
                 >
                   {isProcessing ? <Loader2 className="animate-spin" /> : <>Bestellen & Factuur <ArrowRight className="ml-2" /></>}
                 </Button>
                 
                 <p className="text-center text-[10px] text-slate-500 mt-3">
                    U ontvangt de factuur per e-mail. Na betaling wordt de voucher direct verstuurd.
                 </p>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
