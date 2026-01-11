
import React, { useState, useEffect } from 'react';
import { Gift, ShoppingBag, CreditCard, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button, Card, Input } from './UI';
import { settingsRepo, voucherOrderRepo, loadData, saveData, notificationsRepo } from '../utils/storage';
import { VoucherSaleConfig, VoucherOrder, VoucherOrderItem } from '../types';
import { triggerEmail } from '../utils/emailEngine';

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

  const handleCheckout = async () => {
    if (!customer.email) return;
    
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

  if (!config || !config.isEnabled) return <div className="p-8 text-center text-white">Voucher shop is closed.</div>;

  if (step === 'SUCCESS') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <CheckCircle2 size={64} className="text-emerald-500 mx-auto mb-4" />
          <h2 className="text-3xl font-serif text-white mb-2">Bedankt!</h2>
          <p className="text-slate-400">Uw bestelling ({lastOrder?.id}) is ontvangen. U ontvangt spoedig een betaallink per e-mail.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Product List */}
        <div className="space-y-6">
          <h2 className="text-3xl font-serif text-white">Geef een beleving cadeau</h2>
          <div className="grid gap-4">
            {config.products.map(p => (
              <Card key={p.id} className="p-6 bg-slate-900 border-slate-800 hover:border-amber-500 transition-colors cursor-pointer" onClick={() => addToCart(p)}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-white">{p.label}</h3>
                    <p className="text-sm text-slate-400">{p.description}</p>
                  </div>
                  <span className="text-xl font-serif text-amber-500">€{p.price}</span>
                </div>
                <Button variant="secondary" className="mt-4 w-full">In Winkelmand</Button>
              </Card>
            ))}
          </div>
        </div>

        {/* Cart & Checkout */}
        <div className="space-y-6">
          <Card className="p-6 bg-slate-900/50 border-slate-800 sticky top-8">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center"><ShoppingBag className="mr-2"/> Winkelmand</h3>
            
            {cart.length === 0 ? (
              <p className="text-slate-500 text-sm italic">Nog geen items geselecteerd.</p>
            ) : (
              <div className="space-y-4">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-sm">
                    <span className="text-white">{item.quantity}x {item.label}</span>
                    <span className="text-slate-300">€{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="pt-4 border-t border-slate-800 flex justify-between font-bold text-white text-lg">
                  <span>Totaal</span>
                  <span>€{cart.reduce((s,i) => s + i.price * i.quantity, 0).toFixed(2)}</span>
                </div>

                {step === 'SHOP' ? (
                  <Button onClick={() => setStep('CHECKOUT')} className="w-full mt-4">Afrekenen</Button>
                ) : (
                  <div className="space-y-4 pt-4 border-t border-slate-800 animate-in fade-in">
                    <Input label="Voornaam" value={customer.firstName} onChange={(e: any) => setCustomer({...customer, firstName: e.target.value})} />
                    <Input label="Achternaam" value={customer.lastName} onChange={(e: any) => setCustomer({...customer, lastName: e.target.value})} />
                    <Input label="E-mail" type="email" value={customer.email} onChange={(e: any) => setCustomer({...customer, email: e.target.value})} />
                    <Button onClick={handleCheckout} className="w-full">Bestelling Plaatsen</Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

      </div>
    </div>
  );
};
