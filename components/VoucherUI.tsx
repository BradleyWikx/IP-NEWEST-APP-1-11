
import React, { useState } from 'react';
import { Wallet, AlertCircle, CheckCircle2, ShoppingBag, Trash2 } from 'lucide-react';
import { Button, Input } from './UI';
import { getVouchers } from '../utils/storage';

interface VoucherBoxProps {
  currentTotal: number;
  appliedCode: string;
  onApply: (code: string) => { success: boolean; message?: string };
  onRemove: () => void;
  onGoToMerch: () => void;
}

export const VoucherBox: React.FC<VoucherBoxProps> = ({ 
  currentTotal, 
  appliedCode, 
  onApply, 
  onRemove,
  onGoToMerch 
}) => {
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const vouchers = getVouchers();
  const activeVoucher = appliedCode ? vouchers.find(v => v.code === appliedCode) : null;
  const voucherBalance = activeVoucher ? activeVoucher.currentBalance : 0;
  
  // Logic for warning (must-use-full)
  // If voucher balance > currentTotal, we have 'lost' value
  const remainder = Math.max(0, voucherBalance - currentTotal);
  const isLossy = remainder > 0;

  const handleSubmit = () => {
    setError(null);
    if (!inputCode.trim()) return;
    
    // Strict business rule: Only 1 voucher allowed.
    // Assuming parent handles this via `appliedCode` prop, but UI should also reflect this constraint.
    if (appliedCode) {
      setError("Er kan slechts één voucher per boeking gebruikt worden.");
      return;
    }

    const result = onApply(inputCode.trim().toUpperCase());
    if (!result.success) {
      setError(result.message || 'Ongeldige voucher code');
    } else {
      setInputCode('');
    }
  };

  return (
    <div className={`p-8 rounded-[2rem] border transition-all duration-300 ${appliedCode ? 'bg-amber-900/20 border-amber-500/50' : 'bg-slate-900/40 border-slate-800'}`}>
      <div className="flex items-start space-x-3 mb-6">
        <div className={`p-2 rounded-lg ${appliedCode ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-800 text-slate-500'}`}>
          <Wallet size={24} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white uppercase tracking-widest text-xs mt-1.5">Theater Voucher</h3>
          {!appliedCode && (
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed max-w-sm">
              Heb je meerdere theaterbonnen? Gebruik er 1 per reservering. De overige kan je later gebruiken.
            </p>
          )}
        </div>
      </div>

      {!appliedCode ? (
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-grow">
              <Input 
                value={inputCode}
                onChange={(e: any) => setInputCode(e.target.value)}
                placeholder="Referentienummer (bijv. GS-V100)"
                onKeyDown={(e: any) => e.key === 'Enter' && handleSubmit()}
                error={error}
                className="bg-black/50 border-slate-700 focus:border-amber-500"
              />
            </div>
            <Button onClick={handleSubmit} variant="secondary" className="whitespace-nowrap px-8 h-[44px]">
              Verzilveren
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          {/* Success / Applied State */}
          <div className="flex items-center justify-between bg-black/40 p-4 rounded-xl border border-amber-500/30 shadow-lg">
            <div className="flex items-center space-x-4">
              <div className="bg-emerald-500/10 p-2 rounded-full">
                <CheckCircle2 className="text-emerald-500" size={20} />
              </div>
              <div>
                <p className="text-white font-bold text-lg tracking-wide">{appliedCode}</p>
                <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">
                  Waarde: €{voucherBalance.toFixed(2)}
                </p>
              </div>
            </div>
            <Button onClick={onRemove} variant="ghost" className="text-slate-500 hover:text-red-500 hover:bg-red-900/20 px-3">
              <Trash2 size={18} />
            </Button>
          </div>

          {/* Warning Banner if voucher is bigger than total */}
          {isLossy ? (
            <div className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-900/10 to-red-950/30 p-5">
              <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="p-2 bg-red-500/10 rounded-full shrink-0"><AlertCircle className="text-red-500" size={20} /></div>
                <div className="flex-grow">
                  <h4 className="text-sm font-bold text-white mb-1">Restbedrag vervalt!</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Je theaterbon moet volledig gebruikt worden. Het resterende bedrag (€{remainder.toFixed(2)}) vervalt bij deze boeking.
                  </p>
                </div>
                <Button 
                  onClick={onGoToMerch} 
                  className="text-xs py-2.5 px-5 bg-amber-500 hover:bg-amber-400 text-black border-none shadow-lg shadow-amber-900/20 whitespace-nowrap flex items-center"
                >
                  <ShoppingBag size={14} className="mr-2" /> Shop Merchandise
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-xs text-emerald-400/80 bg-emerald-900/10 p-3 rounded-lg border border-emerald-900/20">
               <CheckCircle2 size={14} />
               <span>Voucher succesvol toegepast op het totaalbedrag.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
