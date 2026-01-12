
import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '../UI';

interface DestructiveActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  verificationText: string; // The text the user must type (e.g. "DELETE")
  confirmButtonText?: string;
}

export const DestructiveActionModal: React.FC<DestructiveActionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  verificationText,
  confirmButtonText = "Bevestigen"
}) => {
  const [inputValue, setInputValue] = useState('');
  
  // Reset input when modal opens
  useEffect(() => {
    if (isOpen) setInputValue('');
  }, [isOpen]);

  if (!isOpen) return null;

  const isMatch = inputValue === verificationText;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-950 border border-red-900/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 bg-red-950/20 border-b border-red-900/30 flex items-start space-x-4">
          <div className="p-3 bg-red-900/20 rounded-full text-red-500 shrink-0">
            <AlertTriangle size={24} />
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
              onPaste={(e) => e.preventDefault()} // Force typing
            />
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose} className="flex-1">
              Annuleren
            </Button>
            <Button 
              onClick={onConfirm} 
              disabled={!isMatch}
              className={`flex-1 ${isMatch ? 'bg-red-600 hover:bg-red-700 shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
            >
              {confirmButtonText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
