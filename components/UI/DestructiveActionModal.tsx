
import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import { Button } from '../UI';

interface DestructiveActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  verificationText: string; // The text the user must type (e.g. "DELETE")
  confirmButtonText?: string;
  requireVerification?: boolean; // NEW: If false, skips the typing requirement
}

export const DestructiveActionModal: React.FC<DestructiveActionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  verificationText,
  confirmButtonText = "Bevestigen",
  requireVerification = true
}) => {
  const [inputValue, setInputValue] = useState('');
  
  // Reset input when modal opens
  useEffect(() => {
    if (isOpen) setInputValue('');
  }, [isOpen]);

  if (!isOpen) return null;

  const isMatch = !requireVerification || inputValue === verificationText;

  // Determine styles based on "Destructive" (Red) or "Positive" (Green/Blue) intent based on verification requirement
  // Usually if no verification is needed, it's a positive/neutral action
  const isDestructive = requireVerification;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className={`p-6 border-b flex items-start space-x-4 ${isDestructive ? 'bg-red-950/20 border-red-900/30' : 'bg-slate-900 border-slate-800'}`}>
          <div className={`p-3 rounded-full shrink-0 ${isDestructive ? 'bg-red-900/20 text-red-500' : 'bg-emerald-900/20 text-emerald-500'}`}>
            {isDestructive ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
          </div>
          <div className="flex-grow">
            <h3 className="text-xl font-bold text-white mb-1">{title}</h3>
            <div className="text-sm text-slate-300 leading-relaxed">
              {description}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {requireVerification && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">
                Typ <span className="text-white select-all">"{verificationText}"</span> om te bevestigen
              </label>
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={verificationText}
                className="w-full bg-black border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500/50 outline-none transition-all placeholder:text-slate-700 font-mono text-center tracking-widest uppercase"
                autoFocus
                onPaste={(e) => e.preventDefault()} // Force typing for destructive actions
              />
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose} className="flex-1">
              Annuleren
            </Button>
            <Button 
              onClick={onConfirm} 
              disabled={!isMatch}
              autoFocus={!requireVerification} // Auto focus confirm button if no typing needed
              className={`flex-1 ${
                isDestructive 
                  ? (isMatch ? 'bg-red-600 hover:bg-red-700 shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'bg-slate-800 text-slate-500 cursor-not-allowed')
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg'
              }`}
            >
              {confirmButtonText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
