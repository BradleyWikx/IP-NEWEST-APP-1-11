
import React, { useState, useEffect } from 'react';
import { 
  Gift, ShoppingBag, ArrowRight, CheckCircle2, Star, 
  Sparkles, Heart, Mail, Printer, CreditCard, ChevronRight, User, FileText,
  MapPin, Phone, Truck, Box
} from 'lucide-react';
import { Button, Card, Input } from './UI';
import { settingsRepo, voucherOrderRepo, notificationsRepo } from '../utils/storage';
import { VoucherSaleConfig, VoucherOrder, VoucherOrderItem } from '../types';
import { triggerEmail } from '../utils/emailEngine';
import { VoucherCardPreview } from './VoucherCardPreview';
import { calculateVoucherTotal, VOUCHER_SHIPPING_FEE } from '../utils/pricing';

// --- Experience Card Component ---
const ExperienceCard = ({ 
  title, 
  price, 
  description, 
  isSelected, 
  onSelect,
  customAmount,
  onCustomAmountChange,
  isCustom = false
}: any) => (
  <div 
    onClick={onSelect}
    className={`
      relative p-6 rounded-2xl border transition-all duration-300 cursor-pointer group flex flex-col h-full
      ${isSelected 
        ? 'bg-slate-900 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.15)] scale-[1.02]' 
        : 'bg-slate-900/40 border-slate-800 hover:border-slate-600 hover:bg-slate-900/60'}
    `}
  >
    {isSelected && (
      <div className="absolute top-3 right-3 text-amber-500 animate-in fade-in zoom-in">
        <CheckCircle2 size={20} fill="currentColor" className="text-black" />
      </div>
    )}
    
    <div className={`p-3 rounded-xl w-fit mb-4 transition-colors ${isSelected ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-400 group-hover:text-white'}`}>
      {isCustom ? <CreditCard size={24} /> : <Star size={24} />}
    </div>

    <h3 className={`text-lg font-bold mb-2 ${isSelected ? 'text-white' : 'text-slate-200'}`}>{title}</h3>
    <p className="text-xs text-slate-400 mb-6 leading-relaxed flex-grow">{description}</p>

    <div className="mt-auto">
      {isCustom ? (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">€</span>
          <input 
            type="number" 
            min="10" 
            max="500"
            value={customAmount || ''}
            onChange={(e) => onCustomAmountChange(parseInt(e.target.value) || 0)}
            placeholder="50"
            className={`
              w-full bg-black border rounded-xl py-2 pl-8 pr-4 text-white font-mono font-bold focus:outline-none focus:border-amber-500 transition-all
              ${isSelected ? 'border-amber-500/50' : 'border-slate-700'}
            `}
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      ) : (
        <p className={`text-xl font-serif font-bold ${isSelected ? 'text-amber-500' : 'text-white'}`}>
          €{price}
        </p>
      )}
    </div>
  </div>
);

export const VoucherShop = () => {
  const [config, setConfig] = useState<VoucherSaleConfig | null>(null);
  const [step, setStep] = useState<'SHOP' | 'SUCCESS'>('SHOP');
  
  // Selection State
  const [selectedType, setSelectedType] = useState<'CUSTOM' | 'DINER' | 'DUO'>('DINER');
  const [customAmount, setCustomAmount] = useState<number>(50);
  
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

  useEffect(() => {
    setConfig(settingsRepo.getVoucherSaleConfig());
  }, []);

  // Calculate current total based on selection
  const baseAmount = selectedType === 'CUSTOM' ? customAmount : (selectedType === 'DINER' ? 75 : 150);
  const { subtotal, shipping, total } = calculateVoucherTotal(baseAmount, formData.deliveryMethod);

  const handleCheckout = async () => {
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
    
    // Simulate API
    await new Promise(r => setTimeout(r, 1500));

    const orderId = `ORD-${Date.now()}`;
    const items: VoucherOrderItem[] = [{
      id: selectedType,
      label: selectedType === 'CUSTOM' ? 'Vrij Bedrag' : (selectedType === 'DINER' ? 'Diner Arrangement' : 'Romantisch Duo'),
      price: baseAmount,
      quantity: 1
    }];

    // If shipping cost exists, add as separate item for clarity in order, but logically part of totals
    // (Storage logic handles totals separately, but let's keep items clean)

    const newOrder: VoucherOrder = {
      id: orderId,
      createdAt: new Date().toISOString(),
      status: 'REQUESTED',
      buyer: { firstName, lastName },
      items,
      amount: baseAmount,
      totals: { subtotal: baseAmount, shipping, fee: 0, grandTotal: total },
      deliveryMethod: formData.deliveryMethod,
      recipient: { 
        name: recipientName,
        // Store address in recipient details for shipping reference (even if same as billing)
        address: { street: `${street} ${houseNumber}`, city, zip } 
      },
      issuanceMode: 'INDIVIDUAL',
      customerEmail: email
    };

    voucherOrderRepo.add(newOrder);
    triggerEmail('VOUCHER_ORDER_REQUEST_RECEIVED', { type: 'VOUCHER_ORDER', id: orderId, data: newOrder });
    notificationsRepo.createFromEvent('NEW_VOUCHER_ORDER', newOrder);

    setStep('SUCCESS');
    setIsProcessing(false);
  };

  if (!config || !config.isEnabled) return null; // Or Loading

  if (step === 'SUCCESS') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <Card className="text-center max-w-lg w-full p-10 bg-slate-900/80 backdrop-blur-xl border-amber-500/30 shadow-2xl relative z-10 animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/20">
            <CheckCircle2 size={40} className="text-black" strokeWidth={3} />
          </div>
          <h2 className="text-4xl font-serif text-white mb-2">Aanvraag Ontvangen!</h2>
          <p className="text-slate-300 mb-8 text-lg">
            Bedankt voor uw bestelling. We sturen u <strong>binnen 3 werkdagen</strong> de factuur per e-mail.<br/><br/>
            <span className="text-sm text-slate-400">Na ontvangst van de betaling wordt de voucher direct verzonden.</span>
          </p>
          <Button onClick={() => window.location.reload()} variant="secondary" className="w-full">
            Nog een cadeau bestellen
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-200 selection:bg-amber-900 selection:text-white">
      
      {/* 1. Hero Section */}
      <div className="relative py-24 md:py-32 overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-black to-black" />
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-amber-600/10 rounded-full blur-[100px] pointer-events-none" />
        
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
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ExperienceCard 
                  title="Vrij Bedrag" 
                  description="Bepaal zelf de waarde (min. €10)." 
                  isCustom 
                  isSelected={selectedType === 'CUSTOM'}
                  onSelect={() => setSelectedType('CUSTOM')}
                  customAmount={customAmount}
                  onCustomAmountChange={setCustomAmount}
                />
                <ExperienceCard 
                  title="Diner Arrangement" 
                  description="Show + 3-gangen diner voor 1 persoon."
                  price={75}
                  isSelected={selectedType === 'DINER'}
                  onSelect={() => setSelectedType('DINER')}
                />
                <ExperienceCard 
                  title="Romantisch Duo" 
                  description="Compleet avondje uit voor twee personen."
                  price={150}
                  isSelected={selectedType === 'DUO'}
                  onSelect={() => setSelectedType('DUO')}
                />
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
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Adres (Factuur)</label>
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
                   <p className="text-xs text-slate-400 mb-2">Direct per e-mail naar u.</p>
                   <span className="text-[10px] font-bold text-emerald-500 bg-emerald-900/20 px-2 py-1 rounded">Gratis</span>
                 </button>

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

                 <button 
                   onClick={() => setFormData({...formData, deliveryMethod: 'POST'})}
                   className={`p-4 rounded-xl border text-left transition-all ${formData.deliveryMethod === 'POST' ? 'bg-amber-900/20 border-amber-500 ring-1 ring-amber-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
                 >
                   <div className="flex items-center space-x-2 mb-2">
                     <Truck size={18} className={formData.deliveryMethod === 'POST' ? 'text-amber-500' : 'text-slate-400'} />
                     <span className="font-bold text-white text-sm">Per Post</span>
                   </div>
                   <p className="text-xs text-slate-400 mb-2">Luxe verpakking, verzonden.</p>
                   <span className="text-[10px] font-bold text-amber-500 bg-amber-900/20 px-2 py-1 rounded">+ €{VOUCHER_SHIPPING_FEE.toFixed(2)}</span>
                 </button>
              </div>
              
              {formData.deliveryMethod === 'POST' && (
                  <div className="p-4 bg-blue-900/10 border border-blue-900/30 rounded-xl text-xs text-blue-300 flex items-start">
                      <Box size={16} className="mr-2 mt-0.5 shrink-0" />
                      We verzenden de voucher naar het opgegeven adres ({formData.street} {formData.houseNumber}, {formData.city}).
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
                        <p className="text-sm text-slate-400">Totaal te betalen</p>
                        <div className="text-4xl font-serif text-white">€{total.toFixed(2)}</div>
                    </div>
                 </div>

                 <Button 
                   onClick={handleCheckout}
                   disabled={isProcessing}
                   className="w-full h-14 text-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black border-none shadow-[0_0_20px_rgba(245,158,11,0.3)] font-bold tracking-wide"
                 >
                   {isProcessing ? 'Verwerken...' : 'Bestelling Plaatsen'} <ArrowRight className="ml-2" />
                 </Button>
                 
                 <div className="mt-4 text-center space-y-2">
                   <p className="text-[10px] text-slate-400">
                     <span className="text-amber-500 font-bold flex items-center justify-center mb-1"><FileText size={12} className="mr-1"/> Op Factuur</span>
                     U ontvangt <strong>binnen 3 dagen</strong> de factuur per mail.
                   </p>
                   <p className="text-[10px] text-slate-500 italic">
                     Voucher wordt pas verzonden na ontvangst van betaling.
                   </p>
                 </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
