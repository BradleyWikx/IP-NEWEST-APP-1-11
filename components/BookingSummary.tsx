
import React, { useEffect, useState } from 'react';
import { Card, Input, Button } from './UI';
import { Ticket, Users, Tag, Wallet, ShoppingBag, X, Check, Loader2 } from 'lucide-react';
import { getEvents, getShowDefinitions, getVouchers, getPromoRules } from '../utils/storage';
import { getEffectivePricing, calculateBookingTotals } from '../utils/pricing';
import { ShowDefinition } from '../types';

interface BookingSummaryProps {
  data: any;
  onUpdate?: (updates: any) => void;
}

export const BookingSummary = ({ data, onUpdate }: BookingSummaryProps) => {
  const [show, setShow] = useState<ShowDefinition | null>(null);
  const [financials, setFinancials] = useState<any>(null);
  
  // Code Input State
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const events = getEvents();
    const shows = getShowDefinitions();

    if (data.date && data.showId) {
      const event = events.find(e => e.date === data.date);
      const foundShow = shows.find(s => s.id === data.showId);
      
      if (event && foundShow) {
        setShow(foundShow);
        const pricing = getEffectivePricing(event, foundShow);
        const totals = calculateBookingTotals({
          totalGuests: data.totalGuests,
          packageType: data.packageType,
          addons: data.addons,
          merchandise: data.merchandise,
          promo: data.promo,
          voucherCode: data.voucherCode,
          date: data.date,
          showId: data.showId
        }, pricing);
        
        setFinancials(totals);
      }
    }
  }, [data]);

  const handleApplyCode = async () => {
    if (!code.trim()) return;
    setIsChecking(true);
    setCodeError(null);
    
    // Simulate network delay
    await new Promise(r => setTimeout(r, 600));

    const upperCode = code.trim().toUpperCase();

    // 1. Check Promo Codes (Live from Storage)
    const promoRules = getPromoRules();
    const validPromo = promoRules.find(p => p.code.toUpperCase() === upperCode && p.enabled);

    if (validPromo) {
        if (onUpdate) onUpdate({ promo: upperCode, voucherCode: '' }); // Clear voucher if promo applied
        setIsChecking(false);
        setCode('');
        return;
    }

    // 2. Check Vouchers
    const vouchers = getVouchers();
    const voucher = vouchers.find(v => v.code === upperCode);
    
    if (voucher) {
        if (!voucher.isActive) {
            setCodeError('Deze voucher is niet meer geldig.');
        } else if (voucher.currentBalance <= 0) {
            setCodeError('Het saldo van deze voucher is €0.00');
        } else {
             if (onUpdate) onUpdate({ voucherCode: upperCode, promo: '' }); // Clear promo if voucher applied
             setCode('');
        }
    } else {
        setCodeError('Code niet gevonden (geen geldige promo of voucher).');
    }

    setIsChecking(false);
  };

  const removeCode = () => {
      if (onUpdate) onUpdate({ promo: '', voucherCode: '' });
  };

  if (!financials || !show) return (
    <div className="text-slate-500 text-sm italic p-4 text-center">Selecteer een datum om prijzen te zien.</div>
  );

  const { subtotal, discountAmount, voucherApplied, amountDue, voucherLost, items } = financials;
  const activeCode = data.promo || data.voucherCode;

  // Find ticket line item for display
  const ticketLine = items.find((i: any) => i.category === 'TICKET');
  const extraItems = items.filter((i:any) => i.category === 'ADDON' || i.category === 'MERCH');

  return (
    <Card className="bg-slate-900 border-slate-800 overflow-hidden shadow-2xl">
      <div className="bg-red-900/10 border-b border-red-900/20 p-6">
        <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] mb-1">Uw Reservering</h3>
        <p className="font-serif text-xl text-white">Overzicht</p>
      </div>

      <div className="p-6 space-y-6">
        <div className="space-y-5">
          {/* DATE & SHOW */}
          <div className="flex items-start space-x-4">
            <Ticket className="text-slate-500 mt-1 shrink-0" size={16} />
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Datum & Show</p>
              <p className="text-xs font-bold text-white">{new Date(data.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} • {show.name}</p>
            </div>
          </div>

          {/* ARRANGEMENT (WITH PRICE) */}
          <div className="flex items-start space-x-4">
            <Users className="text-slate-500 mt-1 shrink-0" size={16} />
            <div className="w-full">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Arrangement</p>
              <div className="flex justify-between items-start w-full">
                  <div>
                    <p className="text-xs font-bold text-white capitalize">{data.packageType} ({data.totalGuests}p)</p>
                    {ticketLine && <p className="text-[10px] text-slate-500 mt-0.5">€{ticketLine.unitPrice.toFixed(2)} p.p.</p>}
                  </div>
                  {ticketLine && <span className="text-xs font-mono text-white font-bold">€{ticketLine.total.toFixed(2)}</span>}
              </div>
            </div>
          </div>

          {/* EXTRAS (WITH PRICE) */}
          {extraItems.length > 0 && (
             <div className="flex items-start space-x-4">
               <ShoppingBag className="text-slate-500 mt-1 shrink-0" size={16} />
               <div className="w-full">
                 <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Extra's</p>
                 <div className="space-y-1">
                   {extraItems.map((item:any) => (
                     <div key={item.id} className="flex justify-between items-center w-full text-xs">
                       <span className="text-slate-300">{item.quantity}x {item.label}</span>
                       <span className="text-slate-300 font-mono">€{item.total.toFixed(2)}</span>
                     </div>
                   ))}
                 </div>
               </div>
             </div>
          )}
        </div>

        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Subtotaal</span>
            <span className="text-slate-300 font-mono">€{subtotal.toFixed(2)}</span>
          </div>

          {/* Unified Code Input Section */}
          {!activeCode && onUpdate && (
            <div className="pt-2">
                <div className="flex space-x-2">
                    <input 
                        type="text" 
                        placeholder="Voucher of Promo Code"
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white w-full outline-none focus:border-amber-500 uppercase placeholder:normal-case"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleApplyCode()}
                    />
                    <Button onClick={handleApplyCode} disabled={isChecking || !code} className="px-3 py-1 h-auto text-xs bg-slate-800 text-slate-200 border-none hover:bg-slate-700">
                        {isChecking ? <Loader2 size={12} className="animate-spin"/> : 'Check'}
                    </Button>
                </div>
                {codeError && <p className="text-[10px] text-red-400 mt-1">{codeError}</p>}
            </div>
          )}

          {activeCode && (
            <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800">
                <div className="flex items-center space-x-2">
                    {data.voucherCode ? <Wallet size={12} className="text-amber-500"/> : <Tag size={12} className="text-emerald-500"/>}
                    <span className="text-xs font-bold text-white">{activeCode}</span>
                </div>
                <div className="flex items-center space-x-2">
                    <span className={`text-xs font-bold ${data.voucherCode ? 'text-amber-500' : 'text-emerald-500'}`}>
                        -{data.voucherCode ? `€${voucherApplied.toFixed(2)}` : `€${discountAmount.toFixed(2)}`}
                    </span>
                    {onUpdate && <button onClick={removeCode} className="text-slate-500 hover:text-white"><X size={12}/></button>}
                </div>
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-slate-800">
          <div className="flex justify-between items-end">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {voucherApplied > 0 ? "Restbedrag" : "Te Betalen"}
            </p>
            <p className="text-3xl font-serif text-white">€{amountDue.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</p>
          </div>
          
          {voucherLost > 0 && (
            <div className="mt-3 p-3 bg-red-900/20 border border-red-700/30 rounded-lg animate-in fade-in">
              <p className="text-[9px] text-red-400 font-bold uppercase leading-tight">
                Let op: Voucher overschot (€{voucherLost.toFixed(2)}) komt te vervallen.
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
