
import React, { useEffect, useState, useRef } from 'react';
import { getStatusStyles, getStatusLabel } from '../utils/status';
import { X, ChevronRight, Check } from 'lucide-react';
import { useIsMobile } from '../hooks/useMediaQuery';

// Helper to generate unique IDs if none provided
const useId = (id?: string) => {
  const [genId] = React.useState(() => `field-${Math.random().toString(36).substr(2, 9)}`);
  return id || genId;
};

export const Button = ({ variant = 'primary', className = '', ...props }: any) => {
  // Enforce min-h-[44px] for touch targets
  // Added font-serif to buttons for that theatrical feel
  const base = "px-8 py-3 rounded-full font-serif font-bold tracking-wider transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-amber-500 min-h-[44px] flex items-center justify-center touch-manipulation shadow-lg";
  
  const variants: any = {
    // Theatrical Red Button: Gradient + Gold Border glow hint
    primary: `bg-gradient-to-b from-red-700 to-red-900 text-white border border-red-600/30 hover:from-red-600 hover:to-red-800 shadow-[0_4px_14px_0_rgba(153,27,27,0.39)]`,
    
    // Secondary: Dark background with Gold Border
    secondary: "bg-slate-900 border border-amber-600/40 text-amber-500 hover:bg-slate-800 hover:border-amber-500 hover:text-amber-400 hover:shadow-[0_0_15px_rgba(245,158,11,0.1)]",
    
    // Outline: Pure Gold
    outline: "border-2 border-amber-500 text-amber-500 hover:bg-amber-500/10 hover:shadow-[0_0_10px_rgba(245,158,11,0.2)]",
    
    // Ghost: Subtle
    ghost: "text-slate-400 hover:text-white hover:bg-slate-800/50"
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
};

export const Badge = ({ status, className = "", children }: { status: string, className?: string, children?: React.ReactNode }) => (
  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap border shadow-sm ${getStatusStyles(status)} ${className}`}>
    {children || getStatusLabel(status)}
  </span>
);

export const Card = ({ children, className = "", onClick }: any) => (
  // Updated Card: Darker bg, subtle gold/amber border instead of slate
  <div onClick={onClick} className={`bg-slate-950/80 backdrop-blur-sm border border-amber-900/30 rounded-2xl shadow-2xl ${className}`}>
    {children}
  </div>
);

export const Input = ({ label, error, id, icon, ...props }: any) => {
  const fieldId = useId(id);
  const errorId = `${fieldId}-error`;

  return (
    <div className="flex flex-col space-y-2 w-full">
      {label && (
        <label htmlFor={fieldId} className="text-xs font-bold text-amber-500/80 uppercase tracking-widest cursor-pointer font-serif">
          {label}
        </label>
      )}
      <div className="relative group">
        {icon && <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-focus-within:text-amber-500 transition-colors">{icon}</div>}
        <input 
          id={fieldId}
          className={`w-full px-4 py-3 bg-black/40 border rounded-xl text-amber-50 focus:outline-none transition-all placeholder:text-slate-600 min-h-[44px] 
            ${error 
              ? 'border-red-800 focus:border-red-500 focus:ring-1 focus:ring-red-500' 
              : 'border-slate-800 focus:border-amber-600/50 focus:ring-1 focus:ring-amber-500/20 hover:border-slate-700'
            } 
            ${icon ? 'pl-10' : ''}`}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          {...props} 
        />
      </div>
      {error && (
        <span id={errorId} className="text-xs text-red-400 font-medium flex items-center animate-in slide-in-from-top-1">
          {error}
        </span>
      )}
    </div>
  );
};

export const Stepper = ({ steps, current }: { steps: string[], current: number }) => {
  return (
    <div className="w-full bg-black/90 backdrop-blur-md sticky top-0 z-40 border-b border-amber-900/30 transition-all duration-300 shadow-lg">
      
      {/* MOBILE: Ultra Compact */}
      <div className="md:hidden">
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-amber-500 font-serif font-bold text-lg truncate pr-4">
            {steps[current]}
          </span>
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest whitespace-nowrap bg-slate-900 px-2 py-1 rounded-full border border-slate-800">
            {current + 1} / {steps.length}
          </span>
        </div>
        {/* Integrated Slim Progress Bar */}
        <div className="w-full h-[2px] bg-slate-900">
          <div 
            className="h-full bg-gradient-to-r from-red-700 to-amber-500 transition-all duration-500 ease-out" 
            style={{ width: `${((current + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* DESKTOP: Elegant Breadcrumbs (Active Expanded, Others Dot) */}
      <div className="hidden md:flex justify-center items-center py-3 px-8 max-w-7xl mx-auto overflow-hidden">
        {steps.map((step, i) => {
          const isActive = i === current;
          const isCompleted = i < current;
          
          return (
            <React.Fragment key={step}>
              {/* Step Node */}
              <div className="flex items-center">
                {isActive ? (
                  // Active: Expanded Pill
                  <div className="flex items-center px-4 py-1.5 rounded-full bg-gradient-to-r from-red-950 to-slate-900 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)] animate-in fade-in zoom-in-95 duration-300">
                    <span className="w-5 h-5 flex items-center justify-center rounded-full bg-amber-500 text-black text-[10px] font-bold mr-2">
                      {i + 1}
                    </span>
                    <span className="text-xs font-bold text-amber-50 uppercase tracking-widest whitespace-nowrap">
                      {step}
                    </span>
                  </div>
                ) : isCompleted ? (
                  // Completed: Small Gold Dot with Tooltip
                  <div className="group relative py-2 cursor-default">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-600 hover:bg-amber-400 transition-colors shadow-[0_0_5px_rgba(217,119,6,0.5)]" />
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-slate-400 text-[9px] font-bold uppercase tracking-widest rounded border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      {step}
                    </div>
                  </div>
                ) : (
                  // Future: Small Slate Dot
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                )}
              </div>

              {/* Connector Line (except after last) */}
              {i < steps.length - 1 && (
                <div className={`h-px w-6 mx-3 transition-colors duration-500 ${isCompleted ? 'bg-amber-900/40' : 'bg-slate-900'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

/**
 * ResponsiveDrawer
 * Renders as a Slide-Over (Right) on Desktop.
 * Renders as a Bottom Sheet on Mobile.
 */
export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  widthClass?: string; // e.g. "md:w-[600px]"
}

export const ResponsiveDrawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, children, widthClass = "md:w-[600px]" }) => {
  const isMobile = useIsMobile();
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    if (isOpen) setIsRendered(true);
  }, [isOpen]);

  if (!isOpen && !isRendered) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose} 
      />
      
      {/* Content Container */}
      <div className={`
        fixed z-50 bg-slate-950 shadow-2xl flex flex-col transition-transform duration-300 ease-out border-slate-800
        ${isMobile 
          ? `bottom-0 left-0 w-full h-[90vh] rounded-t-3xl border-t border-amber-900/30 ${isOpen ? 'translate-y-0' : 'translate-y-full'}` 
          : `top-0 right-0 h-full ${widthClass} border-l border-amber-900/30 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`
        }
      `}>
        {/* Mobile Drag Handle */}
        {isMobile && (
          <div className="w-full flex justify-center pt-3 pb-1" onClick={onClose}>
            <div className="w-12 h-1.5 bg-slate-800 rounded-full" />
          </div>
        )}

        {/* Header */}
        <div className="p-6 border-b border-amber-900/20 flex justify-between items-center bg-black/40 shrink-0">
           <h2 className="text-2xl font-serif text-amber-500 tracking-wide">{title}</h2>
           <button onClick={onClose} className="p-2 hover:bg-slate-900 rounded-full text-slate-500 hover:text-white transition-colors">
             <X size={24} />
           </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-grow overflow-y-auto p-4 md:p-8 custom-scrollbar">
          {children}
        </div>
      </div>
    </>
  );
};
