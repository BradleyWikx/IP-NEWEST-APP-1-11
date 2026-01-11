
import React, { useState, useEffect } from 'react';
import { 
  Gift, ShoppingBag, ArrowRight, CheckCircle2, Star, 
  Sparkles, ShieldCheck, Mail, Clock, CreditCard 
} from 'lucide-react';
import { Button, Card, Input } from './UI';
import { settingsRepo, voucherOrderRepo, notificationsRepo } from '../utils/storage';
import { VoucherSaleConfig, VoucherOrder, VoucherOrderItem } from '../types';
import { triggerEmail } from '../utils/emailEngine';

const BenefitItem = ({ icon: Icon, title, desc }: any) => (
  <div className="flex items-start space-x-3">
    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500 shrink-0 border border-amber-500/20">
      <Icon size={18} />
    </div>
    <div>
      <h4 className="text-white font-bold text-sm">{title}</h4>
      <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
    </div>
  </div>
);

export const VoucherShop = () => {
  const [config, setConfig] = useState<VoucherSaleConfig | null>(null);
  const [cart, setCart] = useState<VoucherOrderItem[]>([]);
  const [step, setStep] = useState<'SHOP' | 'CHECKOUT' | 'SUCCESS'>('SHOP');
  const [customer, setCustomer] = useState({ firstName: '', lastName: '', email: '' });
  const [lastOrder, setLastOrder] = useState<VoucherOrder | null>(null);

  useEffect(() => {
    setConfig(settingsRepo.getVoucherSaleConfig());
  }, []);

  const addToCart = (product: any) => {
    const existing = cart.find(i => i.id === product.id);
    if (existing) {
      setCart(cart.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart([...cart, { id: product.id, label: product.label, price: product.price, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId: string) => {
    const existing = cart.find(i => i.id === productId);
    if (existing && existing.quantity > 1) {
      setCart(cart.map(i => i.id === productId ? { ...i, quantity: i.quantity - 1 } : i));
    } else {
      setCart(cart.filter(i => i.id !== productId));
    }
  };

  const handleCheckout = async () => {
    if (!customer.email || !customer.firstName || !customer.lastName) return;
    
    const orderId = `ORD-${Date.now()}`;
    const subtotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    
    const newOrder: VoucherOrder = {
      id: orderId,
      createdAt: new Date().toISOString(),
      status: 'REQUESTED',
      buyer: customer,
      items: cart,
      amount: subtotal,
      totals: {
        subtotal,
        shipping: 0,
        fee: 0,
        grandTotal: subtotal
      },
      deliveryMethod: 'DIGITAL',
      recipient: { name: customer.firstName }, // Self by default for demo
      issuanceMode: 'INDIVIDUAL'
    };

    voucherOrderRepo.add(newOrder);
    
    // --- EMAIL TRIGGER ---
    triggerEmail('VOUCHER_ORDER_REQUEST_RECEIVED', { type: 'VOUCHER_ORDER', id: orderId, data: newOrder });
    
    // --- NOTIFICATION TRIGGER ---
    notificationsRepo.createFromEvent('NEW_VOUCHER_ORDER', newOrder);

    setLastOrder(newOrder);
    setStep('SUCCESS');
  };

  if (!config || !config.isEnabled) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center p-8 border border-slate-800 rounded-2xl bg-slate-900">
        <Gift size={48} className="mx-auto text-slate-600 mb-4"/>
        <h2 className="text-xl text-white font-serif">De shop is momenteel gesloten.</h2>
      </div>
    </div>
  );

  if (step === 'SUCCESS') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
        {/* Confetti Background Effect */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-pulse pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <Card className="text-center max-w-lg w-full p-10 bg-slate-900/80 backdrop-blur-xl border-amber-500/30 shadow-2xl relative z-10 animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/20">
            <CheckCircle2 size={40} className="text-black" strokeWidth={3} />
          </div>
          <h2 className="text-4xl font-serif text-white mb-2">Bedankt, {customer.firstName}!</h2>
          <p className="text-slate-300 mb-8 text-lg">
            Uw bestelling <span className="font-mono text-amber-500">#{lastOrder?.id}</span> is ontvangen.
          </p>
          
          <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 mb-8 text-left space-y-3">
            <div className="flex items-start space-x-3">
              <Mail className="text-blue-400 mt-1 shrink-0" size={18} />
              <p className="text-sm text-slate-400">
                U ontvangt binnen enkele minuten een <strong>betaallink</strong> op <em>{customer.email}</em>.
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <Gift className="text-emerald-400 mt-1 shrink-0" size={18} />
              <p className="text-sm text-slate-400">
                Na betaling worden de vouchers direct digitaal verstuurd.
              </p>
            </div>
          </div>

          <Button onClick={() => window.location.reload()} variant="secondary" className="w-full">
            Terug naar de Shop
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-200">
      
      {/* Hero Section - Seamless Black */}
      <div className="relative overflow-hidden border-b border-white/5">
        {/* Background Image with Deep Fade */}
        <div className="absolute inset-0 z-0">
            <img 
              src="https://images.unsplash.com/photo-1514306191717-45224512c2d2?q=80&w=2070&auto=format&fit=crop" 
              className="w-full h-full object-cover opacity-20 grayscale-[50%]"
              alt="Theater Ambience"
            />
            {/* Gradients to fade into black body */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
        </div>
        
        <div className="max-w-7xl mx-auto px-6 py-20 relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold uppercase tracking-widest">
              <Sparkles size={14} /> <span>Het perfecte cadeau</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-serif text-white leading-tight drop-shadow-2xl">
              Geef een avond <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">pure magie</span>.
            </h1>
            <p className="text-lg text-slate-400 max-w-md leading-relaxed">
              Verras vrienden of familie met een diner-theater ervaring. 
              Onze vouchers zijn geldig voor alle shows en arrangementen.
            </p>
          </div>
          
          {/* Benefits Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div className="p-4 bg-slate-950/40 backdrop-blur-md border border-white/5 rounded-xl hover:bg-slate-950/60 transition-colors group">
               <BenefitItem icon={Clock} title="2 Jaar Geldig" desc="Ruim de tijd om een perfect moment te kiezen." />
             </div>
             <div className="p-4 bg-slate-950/40 backdrop-blur-md border border-white/5 rounded-xl hover:bg-slate-950/60 transition-colors group">
               <BenefitItem icon={Mail} title="Direct in Huis" desc="Digitale verzending direct na betaling." />
             </div>
             <div className="p-4 bg-slate-950/40 backdrop-blur-md border border-white/5 rounded-xl hover:bg-slate-950/60 transition-colors group">
               <BenefitItem icon={ShieldCheck} title="Veilig Betalen" desc="Betaal veilig via iDeal of Creditcard." />
             </div>
             <div className="p-4 bg-slate-950/40 backdrop-blur-md border border-white/5 rounded-xl hover:bg-slate-950/60 transition-colors group">
               <BenefitItem icon={Star} title="Premium Ervaring" desc="Geldig voor show, diner en drankjes." />
             </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 md:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Product Grid */}
          <div className="lg:col-span-2 space-y-10">
            <div>
              <h2 className="text-2xl font-serif text-white mb-6 flex items-center">
                <Gift className="mr-3 text-amber-500" /> Kies uw Voucher
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {config.products.map(p => (
                  <div 
                    key={p.id} 
                    className="group relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-amber-500/50 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-amber-900/10 flex flex-col"
                    onClick={() => addToCart(p)}
                  >
                    {/* Subtle Glow Effect on Hover */}
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/20 to-amber-900/20 rounded-2xl opacity-0 group-hover:opacity-100 blur transition duration-500" />
                    
                    <div className="relative p-6 flex flex-col h-full bg-slate-900 rounded-2xl">
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-black rounded-xl border border-slate-800 text-amber-500 shadow-inner group-hover:text-amber-400 transition-colors">
                          <Star size={24} fill="currentColor" className="opacity-80" />
                        </div>
                        <span className="font-serif text-2xl text-white font-bold group-hover:text-amber-500 transition-colors">€{p.price}</span>
                      </div>
                      
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-amber-500 transition-colors">{p.label}</h3>
                      <p className="text-sm text-slate-400 mb-6 flex-grow">{p.description}</p>
                      
                      <Button variant="secondary" className="w-full bg-black border-slate-800 group-hover:bg-amber-500 group-hover:text-black group-hover:border-amber-500 transition-all">
                        In Winkelmand
                      </Button>
                    </div>
                  </div>
                ))}
                
                {/* Custom Amount Mock */}
                <div className="relative bg-black/40 border border-slate-800 border-dashed rounded-2xl p-6 flex flex-col justify-center items-center text-center opacity-50 hover:opacity-100 transition-opacity cursor-not-allowed">
                   <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-slate-500 mb-4">
                      <CreditCard size={24} />
                   </div>
                   <h3 className="text-lg font-bold text-white mb-1">Eigen Bedrag</h3>
                   <p className="text-xs text-slate-500 mb-4">Kies zelf een waarde tussen €10 - €500</p>
                   <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600 bg-slate-900 px-2 py-1 rounded">Binnenkort</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cart & Checkout Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
              
              <Card className="bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-slate-800 bg-black/20">
                  <h3 className="text-lg font-serif text-white flex items-center">
                    <ShoppingBag className="mr-2 text-amber-500" size={20}/> Uw Bestelling
                  </h3>
                </div>
                
                <div className="p-6">
                  {cart.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <p className="text-sm italic">Nog geen items geselecteerd.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {cart.map(item => (
                        <div key={item.id} className="flex justify-between items-center group">
                          <div className="flex items-center">
                            <div className="flex items-center space-x-2 bg-black rounded-lg px-2 py-1 border border-slate-800 mr-3">
                               <button onClick={() => removeFromCart(item.id)} className="text-slate-500 hover:text-white transition-colors">-</button>
                               <span className="text-xs font-bold text-white w-4 text-center">{item.quantity}</span>
                               <button onClick={() => addToCart(item)} className="text-slate-500 hover:text-white transition-colors">+</button>
                            </div>
                            <span className="text-sm text-slate-300 font-medium">{item.label}</span>
                          </div>
                          <span className="text-sm font-mono text-white">€{(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                      
                      <div className="h-px bg-slate-800 my-4" />
                      
                      <div className="flex justify-between items-center mb-6">
                        <span className="text-slate-400 uppercase text-xs font-bold tracking-widest">Totaal</span>
                        <span className="text-2xl font-serif text-amber-500">
                          €{cart.reduce((s,i) => s + i.price * i.quantity, 0).toFixed(2)}
                        </span>
                      </div>

                      {step === 'SHOP' ? (
                        <Button onClick={() => setStep('CHECKOUT')} className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/20">
                          Bestellen <ArrowRight size={16} className="ml-2"/>
                        </Button>
                      ) : (
                        <div className="space-y-4 animate-in slide-in-from-bottom-2 fade-in">
                          <div className="bg-black/40 p-4 rounded-xl border border-slate-800 space-y-3">
                            <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-2">Uw Gegevens</h4>
                            <div className="grid grid-cols-2 gap-3">
                              <Input 
                                placeholder="Voornaam" 
                                value={customer.firstName} 
                                onChange={(e: any) => setCustomer({...customer, firstName: e.target.value})} 
                                className="bg-slate-950 border-slate-700 text-sm h-10"
                              />
                              <Input 
                                placeholder="Achternaam" 
                                value={customer.lastName} 
                                onChange={(e: any) => setCustomer({...customer, lastName: e.target.value})} 
                                className="bg-slate-950 border-slate-700 text-sm h-10"
                              />
                            </div>
                            <Input 
                              type="email"
                              placeholder="E-mailadres" 
                              value={customer.email} 
                              onChange={(e: any) => setCustomer({...customer, email: e.target.value})} 
                              className="bg-slate-950 border-slate-700 text-sm h-10"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => setStep('SHOP')} className="flex-1">Terug</Button>
                            <Button onClick={handleCheckout} disabled={!customer.email} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                              Afrekenen
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Security Badge */}
                <div className="bg-black/20 p-3 text-center border-t border-slate-800">
                  <p className="text-[10px] text-slate-500 flex items-center justify-center uppercase tracking-wider font-bold">
                    <ShieldCheck size={12} className="mr-1.5 text-emerald-500" /> Veilig Betalen & Privacy Garantie
                  </p>
                </div>
              </Card>

              {/* Support Info */}
              <div className="text-center">
                 <p className="text-xs text-slate-500">Vragen? Bel ons op <span className="text-slate-400 font-bold">020-12345678</span></p>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
