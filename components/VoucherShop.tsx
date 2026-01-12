
import React, { useState, useEffect } from 'react';
import { 
  Gift, ShoppingBag, ArrowRight, CheckCircle2, Star, 
  Sparkles, Heart, Mail, Printer, CreditCard, ChevronRight, User, FileText
} from 'lucide-react';
import { Button, Card, Input } from './UI';
import { settingsRepo, voucherOrderRepo, notificationsRepo } from '../utils/storage';
import { VoucherSaleConfig, VoucherOrder, VoucherOrderItem } from '../types';
import { triggerEmail } from '../utils/emailEngine';
import { VoucherCardPreview } from './VoucherCardPreview';

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
    senderName: '',
    message: '',
    deliveryMethod: 'DIRECT' as 'DIRECT' | 'SELF', // Direct email or Self print
    senderEmail: '',
    recipientEmail: ''
  });

  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setConfig(settingsRepo.getVoucherSaleConfig());
  }, []);

  // Calculate current total based on selection
  const currentAmount = selectedType === 'CUSTOM' ? customAmount : (selectedType === 'DINER' ? 75 : 150);

  const handleCheckout = async () => {
    if (!formData.senderEmail || !formData.senderName || !formData.recipientName) return;
    
    setIsProcessing(true);
    
    // Simulate API
    await new Promise(r => setTimeout(r, 1500));

    const orderId = `ORD-${Date.now()}`;
    const items: VoucherOrderItem[] = [{
      id: selectedType,
      label: selectedType === 'CUSTOM' ? 'Vrij Bedrag' : (selectedType === 'DINER' ? 'Diner Arrangement' : 'Romantisch Duo'),
      price: currentAmount,
      quantity: 1
    }];

    const newOrder: VoucherOrder = {
      id: orderId,
      createdAt: new Date().toISOString(),
      status: 'REQUESTED', // Belangrijk: Status is REQUESTED, nog niet betaald
      buyer: { firstName: formData.senderName, lastName: '' }, // Simplified for demo
      items,
      amount: currentAmount,
      totals: { subtotal: currentAmount, shipping: 0, fee: 0, grandTotal: currentAmount },
      deliveryMethod: 'DIGITAL', // Both 'DIRECT' and 'SELF' map to DIGITAL delivery
      recipient: { name: formData.recipientName },
      issuanceMode: 'INDIVIDUAL',
      customerEmail: formData.senderEmail
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
      
      {/* 1. Hero Section (Updated) */}
      <div className="relative py-24 md:py-32 overflow-hidden border-b border-white/5">
        {/* Abstract Glow Background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-black to-black" />
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-amber-600/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          
          {/* Logo Placement */}
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
          
          <p className="text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
            Een onvergetelijke beleving in Inspiration Point. Het perfecte geschenk voor vrienden, familie of zakenrelaties.
          </p>
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

            {/* Step 2: Personalize */}
            <section className="space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold font-serif border border-slate-700">2</div>
                <h3 className="text-xl font-serif text-white">Maak het persoonlijk</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input 
                  label="Voor wie is het?" 
                  placeholder="Naam ontvanger" 
                  value={formData.recipientName}
                  onChange={(e: any) => setFormData({...formData, recipientName: e.target.value})}
                  icon={<User size={16}/>}
                />
                <Input 
                  label="Van wie komt het?" 
                  placeholder="Uw naam" 
                  value={formData.senderName}
                  onChange={(e: any) => setFormData({...formData, senderName: e.target.value})}
                  icon={<Heart size={16}/>}
                />
                <div className="md:col-span-2">
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

            {/* Step 3: Delivery */}
            <section className="space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold font-serif border border-slate-700">3</div>
                <h3 className="text-xl font-serif text-white">Verzending</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                 <button 
                   onClick={() => setFormData({...formData, deliveryMethod: 'DIRECT'})}
                   className={`p-4 rounded-xl border text-left transition-all ${formData.deliveryMethod === 'DIRECT' ? 'bg-amber-900/20 border-amber-500 ring-1 ring-amber-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
                 >
                   <div className="flex items-center space-x-2 mb-2">
                     <Mail size={18} className={formData.deliveryMethod === 'DIRECT' ? 'text-amber-500' : 'text-slate-400'} />
                     <span className="font-bold text-white text-sm">Direct naar ontvanger</span>
                   </div>
                   <p className="text-xs text-slate-400">Wij mailen de voucher direct.</p>
                 </button>

                 <button 
                   onClick={() => setFormData({...formData, deliveryMethod: 'SELF'})}
                   className={`p-4 rounded-xl border text-left transition-all ${formData.deliveryMethod === 'SELF' ? 'bg-amber-900/20 border-amber-500 ring-1 ring-amber-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
                 >
                   <div className="flex items-center space-x-2 mb-2">
                     <Printer size={18} className={formData.deliveryMethod === 'SELF' ? 'text-amber-500' : 'text-slate-400'} />
                     <span className="font-bold text-white text-sm">Naar mijzelf</span>
                   </div>
                   <p className="text-xs text-slate-400">Ontvang PDF om zelf te geven.</p>
                 </button>
              </div>

              <div className="space-y-4 bg-slate-900/50 p-6 rounded-xl border border-slate-800/50">
                 <Input 
                   label="Uw E-mailadres (voor factuur)" 
                   type="email"
                   value={formData.senderEmail}
                   onChange={(e: any) => setFormData({...formData, senderEmail: e.target.value})}
                   placeholder="uw@email.nl"
                 />
                 
                 {formData.deliveryMethod === 'DIRECT' && (
                   <div className="animate-in fade-in slide-in-from-top-2">
                     <Input 
                       label="E-mailadres Ontvanger" 
                       type="email"
                       value={formData.recipientEmail}
                       onChange={(e: any) => setFormData({...formData, recipientEmail: e.target.value})}
                       placeholder="ontvanger@email.nl"
                     />
                   </div>
                 )}
              </div>
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
                  amount={currentAmount}
                  recipientName={formData.recipientName}
                  senderName={formData.senderName}
                  message={formData.message}
                />
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
                 <div className="flex justify-between items-end mb-6 pb-6 border-b border-slate-800">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Totaal te betalen</p>
                      <p className="text-sm text-emerald-500 font-bold flex items-center"><CheckCircle2 size={12} className="mr-1"/> Inclusief BTW</p>
                    </div>
                    <div className="text-4xl font-serif text-white">€{currentAmount}</div>
                 </div>

                 <Button 
                   onClick={handleCheckout}
                   disabled={isProcessing || !formData.senderName || !formData.recipientName || !formData.senderEmail}
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
