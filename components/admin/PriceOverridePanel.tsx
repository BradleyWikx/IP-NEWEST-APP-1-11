
import React, { useState, useEffect } from 'react';
import { Reservation, AdminPriceOverride, ShowDefinition } from '../../types';
import { Button, Input, Card } from '../UI';
import { AlertCircle, CheckCircle2, RotateCcw, Save, DollarSign, Calculator } from 'lucide-react';
import { getEffectivePricing, calculateBookingTotals } from '../../utils/pricing';
import { getEvents, getShowDefinitions } from '../../utils/storage';

interface PriceOverridePanelProps {
  reservation: Reservation;
  onSave: (override: AdminPriceOverride | undefined, sendEmail: boolean) => void;
  onCancel: () => void;
}

export const PriceOverridePanel: React.FC<PriceOverridePanelProps> = ({ reservation, onSave, onCancel }) => {
  const [override, setOverride] = useState<AdminPriceOverride>(
    reservation.adminPriceOverride || { reason: '' }
  );
  const [sendEmail, setSendEmail] = useState(false);
  
  // Local state for form inputs
  const [hasUnitPriceOverride, setHasUnitPriceOverride] = useState(!!reservation.adminPriceOverride?.unitPrice);
  const [unitPriceInput, setUnitPriceInput] = useState<number | ''>(reservation.adminPriceOverride?.unitPrice ?? '');
  
  const [hasDiscount, setHasDiscount] = useState(!!reservation.adminPriceOverride?.discount);
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENT' | 'PER_PERSON'>(reservation.adminPriceOverride?.discount?.type || 'FIXED');
  const [discountAmount, setDiscountAmount] = useState<number | ''>(reservation.adminPriceOverride?.discount?.amount ?? '');
  const [discountLabel, setDiscountLabel] = useState(reservation.adminPriceOverride?.discount?.label || '');
  
  const [reason, setReason] = useState(reservation.adminPriceOverride?.reason || '');
  const [error, setError] = useState<string | null>(null);

  // Preview Data
  const [preview, setPreview] = useState<{ original: number; new: number } | null>(null);

  useEffect(() => {
    // Calculate preview whenever inputs change
    const events = getEvents();
    const shows = getShowDefinitions();
    const event = events.find(e => e.date === reservation.date);
    const show = shows.find(s => s.id === reservation.showId);

    if (event && show) {
      const pricing = getEffectivePricing(event, show);
      
      // Calculate Original (No Override)
      const originalTotals = calculateBookingTotals({
        totalGuests: reservation.partySize,
        packageType: reservation.packageType,
        addons: reservation.addons,
        merchandise: reservation.merchandise,
        promo: reservation.financials.voucherCode, // Approx logic for existing promo
        voucherCode: reservation.voucherCode,
        date: reservation.date,
        showId: reservation.showId
      }, pricing);

      // Construct Proposed Override
      const proposedOverride: AdminPriceOverride = {
        unitPrice: hasUnitPriceOverride && typeof unitPriceInput === 'number' ? unitPriceInput : undefined,
        discount: hasDiscount && typeof discountAmount === 'number' ? {
          type: discountType,
          amount: discountAmount,
          label: discountLabel || 'Korting'
        } : undefined,
        reason // Not needed for calc
      };

      // Calculate New
      const newTotals = calculateBookingTotals({
        totalGuests: reservation.partySize,
        packageType: reservation.packageType,
        addons: reservation.addons,
        merchandise: reservation.merchandise,
        promo: reservation.financials.voucherCode,
        voucherCode: reservation.voucherCode,
        date: reservation.date,
        showId: reservation.showId,
        adminOverride: proposedOverride
      }, pricing);

      setPreview({
        original: originalTotals.amountDue,
        new: newTotals.amountDue
      });
    }
  }, [hasUnitPriceOverride, unitPriceInput, hasDiscount, discountType, discountAmount, discountLabel, reservation]);

  const handleSave = () => {
    setError(null);
    if (!reason.trim()) {
      setError("Een reden voor de wijziging is verplicht.");
      return;
    }

    if (hasUnitPriceOverride && (unitPriceInput === '' || unitPriceInput < 0)) {
      setError("Vul een geldige arrangement prijs in.");
      return;
    }

    if (hasDiscount && (discountAmount === '' || discountAmount < 0)) {
      setError("Vul een geldig kortingsbedrag in.");
      return;
    }

    if (hasDiscount && !discountLabel.trim()) {
        setError("Geef de korting een naam (label).");
        return;
    }

    // Construct Final Object
    // If user unchecked everything, we pass undefined to clear it
    if (!hasUnitPriceOverride && !hasDiscount) {
        onSave(undefined, sendEmail);
        return;
    }

    const finalOverride: AdminPriceOverride = {
      reason,
      updatedAt: new Date().toISOString(),
      unitPrice: hasUnitPriceOverride ? Number(unitPriceInput) : undefined,
      discount: hasDiscount ? {
        type: discountType,
        amount: Number(discountAmount),
        label: discountLabel
      } : undefined
    };

    onSave(finalOverride, sendEmail);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
        <h3 className="font-bold text-white flex items-center">
          <Calculator size={18} className="mr-2 text-amber-500" /> 
          Prijs & Kortingen
        </h3>
        {preview && (
          <div className="text-right">
            <span className="text-xs text-slate-500 block">Nieuw Totaal</span>
            <span className={`font-mono font-bold text-lg ${preview.new !== preview.original ? 'text-amber-500' : 'text-slate-300'}`}>
              €{preview.new.toFixed(2)}
            </span>
            {preview.new !== preview.original && (
              <span className="text-[10px] text-slate-500 line-through ml-2">€{preview.original.toFixed(2)}</span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 text-sm flex items-center">
          <AlertCircle size={16} className="mr-2 shrink-0" /> {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Unit Price Override */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex justify-between items-center mb-3">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={hasUnitPriceOverride} 
                onChange={(e) => setHasUnitPriceOverride(e.target.checked)}
                className="rounded bg-slate-800 border-slate-600 checked:bg-amber-500"
              />
              <span className="text-sm font-bold text-white">Arrangement Prijs Aanpassen</span>
            </label>
          </div>
          
          {hasUnitPriceOverride && (
            <div className="pl-6 animate-in slide-in-from-top-1">
              <Input 
                label="Prijs per persoon (€)" 
                type="number" 
                value={unitPriceInput} 
                onChange={(e: any) => setUnitPriceInput(parseFloat(e.target.value))}
                placeholder="Bijv. 45.00"
              />
              <p className="text-[10px] text-slate-500 mt-1">Vervangt de standaard arrangement prijs.</p>
            </div>
          )}
        </div>

        {/* Custom Discount */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex justify-between items-center mb-3">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={hasDiscount} 
                onChange={(e) => setHasDiscount(e.target.checked)}
                className="rounded bg-slate-800 border-slate-600 checked:bg-amber-500"
              />
              <span className="text-sm font-bold text-white">Extra Korting Toepassen</span>
            </label>
          </div>

          {hasDiscount && (
            <div className="pl-6 space-y-3 animate-in slide-in-from-top-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500">Type</label>
                  <select 
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                    value={discountType}
                    onChange={(e: any) => setDiscountType(e.target.value)}
                  >
                    <option value="FIXED">Vast Bedrag (Totaal)</option>
                    <option value="PER_PERSON">Per Persoon</option>
                    <option value="PERCENT">Percentage</option>
                  </select>
                </div>
                <Input 
                  label={discountType === 'PERCENT' ? 'Percentage (%)' : 'Bedrag (€)'}
                  type="number"
                  value={discountAmount}
                  onChange={(e: any) => setDiscountAmount(parseFloat(e.target.value))}
                />
              </div>
              <Input 
                label="Label (zichtbaar op factuur)" 
                value={discountLabel}
                onChange={(e: any) => setDiscountLabel(e.target.value)}
                placeholder="Bijv. Familiekorting"
              />
            </div>
          )}
        </div>

        {/* Reason & Email */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-amber-500 uppercase tracking-widest">Interne Reden / Notitie *</label>
          <textarea 
            className="w-full h-20 bg-black/30 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-amber-500 outline-none resize-none"
            placeholder="Waarom wordt de prijs aangepast?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          
          <label className="flex items-center space-x-2 cursor-pointer py-2">
            <input 
              type="checkbox" 
              checked={sendEmail} 
              onChange={(e) => setSendEmail(e.target.checked)}
              className="rounded bg-slate-800 border-slate-600 checked:bg-emerald-500"
            />
            <span className="text-sm text-slate-300">Stuur bevestigingsmail met nieuwe prijs naar klant</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
        <Button variant="ghost" onClick={onCancel}>Annuleren</Button>
        <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 flex items-center">
          <Save size={16} className="mr-2" /> Opslaan
        </Button>
      </div>
    </div>
  );
};
